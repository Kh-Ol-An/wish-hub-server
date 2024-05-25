const { validationResult } = require('express-validator');
const mime = require('mime-types');
const UserService = require('../services/user-service');
const AwsService = require('../services/aws-service');
const ApiError = require('../exceptions/api-error');
const generateFileId = require('../utils/generate-file-id');

class UserController {
    async registration(req, res, next) {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return next(ApiError.BadRequest('SERVER.UserController.registration: Error during validation', errors.array()));
            }

            const { firstName, email, password, lang } = req.body;
            const userData = await UserService.registration(firstName, email, password, lang);

            res.cookie('refreshToken', userData.refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });

            return res.json(userData);
        } catch (error) {
            next(error);
        }
    };

    async activate(req, res, next) {
        try {
            const activationLink = req.params.link;
            const isActivated = await UserService.activate(activationLink);

            if (isActivated) {
                return res.redirect(process.env.CLIENT_URL);
            }

            return res.redirect(`${process.env.CLIENT_URL}/activation-link-expired`);
        } catch (error) {
            next(error);
        }
    };

    async getActivationLink(req, res, next) {
        try {
            const userId = req.params.userId;
            const userEmail = await UserService.generateActivationLink(userId);

            return res.json(userEmail);
        } catch (error) {
            next(error);
        }
    };

    async googleAuthorization(req, res, next) {
        try {
            const { email, lang, isActivated, firstName, lastName, avatar } = req.body;
            const userData = await UserService.googleAuthorization(email, lang, isActivated, firstName, lastName, avatar);

            res.cookie('refreshToken', userData.refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });

            return res.json(userData);
        } catch (error) {
            next(error);
        }
    };

    async login(req, res, next) {
        try {
            const { email, password, lang } = req.body;
            const userData = await UserService.login(email, password, lang);

            res.cookie('refreshToken', userData.refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });

            return res.json(userData);
        } catch (error) {
            next(error);
        }
    };

    async logout(req, res, next) {
        try {
            const { refreshToken } = req.cookies;

            const token = await UserService.logout(refreshToken);

            res.clearCookie('refreshToken');

            return res.json(token);
        } catch (error) {
            next(error);
        }
    };

    async refresh(req, res, next) {
        try {
            const { refreshToken } = req.cookies;
            const userData = await UserService.refresh(refreshToken);

            res.cookie('refreshToken', userData.refreshToken, { maxAge: 30 * 24 * 60 * 60 * 1000, httpOnly: true });

            return res.json(userData);
        } catch (error) {
            next(error);
        }
    };

    async forgotPassword(req, res, next) {
        try {
            const { email, lang } = req.body;

            const userEmail = await UserService.forgotPassword(email, lang);

            return res.json(userEmail);
        } catch (error) {
            next(error);
        }
    };

    async changeForgottenPassword(req, res, next) {
        try {
            const { passwordResetLink, newPassword } = req.body;

            const userEmail = await UserService.changeForgottenPassword(passwordResetLink, newPassword);

            return res.json(userEmail);
        } catch (error) {
            next(error);
        }
    };

    async changePassword(req, res, next) {
        try {
            const { userId, oldPassword, newPassword } = req.body;
            const { refreshToken } = req.cookies;

            const token = await UserService.changePassword(userId, oldPassword, newPassword, refreshToken);

            res.clearCookie('refreshToken');

            return res.json(token);
        } catch (error) {
            next(error);
        }
    };

    async changeLang(req, res, next) {
        try {
            const { userId, lang } = req.body;

            const user = await UserService.changeLang(userId, lang);

            return res.json(user);
        } catch (error) {
            next(error);
        }
    };

    async changeFirstLoaded(req, res, next) {
        try {
            const { userId } = req.body;

            const user = await UserService.changeFirstLoaded(userId);

            return res.json(user);
        } catch (error) {
            next(error);
        }
    };

    async updateMyUser(req, res, next) {
        try {
            const { userId, firstName, lastName, birthday, avatar } = req.body;
            const file = req.file;

            let avatarPath = avatar;
            if (avatar === 'delete') {
                avatarPath = await AwsService.deleteFile(`user-${userId}/avatar`);
            }
            if (!!file?.buffer) {
                avatarPath = await AwsService.updateFile(
                    file,
                    `user-${userId}/avatar`,
                    `user-${userId}/avatar/${generateFileId(file?.buffer)}.${mime.extension(file?.mimetype)}`,
                );
            }

            const user = await UserService.updateMyUser(userId, firstName, lastName, birthday, avatarPath);

            return res.json(user);
        } catch (error) {
            next(error);
        }
    };

    async addFriend(req, res, next) {
        try {
            const { myId, friendId } = req.body;

            const myUser = await UserService.addFriend(myId, friendId);

            return res.json(myUser);
        } catch (error) {
            next(error);
        }
    };

    async removeFriend(req, res, next) {
        try {
            const { myId, friendId, whereRemove } = req.body;

            const myUser = await UserService.removeFriend(myId, friendId, whereRemove);

            return res.json(myUser);
        } catch (error) {
            next(error);
        }
    };

    async deleteMyUser(req, res, next) {
        try {
            const { userId, email, password } = req.body;

            const deletedUserId = await UserService.deleteMyUser(userId, email, password);

            return res.json(deletedUserId);
        } catch (error) {
            next(error);
        }
    };

    async getUsers(req, res, next) {
        try {
            const { page, limit, myUserId, userType, search } = req.query;
            const usersData = await UserService.getUsers(page, limit, myUserId, userType, search);

            return res.json(usersData);
        } catch (error) {
            next(error);
        }
    };
}

module.exports = new UserController();
