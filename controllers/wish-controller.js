const { ObjectId } = require('mongoose').Types;
const mime = require('mime-types');
const wishService = require('../services/wish-service');
const AwsController = require('./aws-controller');
const generateFileId = require('../utils/generate-file-id');
const WishModel = require('../models/wish-model');
const ApiError = require('../exceptions/api-error');

class WishController {
    static nameRegex = /^[a-zA-Zа-яА-ЯіІїЇ'єЄ0-9\s!"№#$%&()*,-;=?@_]*$/;

    static getImageId(url) {
        const urlWithoutProtocol = url.replace('https://', '');
        const imageName = urlWithoutProtocol.split('/')[3];
        return imageName.split('_')[0];
    };

    async createWish(req, res, next) {
        try {
            const { userId, name, price, description } = req.body;

            if (!WishController.nameRegex.test(name)) {
                return next(ApiError.BadRequest(`Назва бажання "${name}" містить недопустимі символи. Будь ласка, використовуй лише літери латинського та кириличного алфавітів (великі та малі), цифри, пробіли та наступні символи: ${nameRegex}`));
            }

            const potentialWish = await WishModel.findOne({ user: userId, name });
            if (potentialWish) {
                return next(ApiError.BadRequest(`В тебе вже є бажання з назвою "${name}".`));
            }

            const images = [];
            const files = req.files;
            for (const key in files) {
                const image = await AwsController.uploadFile(
                    files[key][0],
                    `user-${userId}/wish-${name.replace(/\s+/g, '_')}/${generateFileId(files[key][0].buffer)}.${mime.extension(files[key][0].mimetype)}`,
                    next,
                );

                images.push({
                    path: image,
                    position: Number(key.split('-')[1]),
                });
            }

            const wish = await wishService.createWish(userId, name, price, description, images);

            return res.json(wish);
        } catch (error) {
            next(error);
        }
    }

    async updateWish(req, res, next) {
        try {
            const body = req.body;
            if (!WishController.nameRegex.test(body.name)) {
                return next(ApiError.BadRequest(`Назва бажання "${body.name}" містить недопустимі символи. Будь ласка, використовуй лише літери латинського та кириличного алфавітів (великі та малі), цифри, пробіли та наступні символи: ${nameRegex}`));
            }

            const potentialWish = await WishModel.findOne({ user: body.userId, name: body.name });
            if (potentialWish) {
                const potentialWishId = new ObjectId(potentialWish._id).toString();
                if (potentialWishId !== body.id) {
                    return next(ApiError.BadRequest(`В тебе вже є бажання з назвою "${body.name}".`));
                }
            }

            const allImages = [];
            // проходимось по всіх полях, які містять дані про картинки
            for (const key in body) {
                if (key.includes('image')) {
                    // якщо картинка підлягає видаленню, то видаляємо її з бази Amazon S3
                    const parsedImage = JSON.parse(body[key]);
                    if (parsedImage.delete) {
                        await AwsController.deleteFile(
                            `user-${body.userId}/wish-${body.name.replace(/\s+/g, '_')}/${WishController.getImageId(parsedImage.path)}`,
                            next,
                        );
                    }

                    // додаємо картинку до загального масиву з валідною позицією
                    allImages.push({
                        ...parsedImage,
                        position: Number(key.split('-')[1]),
                    });
                }
            }
            const files = req.files;
            // якщо є нові картинки, то додаємо їх до бази Amazon S3
            for (const key in files) {
                const path = await AwsController.uploadFile(
                    files[key][0],
                    `user-${body.userId}/wish-${body.name.replace(/\s+/g, '_')}/${key}_${generateFileId(files[key][0].buffer)}.${mime.extension(files[key][0].mimetype)}`,
                    next,
                );

                // додаємо картинку до загального масиву з валідною позицією
                allImages.push({
                    path,
                    position: Number(key.split('-')[1]),
                });
            }

            // сортуємо всі картинки за позицією
            allImages.sort((a, b) => a.position - b.position);

            // видаляємо картинки з бази MongoDB, які вже були видалені з бази Amazon S3
            const imagesWithoutDeleted = [];
            let shift = 0;
            for (let i = 0; i < allImages.length; i++) {
                if (allImages[i].delete) {
                    shift++;
                } else {
                    imagesWithoutDeleted.push({
                        ...allImages[i],
                        position: i + 1 - shift,
                    });
                }
            }

            const wish = await wishService.updateWish(body.id, body.name, body.price, body.description, imagesWithoutDeleted);

            return res.json(wish);
        } catch (error) {
            next(error);
        }
    }

    async getWishList(req, res, next) {
        try {
            const userId = req.query.userId;

            const wishList = await wishService.getWishList(userId);

            return res.json(wishList);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new WishController();
