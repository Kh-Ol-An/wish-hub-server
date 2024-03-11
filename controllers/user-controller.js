const { validationResult } = require('express-validator');
const mime = require('mime-types');
const userService = require('../services/user-service');
const AwsController = require('./aws-controller');
const ApiError = require('../exceptions/api-error');
const generateFileId = require('../utils/generate-file-id');

class UserController {
    async registration(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(ApiError.BadRequest('Помилка при валідації', errors.array()));
            }

            const { firstName, email, password } = req.body;
            const userData = await userService.registration(firstName, email, password);

            res.cookie('refreshToken', userData.refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });

            return res.json(userData);
        } catch (error) {
            next(error);
        }
    }

    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const userData = await userService.login(email, password);

            res.cookie('refreshToken', userData.refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });

            return res.json(userData);
        } catch (error) {
            next(error);
        }
    }

    async logout(req, res, next) {
        try {
            const { refreshToken } = req.cookies;
            const token = await userService.logout(refreshToken);
            res.clearCookie('refreshToken');

            return res.json(token);
        } catch (error) {
            next(error);
        }
    }

    async activate(req, res, next) {
        try {
            const activationLink = req.params.link;
            await userService.activate(activationLink);

            return res.redirect(process.env.CLIENT_URL);
        } catch (error) {
            next(error);
        }
    }

    async refresh(req, res, next) {
        try {
            const { refreshToken } = req.cookies;
            const userData = await userService.refresh(refreshToken);

            res.cookie('refreshToken', userData.refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });

            return res.json(userData);
        } catch (error) {
            next(error);
        }
    }

    async getUsers(req, res, next) {
        try {
            const users = await userService.getAllUsers();

            return res.json(users);
        } catch (error) {
            next(error);
        }
    }

    async updateMyUser(req, res, next) {
        try {
            const { id, firstName, lastName, birthday, avatar } = req.body;
            const file = req.file;

            let avatarPath = avatar;
            if (avatar === 'delete') {
                avatarPath = await AwsController.deleteFile(
                    `user-${id}/avatar`,
                    next,
                );
            }
            if (!!file?.buffer) {
                avatarPath = await AwsController.updateFile(
                    file,
                    `user-${id}/avatar`,
                    `user-${id}/avatar/${generateFileId(file?.buffer)}.${mime.extension(file?.mimetype)}`,
                    id,
                    next,
                );
            }

            const user = await userService.updateMyUser(id, firstName, lastName, birthday, avatarPath);

            return res.json(user);
        } catch (error) {
            next(error);
        }
    }

    async addFriend(req, res, next) {
        try {
            const { myId, friendId } = req.body;

            const bothUsers = await userService.addFriend(myId, friendId);

            return res.json(bothUsers);
        } catch (error) {
            next(error);
        }
    }

    async deleteFriend(req, res, next) {
        try {
            const { myId, friendId } = req.body;

            const bothUserIds = await userService.deleteFriend(myId, friendId);

            return res.json(bothUserIds);
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new UserController();
