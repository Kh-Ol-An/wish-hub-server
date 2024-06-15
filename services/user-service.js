const { ObjectId } = require('mongoose').Types;
const bcrypt = require('bcrypt');
const uuid = require('uuid');
const UserModel = require('../models/user-model');
const TokenModel = require('../models/token-model');
const WishModel = require('../models/wish-model');
const MailService = require('./mail-service');
const TokenService = require('./token-service');
const AwsService = require('./aws-service');
const UserDto = require('../dtos/user-dto');
const ApiError = require('../exceptions/api-error');
const { LINK_WILL_EXPIRE_IN } = require('../utils/variables');
const { decryptData } = require("../utils/encryption-data");

class UserService {
    async registration(firstName, email, password, lang) {
        const candidate = await UserModel.findOne({ email });
        if (candidate) {
            throw ApiError.BadRequest(`SERVER.UserService.registration: User with email address ${email} already exists`);
        }

        const decryptedPassword = decryptData(password);
        const hashedPassword = await bcrypt.hash(decryptedPassword, 3);
        const activationLink = uuid.v4();

        const user = await UserModel.create({
            firstName,
            email,
            password: hashedPassword,
            lang,
            activationLink,
            activationLinkExpires: Date.now() + LINK_WILL_EXPIRE_IN,
        });
        await MailService.sendActivationMail(
            lang,
            email,
            firstName,
            `${process.env.API_URL}/api/activate/${activationLink}`,
        );

        const userDto = new UserDto(user);
        const tokens = TokenService.generateToken({ ...userDto });
        await TokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    };

    async activate(activationLink) {
        const user = await UserModel.findOne({ activationLink });
        if (!user) {
            throw ApiError.BadRequest('SERVER.UserService.activate: Invalid activation link');
        }

        if (user.activationLinkExpires < Date.now()) {
            user.isActivated = false;
            return false;
        }

        user.isActivated = true;
        user.activationLink = undefined;
        user.activationLinkExpires = undefined;
        await user.save();
        return true;
    };

    async generateActivationLink(userId) {
        const user = await UserModel.findOne(new ObjectId(userId));
        if (!user) {
            throw ApiError.BadRequest(`SERVER.UserService.generateActivationLink: User with ID: “${userId}” not found`);
        }

        if (user.isActivated) return;

        let activationLink = user.activationLink;
        if (!user.activationLink) {
            activationLink = uuid.v4();
        }

        await MailService.sendActivationMail(user.email, user.firstName, `${process.env.API_URL}/api/activate/${activationLink}`);

        user.isActivated = false;
        user.activationLink = activationLink;
        user.activationLinkExpires = Date.now() + LINK_WILL_EXPIRE_IN;
        await user.save();

        return user.email;
    };

    async deleteInactiveAccounts() {
        const inactiveAccounts = await UserModel.find({
            isActivated: false,
            activationLinkExpires: { $lt: Date.now() },
        });

        for (const account of inactiveAccounts) {
            await UserModel.deleteOne({ _id: account._id });
        }
    };

    async deleteExpiredPasswordResetLink() {
        const accountsWithExpiredLinkPasswordReset = await UserModel.find({
            passwordResetLinkExpires: { $lt: Date.now() },
        });

        for (const account of accountsWithExpiredLinkPasswordReset) {
            account.passwordResetLink = undefined;
            account.passwordResetLinkExpires = undefined;
            await account.save();
        }
    };

    async googleAuthorization(email, lang, isActivated, firstName, lastName, avatar) {
        const user = await UserModel.findOne({ email });

        if (user) {
            user.lang = lang;

            const userDto = new UserDto(user);
            const tokens = TokenService.generateToken({ ...userDto });
            await TokenService.saveToken(userDto.id, tokens.refreshToken);

            return {
                ...tokens,
                user: userDto,
            };
        }

        let noName = 'User';
        lang === 'uk' && (noName = 'Користувач');

        const newUser = await UserModel.create({
            email,
            lang,
            firstName: firstName.length > 0 ? firstName : noName,
            lastName: lastName.length > 0 ? lastName : undefined,
            avatar: avatar.length > 0 ? avatar : undefined,
            isActivated: !!isActivated,
            activationLink: isActivated ? undefined : uuid.v4(),
            activationLinkExpires: isActivated ? undefined : Date.now() + LINK_WILL_EXPIRE_IN,
        });

        if (!isActivated) {
            await MailService.sendActivationMail(
                newUser.email,
                newUser.firstName,
                `${process.env.API_URL}/api/activate/${newUser.activationLink}`,
            );
        }

        const userDto = new UserDto(newUser);
        const tokens = TokenService.generateToken({ ...userDto });
        await TokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    };

    async login(email, password, lang) {
        const user = await UserModel.findOne({ email });
        if (!user) {
            throw ApiError.BadRequest('SERVER.UserService.login: The user with the following email address was not found');
        }

        const decryptedPassword = decryptData(password);
        const isPassEquals = await bcrypt.compare(decryptedPassword, user.password);
        if (!isPassEquals) {
            throw ApiError.BadRequest('SERVER.UserService.login: Incorrect password');
        }

        user.lang = lang;

        const userDto = new UserDto(user);
        const tokens = TokenService.generateToken({ ...userDto });
        await TokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    };

    async logout(refreshToken) {
        const token = await TokenService.removeToken(refreshToken);
        return token;
    };

    async refresh(refreshToken) {
        if (!refreshToken) {
            throw ApiError.UnauthorizedError();
        }

        const userData = TokenService.validateRefreshToken(refreshToken);
        const tokenFromDb = await TokenService.findToken(refreshToken);
        if (!userData || !tokenFromDb) {
            throw ApiError.UnauthorizedError();
        }

        const user = await UserModel.findById(userData.id);
        const userDto = new UserDto(user);
        const tokens = TokenService.generateToken({ ...userDto });
        await TokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    };

    async forgotPassword(email, lang) {
        const user = await UserModel.findOne({ email });
        if (!user) {
            throw ApiError.BadRequest('SERVER.UserService.forgotPassword: The user with the following email address was not found');
        }

        const passwordResetLink = uuid.v4();
        await MailService.sendPasswordResetMail(
            lang,
            email,
            user.firstName,
            `${process.env.CLIENT_URL}/change-forgotten-password/${passwordResetLink}`,
        );

        user.passwordResetLink = passwordResetLink;
        user.passwordResetLinkExpires = Date.now() + LINK_WILL_EXPIRE_IN;

        await user.save();

        return user.email;
    };

    async changeForgottenPassword(passwordResetLink, newPassword) {
        const user = await UserModel.findOne({ passwordResetLink });
        if (!user) {
            throw ApiError.BadRequest('SERVER.UserService.changeForgottenPassword: Incorrect link to change password');
        }

        if (user.passwordResetLinkExpires < Date.now()) {
            throw ApiError.BadRequest('SERVER.UserService.changeForgottenPassword: The link to change your password is no longer valid');
        }

        const decryptedNewPassword = decryptData(newPassword);
        const hashedPassword = await bcrypt.hash(decryptedNewPassword, 3);
        user.password = hashedPassword;

        user.passwordResetLink = undefined;
        user.passwordResetLinkExpires = undefined;

        await user.save();

        return user.email;
    };

    async changePassword(userId, oldPassword, newPassword, refreshToken) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest(`SERVER.UserService.changePassword: User with ID: “${userId}” not found`);
        }

        const decryptedOldPassword = decryptData(oldPassword);
        if (user.password && user.password.length > 0) {
            const isPassEquals = await bcrypt.compare(decryptedOldPassword, user.password);
            if (!isPassEquals) {
                throw ApiError.BadRequest('SERVER.UserService.changePassword: Incorrect old password');
            }
        }

        const decryptedNewPassword = decryptData(newPassword);
        const hashedPassword = await bcrypt.hash(decryptedNewPassword, 3);
        user.password = hashedPassword;

        await user.save();

        const token = await TokenService.removeToken(refreshToken);
        return token;
    };

    async changeLang(userId, lang) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest(`SERVER.UserService.changeLang: User with ID: “${userId}” not found`);
        }

        user.lang = lang;
        await user.save();

        return new UserDto(user);
    };

    async changeShowedInfo(userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest(`SERVER.UserService.changeShowedInfo: User with ID: “${userId}” not found`);
        }

        user.showedInfo = true;
        await user.save();

        return new UserDto(user);
    };

    async changeFirstLoaded(userId) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest(`SERVER.UserService.changeFirstLoaded: User with ID: “${userId}” not found`);
        }

        user.firstLoaded = true;
        await user.save();

        return new UserDto(user);
    };

    async updateMyUser(userId, firstName, lastName, birthday, avatar) {
        const user = await UserModel.findById(userId);
        if (!user) {
            throw ApiError.BadRequest(`SERVER.UserService.updateMyUser: User with ID: “${userId}” not found`);
        }

        user.firstName = firstName;
        user.lastName = lastName;
        user.birthday = birthday;
        avatar !== null && (user.avatar = avatar);
        await user.save();

        return new UserDto(user);
    };

    async addFriend(myId, friendId) {
        const myUser = await UserModel.findById(new ObjectId(myId));
        if (!myUser) {
            throw ApiError.BadRequest(`SERVER.UserService.addFriend: User with ID: “${myId}” not found`);
        }

        const friendUser = await UserModel.findById(new ObjectId(friendId));
        if (!friendUser) {
            throw ApiError.BadRequest(`SERVER.UserService.addFriend: User with ID: “${friendId}” not found`);
        }

        if (myUser.followFrom.includes(friendUser.id) && friendUser.followTo.includes(myUser.id)) {
            myUser.friends.push(friendUser.id);
            myUser.followFrom = myUser.followFrom.filter((id) => id.toString() !== friendUser.id);
            friendUser.friends.push(myUser.id);
            friendUser.followTo = friendUser.followTo.filter((id) => id.toString() !== myUser.id);
        } else {
            myUser.followTo.push(friendUser.id);
            friendUser.followFrom.push(myUser.id);
        }

        await myUser.save();
        await friendUser.save();

        return new UserDto(myUser);
    };

    async removeFriend(myId, friendId, whereRemove) {
        const myUser = await UserModel.findById(new ObjectId(myId));
        if (!myUser) {
            throw ApiError.BadRequest(`SERVER.UserService.removeFriend: User with ID: “${myId}” not found`);
        }

        const friendUser = await UserModel.findById(new ObjectId(friendId));
        if (!friendUser) {
            throw ApiError.BadRequest(`SERVER.UserService.removeFriend: User with ID: “${friendId}” not found`);
        }

        if (whereRemove === 'friends') {
            myUser.friends = myUser.friends.filter(id => id.toString() !== friendUser.id);
            friendUser.friends = friendUser.friends.filter(id => id.toString() !== myUser.id);
        }

        if (whereRemove === 'followTo') {
            if (myUser.friends.includes(friendUser.id) && friendUser.friends.includes(myUser.id)) {
                myUser.friends = myUser.friends.filter(id => id.toString() !== friendUser.id);
                friendUser.friends = friendUser.friends.filter(id => id.toString() !== myUser.id);
                myUser.followFrom.push(friendUser.id);
                friendUser.followTo.push(myUser.id);
            }

            if (myUser.followTo.includes(friendUser.id) && friendUser.followFrom.includes(myUser.id)) {
                myUser.followTo = myUser.followTo.filter(id => id.toString() !== friendUser.id);
                friendUser.followFrom = friendUser.followFrom.filter(id => id.toString() !== myUser.id);
            }
        }

        if (whereRemove === 'followFrom') {
            if (myUser.friends.includes(friendUser.id) && friendUser.friends.includes(myUser.id)) {
                myUser.friends = myUser.friends.filter(id => id.toString() !== friendUser.id);
                friendUser.friends = friendUser.friends.filter(id => id.toString() !== myUser.id);
                myUser.followTo.push(friendUser.id);
                friendUser.followFrom.push(myUser.id);
            }

            if (myUser.followFrom.includes(friendUser.id) && friendUser.followTo.includes(myUser.id)) {
                myUser.followFrom = myUser.followFrom.filter(id => id.toString() !== friendUser.id);
                friendUser.followTo = friendUser.followTo.filter(id => id.toString() !== myUser.id);
            }
        }

        await myUser.save();
        await friendUser.save();

        return new UserDto(myUser);
    };

    async deleteMyUser(userId, email, password) {
        const userToBeDeleted = await UserModel.findOne({ email });
        if (!userToBeDeleted) {
            throw ApiError.BadRequest('SERVER.UserService.deleteMyUser: The user with the following email address was not found');
        }

        if (userToBeDeleted._id.toString() !== userId) {
            throw ApiError.BadRequest('SERVER.UserService.deleteMyUser: Data entry error');
        }

        if (userToBeDeleted.password && userToBeDeleted.password.length > 0) {
            const decryptedPassword = decryptData(password);
            const isPassEquals = await bcrypt.compare(decryptedPassword, userToBeDeleted.password);
            if (!isPassEquals) {
                throw ApiError.BadRequest('SERVER.UserService.deleteMyUser: Incorrect password');
            }
        }

        const deletedUser = await UserModel.findByIdAndDelete(userId);
        if (!deletedUser) {
            throw ApiError.BadRequest(`SERVER.UserService.deleteMyUser: Could not delete user with ID: “${userId}”`);
        }

        await TokenModel.deleteOne({ user: deletedUser._id });

        for (const wishId of deletedUser.wishList) {
            await WishModel.findByIdAndDelete(wishId);
        }

        const deletedUserPath = await AwsService.deleteFile(`user-${deletedUser._id}`);
        if (deletedUserPath.length !== 0) {
            throw ApiError.BadRequest('SERVER.UserService.deleteMyUser: Could not delete all user files');
        }

        return deletedUser._id;
    };

    async getUsers(page, limit, myUserId, userType, search) {
        let query = {};

        // Додати фільтрацію за типом користувача (userType)
        if (userType !== 'all') {
            switch (userType) {
                case 'friends':
                    query = { friends: myUserId };
                    break;
                case 'followTo':
                    query = { followFrom: myUserId }; // я за ними слідкую
                    break;
                case 'followFrom':
                    query = { followTo: myUserId }; // вони за мною слідкують
                    break;
                default:
                    break;
            }
        }

        // Додати пошук за ім'ям
        if (search) {
            query.$or = [
                { firstName: { $regex: search, $options: 'i' } },
                { lastName: { $regex: search, $options: 'i' } },
            ];
        }

        // Виключити користувача, який робить запит
        query._id = { $ne: myUserId };

        const skip = (page - 1) * limit;

        // Виконати запит до бази даних
        const users = await UserModel.find(query)
            .sort({ updatedAt: -1 })
            .skip(skip)
            .limit(limit);

        const usersDto = users.map(user => new UserDto(user));

        const followFromCount = await UserModel.countDocuments({ followTo: myUserId }); // кількість користувачів, які слідкують за мною

        return {
            followFromCount,
            users: usersDto,
        };
    };
}

module.exports = new UserService();
