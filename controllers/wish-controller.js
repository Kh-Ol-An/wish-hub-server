const WishService = require('../services/wish-service');

class WishController {
    async createWish(req, res, next) {
        try {
            const wish = await WishService.createWish(req.body, req.files, next);

            return res.json(wish);
        } catch (error) {
            next(error);
        }
    }

    async updateWish(req, res, next) {
        try {
            const wish = await WishService.updateWish(req.body, req.files, next);

            return res.json(wish);
        } catch (error) {
            next(error);
        }
    }

    async getWishList(req, res, next) {
        try {
            const { myId, userId } = req.query;

            const wishList = await WishService.getWishList(myId, userId);

            return res.json(wishList);
        } catch (error) {
            next(error);
        }
    }

    async deleteWish(req, res, next) {
        try {
            const { userId, wishId } = req.query;

            const deletedWishId = await WishService.deleteWish(userId, wishId);

            return res.json(deletedWishId);
        } catch (error) {
            next(error);
        }
    }

    async bookWish(req, res, next) {
        try {
            const { userId, wishId, end } = req.body;

            const bookedWish = await WishService.bookWish(userId, wishId, end);

            return res.json(bookedWish);
        } catch (error) {
            next(error);
        }
    }

    async cancelBookWish(req, res, next) {
        try {
            const { userId, wishId } = req.body;

            const bookedWish = await WishService.cancelBookWish(userId, wishId);

            return res.json(bookedWish);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new WishController();
