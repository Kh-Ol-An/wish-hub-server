const AWS = require("aws-sdk");
const mime = require('mime-types');
const ApiError = require("../exceptions/api-error");

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_SDK_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SDK_SECRET_ACCESS_KEY,
    region: process.env.AWS_SDK_REGION,
});

const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif'];

const isAllowedExtension = (filename) => {
    const extension = filename.split('.').pop().toLowerCase();
    return ALLOWED_EXTENSIONS.includes(extension);
}

const awsUploadFile = async (file, paramsKey, userId, next) => {
    try {
        const existingFiles = await s3.listObjectsV2({
            Bucket: process.env.AWS_SDK_BUCKET_NAME,
            Prefix: `user-${userId}/`,
        }).promise();

        if (!file) {
            await s3.deleteObject({
                Bucket: process.env.AWS_SDK_BUCKET_NAME,
                Key: existingFiles.Contents[0].Key,
            }).promise();
            return null;
        }

        if (file.size > 1024 * 1024 * process.env.MAX_FILE_SIZE_IN_MB) {
            return next(ApiError.BadRequest(`Максимальний розмір файлу ${process.env.MAX_FILE_SIZE_IN_MB} МБ`));
        }

        if (!isAllowedExtension(file.originalname)) {
            return next(ApiError.BadRequest(
                `Файл з розширенням "${
                    mime.extension(file.mimetype)
                }" заборонений до завантаження. Дозволені файли з наступними розширеннями: "${
                    ALLOWED_EXTENSIONS.join(', ')
                }"`
            ));
        }

        const params = {
            Bucket: process.env.AWS_SDK_BUCKET_NAME,
            Key: paramsKey,
            Body: file.buffer,
            ContentType: file.mimetype,
            ContentLength: file.size,
        };

        if (existingFiles.Contents.length > 0) {
            const existingFile = existingFiles.Contents.find(file => file.Key === params.Key);
            if (existingFile) {
                return '';
            }

            await s3.deleteObject({
                Bucket: process.env.AWS_SDK_BUCKET_NAME,
                Key: existingFiles.Contents[0].Key,
            }).promise();
        }

        const data = await s3.upload(params).promise();
        return data.Location;
    } catch (error) {
        return next(ApiError.BadRequest(`Помилка при завантаженні або видаленні файлу на Amazon S3: ${error}`));
    }
}

module.exports = awsUploadFile;
