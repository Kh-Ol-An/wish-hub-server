const { ObjectId } = require('mongoose').Types;
const axios = require('axios');
const puppeteer = require('puppeteer');
const mime = require('mime-types');
const webPush = require('web-push');
const WishModel = require('../models/wish-model');
const UserModel = require('../models/user-model');
const WishDto = require('../dtos/wish-dto');
const UserDto = require('../dtos/user-dto');
const ApiError = require('../exceptions/api-error');
const AwsService = require('../services/aws-service');
const quotes = require('../data/quotes.json');
const notifications = require('../data/notifications.json');
const getImageId = require('../utils/get-image-id');
const generateFileId = require('../utils/generate-file-id');
const { MAX_FILE_SIZE_IN_MB, MAX_NUMBER_OF_FILES } = require('../utils/variables');
const { encryptData, decryptData } = require('../utils/encryption-data');
const { getRandomInt } = require('../utils/get-random-int');

class WishService {
    static ALLOWED_EXTENSIONS = [ 'jpg', 'jpeg', 'png', 'gif', 'webp' ];

    static isAllowedExtension(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        return WishService.ALLOWED_EXTENSIONS.includes(extension);
    };

    static wishValidator(name, imageLength) {
        if (imageLength > MAX_NUMBER_OF_FILES) {
            throw ApiError.BadRequest(`SERVER.WishService.WishService.wishValidator: You are trying to upload ${imageLength} files. Maximum number of files to upload ${MAX_NUMBER_OF_FILES}`);
        }
    };

    static fileValidator(file) {
        if (file.size > 1024 * 1024 * MAX_FILE_SIZE_IN_MB) {
            throw ApiError.BadRequest(`SERVER.WishService.WishService.fileValidator: One of the files you upload is ${(file.size / 1024 / 1024).toFixed(2)} MB. Maximum file size ${MAX_FILE_SIZE_IN_MB} MB`);
        }

        if (!WishService.isAllowedExtension(file.originalname)) {
            throw ApiError.BadRequest(
                `SERVER.WishService.WishService.fileValidator: One or more files you upload with the "${
                    mime.extension(file.mimetype)
                }" extension are not allowed for upload. Files with the following extensions are allowed: "${
                    WishService.ALLOWED_EXTENSIONS.join(', ')
                }"`
            );
        }
    };

    async fetchWishDataFromLink(url) {
        try {

            const browser = await puppeteer.launch();
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle2' });

            const metaData = await page.evaluate(() => {
                const getPrice = () => {
                    const priceSelectors = [
                        'meta[property="product:price:amount"]',
                        'meta[itemprop="price"]',
                        '[itemprop="price"]',
                        '[class*="price"]'
                    ];

                    for (let selector of priceSelectors) {
                        const element = document.querySelector(selector);
                        if (element) {
                            return element.getAttribute('content') || element.textContent.trim();
                        }
                    }

                    return null;
                };

                return {
                    url,
                    name: document.querySelector('meta[property="og:title"]')?.getAttribute('content') || document.title,
                    image: document.querySelector('meta[property="og:image"]')?.getAttribute('content'),
                    price: getPrice(),
                    description: document.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                        document.querySelector('meta[name="description"]')?.getAttribute('content')
                };
            });

            await browser.close();
            return metaData;
        } catch (error) {
            console.log('SERVER.WishService.fetchWishDataFromLink: Error fetching data: ', error);
            throw ApiError.BadRequest(`SERVER.WishService.fetchWishDataFromLink: Не вдалось отримати дані зі стороннього сервісу: ${error}`);
        }
    };

    async createWish(body, files) {
        const { userId, material, show, name, price, currency, description } = body;

        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest('SERVER.WishService.createWish: The user who creates the wish is not found');
        }

        const unencryptedName = show === 'all' ? name : decryptData(name);
        WishService.wishValidator(unencryptedName, Object.keys(files).length);

        const potentialWish = await WishModel.findOne({ user: userId, name: unencryptedName });
        if (potentialWish) {
            throw ApiError.BadRequest(`SERVER.WishService.createWish: You already have a wish named  "${unencryptedName}".`);
        }

        const wish = await WishModel.create({
            userId,
            material,
            show,
            name,
            price: show === 'all' ? price : decryptData(price),
            currency: show === 'all' ? currency : decryptData(currency),
            description,
        });

        for (const key in body) {
            if (key.includes('address')) {
                const address = JSON.parse(body[key]);
                wish.addresses.push(address);
            }
        }

        // ***** IMAGES ***** //
        const allImages = [];
        // якщо є нові картинки, то додаємо їх до бази Amazon S3
        for (const key in files) {
            const file = files[key][0];
            WishService.fileValidator(file);
            const path = await AwsService.uploadFile(
                file,
                `user-${userId}/wish-${id}/${generateFileId(file.buffer)}.${mime.extension(file.mimetype)}`,
            );

            // додаємо картинку до загального масиву з валідною позицією
            allImages.push({
                path: show === 'all' ? path : encryptData(path),
                position: Number(key.split('-')[1]),
            });
        }
        // проходимось по всіх полях, які містять дані про картинки
        for (const key in body) {
            if (key.includes('image')) {
                // якщо картинка підлягає видаленню, то видаляємо її з бази Amazon S3
                const parsedImage = JSON.parse(body[key]);
                if (parsedImage.delete) {
                    await AwsService.deleteFile(
                        `user-${userId}/wish-${id}/${
                            getImageId(show === 'all' ? parsedImage.path : decryptData(parsedImage.path))
                        }`,
                    );
                }

                // додаємо картинку до загального масиву з валідною позицією
                allImages.push({
                    ...parsedImage,
                    position: Number(key.split('-')[1]),
                });
            }
        }
        // сортуємо всі картинки за позицією
        allImages.sort((a, b) => a.position - b.position);
        // видаляємо картинки з бази MongoDB, які вже були видалені з бази Amazon S3
        const imagesWithoutDeleted = [];
        let shift = 0;
        for (let i = 0; i < allImages.length; i++) {
            if (allImages[i].delete) {
                shift++;
            } else {
                imagesWithoutDeleted.push({
                    ...allImages[i],
                    position: i - shift,
                });
            }
        }
        wish.images = imagesWithoutDeleted.map(image => ({ ...image, path: image.path }));
        // ***** IMAGES ***** //

        await wish.save();

        user.wishList.push(wish.id);

        let quote = quotes[user.quoteNumber];
        const countQuotes = quotes.length;
        if (user.quoteNumber >= countQuotes) {
            quote = quotes[getRandomInt(0, countQuotes)];
        } else {
            user.quoteNumber++;
        }

        await user.save();

        return { wish: new WishDto(wish), quote };
    };

    async updateWish(body, files) {
        const { id, userId, material, show, name, price, currency, description } = body;

        const wish = await WishModel.findById(new ObjectId(id));
        if (!wish) {
            throw ApiError.BadRequest(`SERVER.WishService.updateWish: Requests with id: “${id}” not found`);
        }

        const unencryptedName = show === 'all' ? name : decryptData(name);

        let uploadedImageLength = 0;
        for (const key in body) {
            if (key.includes('image')) {
                // рахуємо тільки ті картинки, які не підлягають видаленню
                if (!JSON.parse(body[key]).delete) {
                    uploadedImageLength++;
                }
            }
        }
        const filesLength = Object.keys(files).length;

        WishService.wishValidator(unencryptedName, uploadedImageLength + filesLength);

        const potentialWish = await WishModel.findOne({ user: userId, name: unencryptedName });
        if (potentialWish) {
            const potentialWishId = new ObjectId(potentialWish._id).toString();
            if (potentialWishId !== id) {
                throw ApiError.BadRequest(`SERVER.WishService.updateWish: You already have a wish named  "${unencryptedName}".`);
            }
        }

        const addresses = [];
        for (const key in body) {
            if (key.includes('address')) {
                const address = JSON.parse(body[key]);
                addresses.push(address);
            }
        }

        // ***** IMAGES ***** //
        const allImages = [];
        // якщо є нові картинки, то додаємо їх до бази Amazon S3
        for (const key in files) {
            const file = files[key][0];
            WishService.fileValidator(file);
            const path = await AwsService.uploadFile(
                file,
                `user-${userId}/wish-${id}/${generateFileId(file.buffer)}.${mime.extension(file.mimetype)}`,
            );

            // додаємо картинку до загального масиву з валідною позицією
            allImages.push({
                path: show === 'all' ? path : encryptData(path),
                position: Number(key.split('-')[1]),
            });
        }
        // проходимось по всіх полях, які містять дані про картинки
        for (const key in body) {
            if (key.includes('image')) {
                // якщо картинка підлягає видаленню, то видаляємо її з бази Amazon S3
                const parsedImage = JSON.parse(body[key]);
                if (parsedImage.delete) {
                    await AwsService.deleteFile(
                        `user-${userId}/wish-${id}/${
                            getImageId(show === 'all' ? parsedImage.path : decryptData(parsedImage.path))
                        }`,
                    );
                }

                // додаємо картинку до загального масиву з валідною позицією
                allImages.push({
                    ...parsedImage,
                    position: Number(key.split('-')[1]),
                });
            }
        }
        // сортуємо всі картинки за позицією
        allImages.sort((a, b) => a.position - b.position);
        // видаляємо картинки з бази MongoDB, які вже були видалені з бази Amazon S3
        const imagesWithoutDeleted = [];
        let shift = 0;
        for (let i = 0; i < allImages.length; i++) {
            if (allImages[i].delete) {
                shift++;
            } else {
                imagesWithoutDeleted.push({
                    ...allImages[i],
                    position: i - shift,
                });
            }
        }
        wish.images = imagesWithoutDeleted.map(image => ({ ...image, path: image.path }));
        // ***** IMAGES ***** //

        wish.material = material;
        wish.show = show;
        wish.name = name;
        wish.price = show === 'all' ? price : decryptData(price);
        wish.currency = show === 'all' ? currency : decryptData(currency);
        wish.addresses = addresses;
        wish.description = description;

        await wish.save();

        return new WishDto(wish);
    };

    async getWish(wishId) {
        const wish = await WishModel.findById(wishId);
        if (!wish) {
            throw ApiError.BadRequest(`SERVER.WishService.getWish: Wish with id: “${wishId}” not found`);
        }

        const user = await UserModel.findById(wish.userId);
        if (!user) {
            throw ApiError.BadRequest(`SERVER.WishService.getWish: The user who created the wish with id: “${wishId}” was not found`);
        }

        return {
            userFirstName: user.firstName,
            userLastName: user.lastName,
            userAvatar: user.avatar,
            wish: new WishDto(wish),
        };
    };

    async bookWish(userId, wishId, end) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest('SERVER.WishService.bookWish: User not found');
        }

        // Знайдіть бажання за його ідентифікатором
        const bookingWish = await WishModel.findById(wishId);
        if (!bookingWish) {
            throw ApiError.BadRequest('SERVER.WishService.bookWish: Wish not found');
        }

        // Забронювати бажання
        bookingWish.booking = {
            userId,
            start: new Date(),
            end,
        };

        // Додайте цитату після бронювання бажання
        let quote = quotes[user.quoteNumber];
        const countQuotes = quotes.length;
        if (user.quoteNumber >= countQuotes) {
            quote = quotes[getRandomInt(0, countQuotes)];
        } else {
            user.quoteNumber++;
        }

        const wishCreator = await UserModel.findById(bookingWish.userId);
        if (!wishCreator) {
            throw ApiError.BadRequest('SERVER.WishService.bookWish: User who created wish is not found');
        }

        if (wishCreator.notificationSubscription) {
            const payload = JSON.stringify({
                title: notifications.bookWish[wishCreator.lang].title,
                body: `${notifications.bookWish[wishCreator.lang].body} ${bookingWish.show === 'all' ? bookingWish.name : decryptData(bookingWish.name)}`,
            });
            webPush.sendNotification(wishCreator.notificationSubscription, payload).catch(error => console.error(error));
        }

        // Збережіть зміни
        await user.save();
        await bookingWish.save();

        return { wish: new WishDto(bookingWish), quote };
    };

    async cancelBookWish(userId, wishId) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest('SERVER.WishService.cancelBookWish: User not found');
        }

        // Знайдіть бажання за його ідентифікатором
        const bookedWish = await WishModel.findById(wishId);
        if (!bookedWish) {
            throw ApiError.BadRequest('SERVER.WishService.cancelBookWish: Wish not found');
        }

        if (user._id.toString() !== bookedWish.booking.userId.toString()) {
            throw ApiError.BadRequest('SERVER.WishService.cancelBookWish: You cannot cancel a wish that you have not booked');
        }

        // Видаліть бронювання бажання
        bookedWish.booking = undefined;

        // Збережіть зміни
        await bookedWish.save();

        return new WishDto(bookedWish);
    };

    async doneWish(userId, wishId, whoseWish) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest('SERVER.WishService.doneWish: User not found');
        }

        // Знайдіть бажання за його ідентифікатором
        const bookedWish = await WishModel.findById(wishId);
        if (!bookedWish) {
            throw ApiError.BadRequest('SERVER.WishService.doneWish: Wish not found');
        }

        if (user._id.toString() !== bookedWish.userId.toString()) {
            throw ApiError.BadRequest('SERVER.WishService.doneWish: You cannot mark someone else\'s wish as fulfilled');
        }

        const executorUser = whoseWish === 'my' ? user : await UserModel.findById(bookedWish.booking.userId);
        if (!executorUser) {
            throw ApiError.BadRequest('SERVER.WishService.doneWish: The executor of the wish was not found');
        }

        // Видаліть бронювання бажання
        bookedWish.booking = undefined;
        // Позначте бажання виконаним
        bookedWish.executed = true;

        // Додати до виконанних бажань користувача ще одне виконанне бажання
        whoseWish === 'someone' && (executorUser.successfulWishes += 1);

        // Збережіть зміни
        await bookedWish.save();
        await executorUser.save();

        return { executorUser: new UserDto(executorUser), bookedWish: new WishDto(bookedWish) };
    };

    async undoneWish(userId, wishId) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest('SERVER.WishService.undoneWish: User not found');
        }

        // Знайдіть бажання за його ідентифікатором
        const bookedWish = await WishModel.findById(wishId);
        if (!bookedWish) {
            throw ApiError.BadRequest('SERVER.WishService.undoneWish: Wish not found');
        }

        if (user._id.toString() !== bookedWish.userId.toString()) {
            throw ApiError.BadRequest('SERVER.WishService.undoneWish: You cannot mark someone else\'s wish as unfulfilled');
        }

        const executorUser = await UserModel.findById(bookedWish.booking.userId);
        if (!executorUser) {
            throw ApiError.BadRequest('SERVER.WishService.undoneWish: The executor of the wish was not found');
        }

        // Видаліть бронювання бажання
        bookedWish.booking = undefined;

        // Додати до виконанних бажань користувача ще одне виконанне бажання
        executorUser.unsuccessfulWishes += 1;

        // Збережіть зміни
        await bookedWish.save();
        await executorUser.save();

        return { executorUser: new UserDto(executorUser), bookedWish: new WishDto(bookedWish) };
    };

    async likeWish(userId, wishId) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest('SERVER.WishService.likeWish: User not found');
        }

        // Знайдіть бажання за його ідентифікатором
        const wish = await WishModel.findById(wishId);
        if (!wish) {
            throw ApiError.BadRequest('SERVER.WishService.likeWish: Wish not found');
        }

        // Видалити ідентифікатор користувача з масиву dislikes, якщо він там є
        wish.dislikes = wish.dislikes.filter(dislikedByUser => dislikedByUser.userId.toString() !== user._id.toString());

        if (wish.likes.some(likedByUser => likedByUser.userId.toString() === user._id.toString())) {
            // Якщо користувач вже поставив like, то видаліть його
            wish.likes = wish.likes.filter(likedByUser => likedByUser.userId.toString() !== user._id.toString());
        } else {
            // Якщо користувач ще не поставив like, то додайте його
            wish.likes.push({
                userId: user._id,
                userAvatar: user.avatar,
                userFullName: user.firstName + (user.lastName ? ` ${user.lastName}` : ''),
            });
        }

        wish.sortByLikes = wish.likes.length - wish.dislikes.length;

        // Збережіть зміни
        await wish.save();
        await user.save();

        return new WishDto(wish);
    };

    async dislikeWish(userId, wishId) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest('SERVER.WishService.dislikeWish: User not found');
        }

        // Знайдіть бажання за його ідентифікатором
        const wish = await WishModel.findById(wishId);
        if (!wish) {
            throw ApiError.BadRequest('SERVER.WishService.dislikeWish: Wish not found');
        }

        // Видалити ідентифікатор користувача з масиву likes, якщо він там є
        wish.likes = wish.likes.filter(likedByUser => likedByUser.userId.toString() !== user._id.toString());

        if (wish.dislikes.some(dislikedByUser => dislikedByUser.userId.toString() === user._id.toString())) {
            // Якщо користувач вже поставив dislike, то видаліть його
            wish.dislikes = wish.dislikes.filter(dislikedByUser => dislikedByUser.userId.toString() !== user._id.toString());
        } else {
            // Якщо користувач ще не поставив dislike, то додайте його
            wish.dislikes.push({
                userId: user._id,
                userAvatar: user.avatar,
                userFullName: user.firstName + (user.lastName ? ` ${user.lastName}` : ''),
            });
        }

        wish.sortByLikes = wish.likes.length - wish.dislikes.length;

        // Збережіть зміни
        await wish.save();
        await user.save();

        return new WishDto(wish);
    };

    async deleteWish(userId, wishId) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest('SERVER.WishService.deleteWish: User not found');
        }

        // Знайдіть бажання за його ідентифікатором і видаліть його
        const deletedWish = await WishModel.findByIdAndDelete(wishId);
        if (!deletedWish) {
            throw ApiError.BadRequest('SERVER.WishService.deleteWish: Wish not found');
        }

        // Видаліть всі файли з бажанням з бази Amazon S3
        await AwsService.deleteFile(
            `user-${user._id}/wish-${deletedWish._id}`,
        );

        // Знайдіть індекс бажання в масиві wishList користувача і видаліть його
        const index = user.wishList.indexOf(deletedWish._id);
        if (index !== -1) {
            user.wishList.splice(index, 1);
        }

        // Збережіть зміни
        await user.save();

        return deletedWish._id;
    };

    async getWishList(myId, userId, page = 1, limit = 12, status = 'all', search = '', sort = 'createdAt:desc') {
        // console.log('myId: ', myId);
        // console.log('userId: ', userId);
        // console.log('page: ', page);
        // console.log('limit: ', limit);
        // console.log('status: ', status);
        // console.log('search: ', search);
        // console.log('sort: ', sort);

        const creator = await UserModel.findById(userId);
        if (!creator) {
            throw ApiError.BadRequest(`SERVER.WishService.getWishList: User with ID: “${userId}” not found`);
        }

        // Створюємо основний запит фільтрації
        let match = { userId: creator._id }; // Фільтруємо тільки бажання цього користувача

        // Перевіряємо, чи є myId у списку друзів користувача
        const isFriend = creator.friends.includes(myId);
        // Додаємо фільтрацію за полем show, якщо користувач запитує чужі бажання
        if (myId !== userId) {
            match.$or = [{ show: 'all' }];

            if (isFriend) {
                match.$or.push({ show: 'friends' });
            }
        }

        // Додаємо фільтрацію за полем executed на основі status
        if (status === 'fulfilled') {
            match.executed = true;
        } else if (status === 'unfulfilled') {
            match.executed = false;
        }

        // Додаємо пошук за ім'ям та описом
        if (search) {
            const searchConditions = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];

            if (match.$or) {
                match.$and = [{ $or: match.$or }, { $or: searchConditions }];
                delete match.$or;
            } else {
                match.$or = searchConditions;
            }
        }

        // console.log('match: ', match);

        // Підготувати параметр сортування
        let sortQuery = {};
        if (sort) {
            const [field, order] = sort.split(':');
            sortQuery[field] = order === 'desc' ? -1 : 1;
        } else {
            // За замовчуванням сортуємо за кількістю лайків
            sortQuery = {
                createdAt: -1,
            };
        }

        // Додаємо додаткове сортування за updatedAt у зворотному порядку
        sortQuery.updatedAt = -1;

        // Перетворюємо page та limit на числа
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        const skip = (page - 1) * limit;

        // Виконуємо запит до MongoDB з фільтрацією, сортуванням, skip і limit
        const result = await WishModel.aggregate([
            { $match: match },
            { $sort: sortQuery },
            { $skip: skip },
            { $limit: limit },
        ]);

        // Повертаємо результат у вигляді об'єктів класу WishDto
        return {
            creator: new UserDto(creator),
            wishes: result.map(wish => new WishDto(wish)),
        };
    }

    // db.wishes.find().forEach(wish => {
    //     let priceNumber = parseFloat(wish.price);
    //
    //     db.wishes.updateOne(
    //         { _id: wish._id },
    //         { $set: { price: priceNumber } }
    //     );
    // });

    // db.wishes.find().forEach(async (wish) => {
    //     let priceInBaseCurrency = 0;
    //
    //     if (wish.price && wish.price.length > 0 && parseFloat(wish.price) > 0) {
    //         const exchangeRates = {
    //             UAH: 45.16486,
    //             USD: 1.089265,
    //             EUR: 1
    //         };
    //         const baseCurrency = 'USD';
    //         const currency = wish.currency || 'UAH';
    //         const rate = exchangeRates[currency] / exchangeRates[baseCurrency];
    //         priceInBaseCurrency = parseFloat(wish.price) / rate;
    //     }
    //
    //     db.wishes.updateOne(
    //         { _id: wish._id },
    //         { $set: { priceInBaseCurrency: priceInBaseCurrency } }
    //     );
    // });

    // ***************************************

    // db.wishes.find().forEach(wish => {
    //     let likesCount = (wish.likes || []).length;
    //     let dislikesCount = (wish.dislikes || []).length;
    //
    //     let sortByLikes = likesCount - dislikesCount;
    //
    //     db.wishes.updateOne(
    //         { _id: wish._id },
    //         { $set: { sortByLikes: sortByLikes } }
    //     );
    // });

    async getAllWishes(page = 1, limit = 12, search = '', sort = 'sortByLikes:desc') {
        let match = {};

        // Додати пошук за ім'ям
        if (search) {
            match.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
            ];
        }

        // Додати фільтрацію за умовою show === 'all'
        match.show = 'all';

        // Підготувати параметр сортування
        let sortQuery = {};
        if (sort) {
            const [ field, order ] = sort.split(':');
            sortQuery[field] = order === 'desc' ? -1 : 1;
        } else {
            // За замовчуванням сортуємо за кількістю лайків, потім ті, що без лайків, і по кількості дизлайків
            sortQuery = {
                sortByLikes: -1,
            };
        }

        // Сортування від найновіших до найстаріших
        sortQuery.updatedAt = -1;

        // Перетворюємо page та limit на числа
        page = parseInt(page, 10);
        limit = parseInt(limit, 10);

        const skip = (page - 1) * limit;

        // Виконуємо запит до MongoDB з фільтрацією, сортуванням, skip і limit
        const allWishes = await WishModel.aggregate([
            { $match: match },
            { $sort: sortQuery },
            { $skip: skip },
            { $limit: limit },
        ]);

        // Повертаємо результат у вигляді об'єктів класу WishDto
        return allWishes.map(wish => new WishDto(wish));
    }
}

module.exports = new WishService();
