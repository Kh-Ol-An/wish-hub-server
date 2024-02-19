const wishService = require('../services/wish-service');

class UserController {
    async createWish(req, res, next) {
        try {
            const { userId, name, price, description } = req.body;

            const wish = await wishService.createWish(userId, name, price, description);

            return res.json(wish);
        } catch (error) {
            next(error);
        }
    }

    async getWishList(req, res, next) {
        try {
            const { userId } = req.body;

            const wishList = await wishService.getWishList(userId);

            return res.json(wishList);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new UserController();
