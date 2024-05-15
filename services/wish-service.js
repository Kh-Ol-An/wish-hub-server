const { ObjectId } = require('mongoose').Types;
const mime = require('mime-types');
const WishModel = require('../models/wish-model');
const UserModel = require('../models/user-model');
const WishDto = require('../dtos/wish-dto');
const UserDto = require('../dtos/user-dto');
const ApiError = require('../exceptions/api-error');
const AwsService = require('../services/aws-service');
const getImageId = require('../utils/get-image-id');
const generateFileId = require('../utils/generate-file-id');
const { MAX_FILE_SIZE_IN_MB, MAX_NUMBER_OF_FILES } = require('../utils/variables');
const { encryptData, decryptData } = require('../utils/encryption-data');

class WishService {
    static ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

    static isAllowedExtension(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        return WishService.ALLOWED_EXTENSIONS.includes(extension);
    };

    static wishValidator(name, imageLength) {
        const nameRegex = /^[a-zA-Zа-яА-ЯіІїЇ'єЄ0-9\s-!"№#$%&()*.,;=?@_]*$/;
        if (!nameRegex.test(name)) {
            throw ApiError.BadRequest(`Назва бажання "${name}" містить недопустимі символи. Будь ласка, використовуй лише літери латинського або кириличного алфавітів, цифри, пробіли та наступні символи: -!"№#$%&()*.,;=?@_`);
        }

        if (imageLength > MAX_NUMBER_OF_FILES) {
            throw ApiError.BadRequest(`Ви намагаєтесь завантажити ${imageLength} файлів. Максимальна кількість файлів для завантаження ${MAX_NUMBER_OF_FILES}`);
        }
    };

    static fileValidator(file) {
        if (file.size > 1024 * 1024 * MAX_FILE_SIZE_IN_MB) {
            throw ApiError.BadRequest(`Один з файлів які ви завантажуєте розміром ${(file.size / 1024 / 1024).toFixed(2)} МБ. Максимальний розмір файлу ${MAX_FILE_SIZE_IN_MB} МБ`);
        }

        if (!WishService.isAllowedExtension(file.originalname)) {
            throw ApiError.BadRequest(
                `Один або декілька файлів які ви завантажуєте з розширенням "${
                    mime.extension(file.mimetype)
                }" заборонений до завантаження. Дозволені файли з наступними розширеннями: "${
                    WishService.ALLOWED_EXTENSIONS.join(', ')
                }"`
            );
        }
    };

    async createWish(body, files) {
        const { userId, material, show, name, price, currency, address, description } = body;

        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Користувач який створює бажання не знайдений');
        }

        const unencryptedName = show === 'all' ? name : decryptData(name);
        WishService.wishValidator(unencryptedName, Object.keys(files).length);

        const potentialWish = await WishModel.findOne({ user: userId, name: unencryptedName });
        if (potentialWish) {
            throw ApiError.BadRequest(`В тебе вже є бажання з назвою "${unencryptedName}".`);
        }

        const wish = await WishModel.create({
            userId,
            material,
            show,
            name,
            price: show === 'all' ? price : decryptData(price),
            currency: show === 'all' ? currency : decryptData(currency),
            address,
            description,
        });

        const images = [];
        for (const key in files) {
            const file = files[key][0];
            WishService.fileValidator(file);
            const image = await AwsService.uploadFile(
                file,
                `user-${userId}/wish-${wish.id}/${generateFileId(file.buffer)}.${mime.extension(file.mimetype)}`,
            );

            images.push({
                path: show === 'all' ? image : encryptData(image),
                position: Number(key.split('-')[1]),
            });
        }

        wish.images = images;
        await wish.save();

        user.wishList.push(wish.id);
        await user.save();

        return new WishDto(wish);
    };

    async updateWish(body, files) {
        const { id, userId, material, show, name, price, currency, address, description } = body;

        const wish = await WishModel.findById(new ObjectId(id));
        if (!wish) {
            throw ApiError.BadRequest(`Бажання з id: "${id}" не знайдено`);
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
                throw ApiError.BadRequest(`В тебе вже є бажання з назвою "${unencryptedName}".`);
            }
        }

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

        wish.material = material;
        wish.show = show;
        wish.name = name;
        wish.price = show === 'all' ? price : decryptData(price);
        wish.currency = show === 'all' ? currency : decryptData(currency);
        wish.address = address;
        wish.description = description;
        wish.images = imagesWithoutDeleted.map(image => ({ ...image, path: image.path }));

        await wish.save();

        return new WishDto(wish);
    };

    async getWish(wishId) {
        const wish = await WishModel.findById(wishId);
        if (!wish) {
            throw ApiError.BadRequest(`Бажання з id: "${wishId}" не знайдено`);
        }

        const user = await UserModel.findById(wish.userId);
        if (!user) {
            throw ApiError.BadRequest(`Користувача створившого бажання з id: "${wishId}" не знайдено`);
        }

        return {
            userFirstName: user.firstName,
            userLastName: user.lastName,
            userAvatar: user.avatar,
            wish: new WishDto(wish),
        };
    };

    async doneWish(userId, wishId) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Користувач не знайдений');
        }

        // Знайдіть бажання за його ідентифікатором
        const bookedWish = await WishModel.findById(wishId);
        if (!bookedWish) {
            throw new Error('Бажання не знайдено');
        }

        if (user._id.toString() !== bookedWish.userId.toString()) {
            throw new Error('Ви не можете позначити чуже бажання виконанним');
        }

        const executorUser = await UserModel.findById(bookedWish.booking.userId);
        if (!executorUser) {
            throw new Error('Виконувача бажання не знайдено');
        }

        // Видаліть бронювання бажання
        bookedWish.booking = undefined;
        // Позначте бажання виконаним
        bookedWish.executed = true;

        // Додати до виконанних бажань користувача ще одне виконанне бажання
        executorUser.successfulWishes += 1;

        // Збережіть зміни
        await bookedWish.save();
        await executorUser.save();

        return { executorUser: new UserDto(executorUser), bookedWish: new WishDto(bookedWish) };
    };

    async undoneWish(userId, wishId) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Користувач не знайдений');
        }

        // Знайдіть бажання за його ідентифікатором
        const bookedWish = await WishModel.findById(wishId);
        if (!bookedWish) {
            throw new Error('Бажання не знайдено');
        }

        if (user._id.toString() !== bookedWish.userId.toString()) {
            throw new Error('Ви не можете позначити чуже бажання не виконанним');
        }

        const executorUser = await UserModel.findById(bookedWish.booking.userId);
        if (!executorUser) {
            throw new Error('Виконувача бажання не знайдено');
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

    async bookWish(userId, wishId, end) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Користувач не знайдений');
        }

        // Знайдіть бажання за його ідентифікатором
        const bookingWish = await WishModel.findById(wishId);
        if (!bookingWish) {
            throw new Error('Бажання не знайдено');
        }

        // Забронювати бажання
        bookingWish.booking = {
            userId,
            start: new Date(),
            end,
        };

        // Збережіть зміни
        await bookingWish.save();

        return new WishDto(bookingWish);
    };

    async cancelBookWish(userId, wishId) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Користувач не знайдений');
        }

        // Знайдіть бажання за його ідентифікатором
        const bookedWish = await WishModel.findById(wishId);
        if (!bookedWish) {
            throw new Error('Бажання не знайдено');
        }

        if (user._id.toString() !== bookedWish.booking.userId.toString()) {
            throw new Error('Ви не можете скасувати бронювання бажання яке не бронювали');
        }

        // Видаліть бронювання бажання
        bookedWish.booking = undefined;

        // Збережіть зміни
        await bookedWish.save();

        return new WishDto(bookedWish);
    };

    async deleteWish(userId, wishId) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Користувач не знайдений');
        }

        // Знайдіть бажання за його ідентифікатором і видаліть його
        const deletedWish = await WishModel.findByIdAndDelete(wishId);
        if (!deletedWish) {
            throw new Error('Бажання не знайдено');
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

    async getWishList(myId, userId) {
        const user = await UserModel.findById(userId).populate('wishList');
        if (!user) {
            throw new Error(`Користувача з id: "${userId}" не знайдено`);
        }

        if (myId === userId) {
            // якщо запитуємо власний список бажань, то повертаємо його в тому порядку, в якому він був створений
            return user.wishList.map(wish => new WishDto(wish)).sort((a, b) => b.updatedAt - a.updatedAt);
        }

        return user.wishList
            .filter(wish => { // фільтруємо бажання в залежності від того, хто може їх бачити
                if (wish.show === 'all') {
                    return true;
                }

                if (wish.show === 'nobody') {
                    return false;
                }

                return user.friends.some(friendId => friendId.toString() === myId);
            })
            .map(wish => new WishDto(wish)) // перетворюємо бажання в об'єкти класу WishDto
            .sort((a, b) => b.updatedAt - a.updatedAt); // сортуємо бажання за датою оновлення
    };
}

module.exports = new WishService();
