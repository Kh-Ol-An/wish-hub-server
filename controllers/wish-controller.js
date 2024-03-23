const wishService = require('../services/wish-service');

class WishController {
    async createWish(req, res, next) {
        try {
            const wish = await wishService.createWish(req.body, req.files, next);

            return res.json(wish);
        } catch (error) {
            next(error);
        }
    }

    async updateWish(req, res, next) {
        try {
            const wish = await wishService.updateWish(req.body, req.files, next);

            return res.json(wish);
        } catch (error) {
            next(error);
        }
    }

    async getWishList(req, res, next) {
        try {
            const { myId, userId } = req.query;

            const wishList = await wishService.getWishList(myId, userId);

            return res.json(wishList);
        } catch (error) {
            next(error);
        }
    }

    async deleteWish(req, res, next) {
        try {
            const { userId, wishId } = req.query;

            const deletedWishId = await wishService.deleteWish(userId, wishId);

            return res.json(deletedWishId);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new WishController();
