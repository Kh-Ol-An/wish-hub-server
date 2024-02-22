const wishModel = require('../models/wish-model');
const UserModel = require('../models/user-model');

class WishService {
    async createWish(userId, name, price, description, images) {
        const wish = await wishModel.create({ name, price, description, images });
        const user = await UserModel.findById(userId);
        if (!user) {
            throw new Error('Користувач не знайдений');
        }

        user.wishList.push(wish.id);
        await user.save();

        return wish;
    };

    async getWishList(userId) {
        const user = await UserModel.findById(userId).populate('wishList');
        if (!user) {
            throw new Error('Користувач не знайдений');
        }
        return user.wishList;
    };
}

module.exports = new WishService();
