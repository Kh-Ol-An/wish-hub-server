const { ObjectId } = require('mongoose').Types;
const mime = require('mime-types');
const WishModel = require('../models/wish-model');
const UserModel = require('../models/user-model');
const WishDto = require('../dtos/wish-dto');
const ApiError = require('../exceptions/api-error');
const AwsController = require('../controllers/aws-controller');
const getImageId = require('../utils/get-image-id');
const generateFileId = require('../utils/generate-file-id');

class WishService {
    static ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];

    static isAllowedExtension(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        return WishService.ALLOWED_EXTENSIONS.includes(extension);
    };

    static wishValidator(name, imageLength) {
        const nameRegex = /^[a-zA-Zа-яА-ЯіІїЇ'єЄ0-9\s-!"№#$%&()*.,;=?@_]*$/;
        if (!nameRegex.test(name)) {
            throw ApiError.BadRequest(`Назва бажання "${name}" містить недопустимі символи. Будь ласка, використовуй лише літери латинського або кириличного алфавітів, цифри, пробіли та наступні символи: -!"№#$%&()*.,;=?@_`);
        }

        if (imageLength > process.env.MAX_NUMBER_OF_FILES) {
            throw ApiError.BadRequest(`Ви намагаєтесь завантажити ${imageLength} файлів. Максимальна кількість файлів для завантаження ${process.env.MAX_NUMBER_OF_FILES}`);
        }
    };

    static fileValidator(file) {
        if (file.size > 1024 * 1024 * process.env.MAX_FILE_SIZE_IN_MB) {
            throw ApiError.BadRequest(`Один з файлів які ви завантажуєте розміром ${(file.size / 1024 / 1024).toFixed(2)} МБ. Максимальний розмір файлу ${process.env.MAX_FILE_SIZE_IN_MB} МБ`);
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

    async createWish(userId, material, show, name, price, address, description, files, next) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Користувач який створює бажання не знайдений');
        }

        WishService.wishValidator(name, Object.keys(files).length);

        const potentialWish = await WishModel.findOne({ user: userId, name });
        if (potentialWish) {
            return next(ApiError.BadRequest(`В тебе вже є бажання з назвою "${name}".`));
        }

        const images = [];
        for (const key in files) {
            const file = files[key][0];
            WishService.fileValidator(file);
            const image = await AwsController.uploadFile(
                file,
                `user-${userId}/wish-${name.replace(/\s+/g, '_')}/${generateFileId(file.buffer)}.${mime.extension(file.mimetype)}`,
                next,
            );

            images.push({
                path: image,
                position: Number(key.split('-')[1]),
            });
        }

        const wish = await WishModel.create({
            user: userId,
            material,
            show,
            name,
            price,
            address,
            description,
            images
        });

        user.wishList.push(wish.id);
        await user.save();

        return new WishDto(wish);
    };

    async updateWish(id, material, show, name, price, address, description, images) {
        const wish = await WishModel.findById(new ObjectId(id));
        if (!wish) {
            throw ApiError.BadRequest(`Бажання з id: "${id}" не знайдено`);
        }

        wish.material = material;
        wish.show = show;
        wish.name = name;
        wish.price = price;
        wish.address = address;
        wish.description = description;
        wish.images = images.map(image => ({ ...image, path: image.path }));

        await wish.save();

        return new WishDto(wish);
    };

    async getWishList(myId, userId) {
        const user = await UserModel.findById(new ObjectId(userId)).populate('wishList');
        if (!user) {
            throw new Error(`Користувача з id: "${userId}" не знайдено`);
        }

        if (myId === userId) {
            return user.wishList.map(wish => new WishDto(wish)).sort((a, b) => b.updatedAt - a.updatedAt);
        }

        return user.wishList
            .filter(wish => {
                if (wish.show === 'all') {
                    return true;
                }

                if (wish.show === 'nobody') {
                    return false;
                }

                return user.friends.some(friendId => friendId.toString() === myId);
            })
            .map(wish => new WishDto(wish))
            .sort((a, b) => b.updatedAt - a.updatedAt);
    };

    async deleteWish(userId, wishId, next) {
        // Знайдіть користувача за його ідентифікатором
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Користувач не знайдений');
        }

        // Знайдіть бажання за його ідентифікатором
        const deletedWish = await WishModel.findByIdAndDelete(wishId);
        if (!deletedWish) {
            throw new Error('Бажання не знайдено');
        }
        for (let i = 0; i < deletedWish.images.length; i++) {
            const image = deletedWish.images[i];
            await AwsController.deleteFile(
                `user-${user._id}/wish-${deletedWish.name.replace(/\s+/g, '_')}/${getImageId(image.path)}`,
                next,
            );
        }

        // Знайдіть індекс бажання в масиві wishList користувача і видаліть його
        const index = user.wishList.indexOf(deletedWish._id);
        if (index !== -1) {
            user.wishList.splice(index, 1);
        }

        // Збережіть зміни
        await user.save();

        return deletedWish._id;
    };
}

module.exports = new WishService();
