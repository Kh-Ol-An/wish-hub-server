const WishModel = require('../models/wish-model');
const UserModel = require('../models/user-model');
const WishDto = require("../dtos/wish-dto");

class WishService {
    async createWish(userId, name, price, description, images) {
        const wish = await WishModel.create({ name, price, description, images });
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Користувач не знайдений');
        }

        user.wishList.push(wish.id);
        await user.save();

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
