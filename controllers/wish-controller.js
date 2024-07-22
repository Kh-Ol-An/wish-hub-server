const WishService = require('../services/wish-service');

class WishController {
    async createWish(req, res, next) {
        try {
            const wishData = await WishService.createWish(req.body, req.files, next);

            return res.json(wishData);
        } catch (error) {
            next(error);
        }
    };

    async updateWish(req, res, next) {
        try {
            const wish = await WishService.updateWish(req.body, req.files, next);

            return res.json(wish);
        } catch (error) {
            next(error);
        }
    };

    async getWish(req, res, next) {
        try {
            const { wishId } = req.query;

            const wish = await WishService.getWish(wishId);

            return res.json(wish);
        } catch (error) {
            next(error);
        }
    };

    async bookWish(req, res, next) {
        try {
            const { userId, wishId, end } = req.body;

            const bookedWishData = await WishService.bookWish(userId, wishId, end);

            return res.json(bookedWishData);
        } catch (error) {
            next(error);
        }
    };

    async cancelBookWish(req, res, next) {
        try {
            const { userId, wishId } = req.body;

            const wish = await WishService.cancelBookWish(userId, wishId);

            return res.json(wish);
        } catch (error) {
            next(error);
        }
    };

    async doneWish(req, res, next) {
        try {
            const { userId, wishId, whoseWish } = req.body;

            const doneWishData = await WishService.doneWish(userId, wishId, whoseWish);

            return res.json(doneWishData);
        } catch (error) {
            next(error);
        }
    };

    async undoneWish(req, res, next) {
        try {
            const { userId, wishId } = req.body;

            const undoneWishData = await WishService.undoneWish(userId, wishId);

            return res.json(undoneWishData);
        } catch (error) {
            next(error);
        }
    };

    async likeWish(req, res, next) {
        try {
            const { userId, wishId } = req.body;

            const wish = await WishService.likeWish(userId, wishId);

            return res.json(wish);
        } catch (error) {
            next(error);
        }
    };

    async dislikeWish(req, res, next) {
        try {
            const { userId, wishId } = req.body;

            const wish = await WishService.dislikeWish(userId, wishId);

            return res.json(wish);
        } catch (error) {
            next(error);
        }
    };

    async deleteWish(req, res, next) {
        try {
            const { userId, wishId } = req.query;

            const deletedWishId = await WishService.deleteWish(userId, wishId);

            return res.json(deletedWishId);
        } catch (error) {
            next(error);
        }
    };

    async getWishList(req, res, next) {
        try {
            const { myId, userId, page, limit, status, search, sort } = req.query;

            const wishListData = await WishService.getWishList(myId, userId, page, limit, status, search, sort);

            return res.json(wishListData);
        } catch (error) {
            next(error);
        }
    };

    async getAllWishes(req, res, next) {
        try {
            const { page, limit, search, sort } = req.query;

            const wishList = await WishService.getAllWishes(page, limit, search, sort);

            return res.json(wishList);
        } catch (error) {
            next(error);
        }
    };
}

module.exports = new WishController();
