const wishService = require('../services/wish-service');
const awsUploadFile = require('./aws-controller');
const mime = require('mime-types');
const generateFileId = require('../utils/generate-file-id');
const WishModel = require("../models/wish-model");
const ApiError = require("../exceptions/api-error");

//awsUploadFile existingFiles:  [
//    {
//        Key: 'user-65d2dfa97d086909187aa833/wish-з_карт/image-95a6fc751c1b8b6ae79627b7a4f5f5a3.jpeg',
//        LastModified: 2024-02-23T07:55:54.000Z,
//        ETag: '"95a6fc751c1b8b6ae79627b7a4f5f5a3"',
//        ChecksumAlgorithm: [],
//        Size: 91320,
//        StorageClass: 'STANDARD'
//    }
//]

// 'user-65d2dfa97d086909187aa833/avatar/95a6fc751c1b8b6ae79627b7a4f5f5a3.jpeg'
// 'user-65d2dfa97d086909187aa833/wish-з_карт/image-95a6fc751c1b8b6ae79627b7a4f5f5a3.jpeg'
// 'user-65d2dfa97d086909187aa833/wish-з_карт/image-95a6fc751c1b8b6ae79627b7a4f5f5a3.jpeg'

class UserController {
    async createWish(req, res, next) {
        try {
            const { userId, name, price, description } = req.body;

            const nameRegex = /^[a-zA-Zа-яА-Я0-9\s!"№#$%&'()*,-;=?@_]*$/;
            if (!nameRegex.test(name)) {
                return next(ApiError.BadRequest(`Назва бажання "${name}" містить недопустимі символи. Будь ласка, використовуй лише літери латинського та кириличного алфавітів (великі та малі), цифри, пробіли та наступні символи: ${nameRegex}`));
            }

            const potentialWish = await WishModel.findOne({ user: userId, name });
            if (potentialWish) {
                return next(ApiError.BadRequest(`В тебе вже є бажання з назвою "${name}".`));
            }

            const images = [];

            const fileValues = Object.values(req.files);

            for (const file of fileValues) {
                const image = await awsUploadFile(
                    'false',
                    file[0],
                    `user-${userId}/wish-${name.replace(/\s+/g, '_')}/image-${generateFileId(file[0].buffer)}.${mime.extension(file[0].mimetype)}`,
                    userId,
                    next,
                );

                images.push({
                    id: generateFileId(file[0].buffer),
                    path: image,
                });
            }

            const wish = await wishService.createWish(userId, name, price, description, images);

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
