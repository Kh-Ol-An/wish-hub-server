const wishService = require('../services/wish-service');
const AwsController = require('./aws-controller');
const mime = require('mime-types');
const generateFileId = require('../utils/generate-file-id');
const WishModel = require('../models/wish-model');
const ApiError = require('../exceptions/api-error');

const nameRegex = /^[a-zA-Zа-яА-ЯіІїЇ'єЄ0-9\s!"№#$%&()*,-;=?@_]*$/;

const protocol = 'https://';
const getPathWithoutImageName = (originalUrl) => {
    const urlWithoutProtocol = originalUrl.replace(protocol, '');
    return `${protocol}${urlWithoutProtocol.split('/')[0]}/${urlWithoutProtocol.split('/')[1]}/${urlWithoutProtocol.split('/')[2]}`;
};
const getImageName = (originalUrl) => {
    const urlWithoutProtocol = originalUrl.replace(protocol, '');
    return urlWithoutProtocol.split('/')[3];
};
const getImageIdWithExtension = (url) => {
    return getImageName(url).split('_')[1];
};
const getImageNameWithPosition = (url) => {
    return getImageName(url).split('_')[0];
};

class WishController {
    async createWish(req, res, next) {
        try {
            const { userId, name, price, description } = req.body;

            if (!nameRegex.test(name)) {
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
                    `user-${userId}/wish-${name.replace(/\s+/g, '_')}/${key}_${generateFileId(files[key][0].buffer)}.${mime.extension(files[key][0].mimetype)}`,
                    next,
                );

                images.push({
                    path: image,
                    name: key,
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
            if (!nameRegex.test(body.name)) {
                return next(ApiError.BadRequest(`Назва бажання "${body.name}" містить недопустимі символи. Будь ласка, використовуй лише літери латинського та кириличного алфавітів (великі та малі), цифри, пробіли та наступні символи: ${nameRegex}`));
            }

            const allImages = [];
            for (const key in body) {
                if (key.includes('image')) {
                    if (body[key] === '"delete"') {
                        const result = await AwsController.deleteFile(
                            `user-${body.userId}/wish-${body.name.replace(/\s+/g, '_')}/${key}`,
                            next,
                        );
                        allImages.push({
                            path: result,
                            name: key,
                        });
                    } else {
                        allImages.push({
                            path: JSON.parse(body[key]).path,
                            name: key,
                        });
                    }
                }
            }
            const files = req.files;
            for (const key in files) {
                const image = await AwsController.uploadFile(
                    files[key][0],
                    `user-${body.userId}/wish-${body.name.replace(/\s+/g, '_')}/${key}_${generateFileId(files[key][0].buffer)}.${mime.extension(files[key][0].mimetype)}`,
                    next,
                );

                allImages.push({
                    path: image,
                    name: key,
                });
            }
            allImages.sort((a, b) => {
                return a.name.localeCompare(b.name);
            });

            const imagesWithoutDeleted = [];
            let shift = 0;
            for (let i = 0; i < allImages.length; i++) {
                if (allImages[i].path === 'deleted') {
                    shift++;
                } else {
                    imagesWithoutDeleted.push({
                        ...allImages[i],
                        name: `image-${i + 1 - shift}`,
                    });
                }
            }

            const imagesResult = [];
            if (shift > 0) {
                for (let i = 0; i < imagesWithoutDeleted.length; i++) {
                    const image = imagesWithoutDeleted[i];
                    const newKey = `image-${i + 1}`;
                    if (getImageNameWithPosition(image.path) !== newKey) {
                        await AwsController.renameFile(
                            `user-${body.userId}/wish-${body.name.replace(/\s+/g, '_')}/${getImageNameWithPosition(image.path)}_${getImageIdWithExtension(image.path)}`,
                            `user-${body.userId}/wish-${body.name.replace(/\s+/g, '_')}/${newKey}_${getImageIdWithExtension(image.path)}`,
                            next,
                        );

                        imagesResult.push({
                            ...image,
                            path: `${getPathWithoutImageName(image.path)}/${newKey}_${getImageIdWithExtension(image.path)}`,
                        });
                    } else {
                        imagesResult.push(image);
                    }
                }
            } else {
                imagesResult.push(...imagesWithoutDeleted);
            }

            const wish = await wishService.updateWish(body.id, body.name, body.price, body.description, imagesResult);

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
