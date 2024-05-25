const AWS = require('aws-sdk');
const ApiError = require('../exceptions/api-error');

const s3 = new AWS.S3({
    accessKeyId: process.env.AWS_SDK_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SDK_SECRET_ACCESS_KEY,
    region: process.env.AWS_SDK_REGION,
});

class AwsService {
    async uploadFile(file, paramsKey) {
        try {
            const params = {
                Bucket: process.env.AWS_SDK_BUCKET_NAME,
                Key: paramsKey,
                Body: file.buffer,
                ContentType: file.mimetype,
                ContentLength: file.size,
            };

            const data = await s3.upload(params).promise();
            return data.Location;
        } catch (error) {
            throw ApiError.BadRequest(`SERVER.AwsService.uploadFile: Error uploading a file to Amazon S3: ${error}`);
        }
    }

    async updateFile(file, prefixPath, paramsKey) {
        try {
            const existingFiles = await s3.listObjectsV2({
                Bucket: process.env.AWS_SDK_BUCKET_NAME,
                Prefix: prefixPath,
            }).promise();

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
                    // Якщо користувач намагається завантажити файл, який вже є в системі
                    return null;
                }
            }

            const data = await s3.upload(params).promise();
            return data.Location;
        } catch (error) {
            throw ApiError.BadRequest(`SERVER.AwsService.updateFile: Error updating a file on Amazon S3: ${error}`);
        }
    }

    async deleteFile(prefixPath) {
        try {
            const existingFiles = await s3.listObjectsV2({
                Bucket: process.env.AWS_SDK_BUCKET_NAME,
                Prefix: prefixPath,
            }).promise();

            for (const file of existingFiles.Contents) {
                await s3.deleteObject({
                    Bucket: process.env.AWS_SDK_BUCKET_NAME,
                    Key: file.Key,
                }).promise();
            }

            return '';
        } catch (error) {
            throw ApiError.BadRequest(`SERVER.AwsService.deleteFile: Error deleting a file on Amazon S3: ${error}`);
        }
    }
}

module.exports = new AwsService();
