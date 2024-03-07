const { ObjectId } = require('mongoose').Types;
const WishModel = require('../models/wish-model');
const UserModel = require('../models/user-model');
const WishDto = require("../dtos/wish-dto");
const ApiError = require("../exceptions/api-error");

class WishService {
    async createWish(userId, name, price, link, description, images) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Користувач не знайдений');
        }

        const wish = await WishModel.create({ user: userId, name, price, link, description, images });

        user.wishList.push(wish.id);
        await user.save();

        return new WishDto(wish);
    };


    async updateWish(id, name, price, link, description, images) {
        const convertedId = new ObjectId(id);
        const wish = await WishModel.findById(convertedId);

        if (!wish) {
            throw ApiError.BadRequest(`Бажання з id: "${id}" не знайдено`);
        }

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
}

module.exports = new WishService();
