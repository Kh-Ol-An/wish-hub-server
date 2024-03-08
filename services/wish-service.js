const { ObjectId } = require('mongoose').Types;
const WishModel = require('../models/wish-model');
const UserModel = require('../models/user-model');
const WishDto = require("../dtos/wish-dto");
const ApiError = require("../exceptions/api-error");
const AwsController = require("../controllers/aws-controller");
const getImageId = require("../utils/get-image-id");

class WishService {
    async createWish(userId, material, show, name, price, link, description, images) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Користувач не знайдений');
        }

        const wish = await WishModel.create({ user: userId, material, show, name, price, link, description, images });

        user.wishList.push(wish.id);
        await user.save();

        return new WishDto(wish);
    };

    async updateWish(id, material, show, name, price, link, description, images) {
        const convertedId = new ObjectId(id);
        const wish = await WishModel.findById(convertedId);

        if (!wish) {
            throw ApiError.BadRequest(`Бажання з id: "${id}" не знайдено`);
        }

        wish.material = material;
        wish.show = show;
        wish.name = name;
        wish.price = price;
        wish.link = link;
        wish.description = description;
        wish.images = images.map(image => ({ ...image, path: image.path }));

        await wish.save();

        return new WishDto(wish);
    };

    async getWishList(userId) {
        const user = await UserModel.findById(userId).populate('wishList');
        if (!user) {
            throw new Error('Користувач не знайдений');
        }
        return user.wishList.map(wish => new WishDto(wish));
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
