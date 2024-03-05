const { ObjectId } = require('mongoose').Types;
const mime = require('mime-types');
const wishService = require('../services/wish-service');
const AwsController = require('./aws-controller');
const generateFileId = require('../utils/generate-file-id');
const WishModel = require('../models/wish-model');
const ApiError = require('../exceptions/api-error');

class WishController {
    static ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];

    static getImageId(url) {
        const urlWithoutProtocol = url.replace('https://', '');
        const imageName = urlWithoutProtocol.split('/')[3];
        return imageName.split('_')[0];
    };

    static isAllowedExtension(filename) {
        const extension = filename.split('.').pop().toLowerCase();
        return WishController.ALLOWED_EXTENSIONS.includes(extension);
    };

    static wishValidator(name, imageLength) {
        const nameRegex = /^[a-zA-Zа-яА-ЯіІїЇ'єЄ0-9\s-!"№#$%&()*.,;=?@_]*$/;
        if (!nameRegex.test(name)) {
            throw ApiError.BadRequest(`Назва бажання "${name}" містить недопустимі символи. Будь ласка, використовуй лише літери латинського або кириличного алфавітів, цифри, пробіли та наступні символи: -!"№#$%&()*.,;=?@_`);
        }

        if (imageLength > process.env.MAX_NUMBER_OF_FILES) {
            throw ApiError.BadRequest(`Ви намагаєтесь завантажити ${imageLength} файлів. Максимальна кількість файлів для завантаження ${process.env.MAX_NUMBER_OF_FILES}`);
        }
    };

    static fileValidator(file) {
        if (file.size > 1024 * 1024 * process.env.MAX_FILE_SIZE_IN_MB) {
            throw ApiError.BadRequest(`Один з файлів які ви завантажуєте розміром ${(file.size / 1024 / 1024).toFixed(2)} МБ. Максимальний розмір файлу ${process.env.MAX_FILE_SIZE_IN_MB} МБ`);
        }

        if (!WishController.isAllowedExtension(file.originalname)) {
            throw ApiError.BadRequest(
                `Один або декілька файлів які ви завантажуєте з розширенням "${
                    mime.extension(file.mimetype)
                }" заборонений до завантаження. Дозволені файли з наступними розширеннями: "${
                    WishController.ALLOWED_EXTENSIONS.join(', ')
                }"`
            );
        }
    };

    async createWish(req, res, next) {
        try {
            const { userId, name, price, description } = req.body;
            const files = req.files;

            WishController.wishValidator(name, Object.keys(files).length);

            const potentialWish = await WishModel.findOne({ user: userId, name });
            if (potentialWish) {
                return next(ApiError.BadRequest(`В тебе вже є бажання з назвою "${name}".`));
            }

            const images = [];
            for (const key in files) {
                const file = files[key][0];
                WishController.fileValidator(file);
                const image = await AwsController.uploadFile(
                    file,
                    `user-${userId}/wish-${name.replace(/\s+/g, '_')}/${generateFileId(file.buffer)}.${mime.extension(file.mimetype)}`,
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
            const files = req.files;

            let uploadedImageLength = 0;
            for (const key in body) {
                if (key.includes('image')) {
                    // рахуємо тільки ті картинки, які не підлягають видаленню
                    if (!JSON.parse(body[key]).delete) {
                        uploadedImageLength++;
                    }
                }
            }
            const filesLength = Object.keys(files).length;
            WishController.wishValidator(body.name, uploadedImageLength + filesLength);

            const potentialWish = await WishModel.findOne({ user: body.userId, name: body.name });
            if (potentialWish) {
                const potentialWishId = new ObjectId(potentialWish._id).toString();
                if (potentialWishId !== body.id) {
                    return next(ApiError.BadRequest(`В тебе вже є бажання з назвою "${body.name}".`));
                }
            }

            const allImages = [];
            // якщо є нові картинки, то додаємо їх до бази Amazon S3
            for (const key in files) {
                const file = files[key][0];
                WishController.fileValidator(file);
                const path = await AwsController.uploadFile(
                    file,
                    `user-${body.userId}/wish-${body.name.replace(/\s+/g, '_')}/${key}_${generateFileId(file.buffer)}.${mime.extension(file.mimetype)}`,
                    next,
                );

                // додаємо картинку до загального масиву з валідною позицією
                allImages.push({
                    path,
                    position: Number(key.split('-')[1]),
                });
            }
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
                        position: i - shift,
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
