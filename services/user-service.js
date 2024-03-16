const { ObjectId } = require('mongoose').Types;
const bcrypt = require('bcrypt');
const uuid = require('uuid');
const UserModel = require('../models/user-model');
const mailService = require('./mail-service');
const tokenService = require('./token-service');
const UserDto = require('../dtos/user-dto');
const ApiError = require('../exceptions/api-error');
const { ACTIVATION_LINK_WILL_EXPIRE_IN } = require('../utils/variables');

class UserService {
    async registration(firstName, email, password) {
        const candidate = await UserModel.findOne({ email });
        if (candidate) {
            throw ApiError.BadRequest(`Користувач з електронною адресою ${email} вже існує`);
        }

        const hashPassword = await bcrypt.hash(password, 3);
        const activationLink = uuid.v4();

        const user = await UserModel.create({ firstName, email, password: hashPassword, activationLink });
        await mailService.sendActivationMail(email, firstName, `${process.env.API_URL}/api/activate/${activationLink}`);

        const userDto = new UserDto(user);
        const tokens = tokenService.generateToken({ ...userDto });
        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    }

    async activate(activationLink) {
        const user = await UserModel.findOne({ activationLink });
        if (!user) {
            throw ApiError.BadRequest('Невірне посилання для активації');
        }

        if (user.activationLinkExpires < Date.now()) {
            return user.isActivated;
        }

        user.isActivated = true;
        user.activationLink = null;
        user.activationLinkExpires = null;
        await user.save();
        return user.isActivated;
    }

    async generateActivationLink(userId) {
        const user = await UserModel.findOne(new ObjectId(userId));
        if (!user) {
            throw ApiError.BadRequest(`Користувача з id: "${userId}" не знайдено`);
        }

        if (user.isActivated) return;

        let activationLink = user.activationLink;
        if (!user.activationLink) {
            activationLink = uuid.v4();
        }

        await mailService.sendActivationMail(user.email, user.firstName, `${process.env.API_URL}/api/activate/${activationLink}`);

        user.isActivated = false;
        user.activationLink = activationLink;
        user.activationLinkExpires = Date.now() + ACTIVATION_LINK_WILL_EXPIRE_IN;
        await user.save();
    }

    async deleteInactiveAccounts() {
        const inactiveAccounts = await UserModel.find({
            isActivated: false,
            activationLinkExpires: { $lt: Date.now() },
        });

        for (const account of inactiveAccounts) {
            await UserModel.deleteOne({ _id: account._id });
        }
    }

    async login(email, password) {
        const user = await UserModel.findOne({ email });
        if (!user) {
            throw ApiError.BadRequest('Користувач з такою електронною адресою не знайдений');
        }

        const isPassEquals = await bcrypt.compare(password, user.password);
        if (!isPassEquals) {
            throw ApiError.BadRequest('Невірний пароль');
        }

        const userDto = new UserDto(user);
        const tokens = tokenService.generateToken({ ...userDto });
        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    }

    async logout(refreshToken) {
        const token = await tokenService.removeToken(refreshToken);
        return token;
    }

    async refresh(refreshToken) {
        if (!refreshToken) {
            throw ApiError.UnauthorizedError();
        }

        const userData = tokenService.validateRefreshToken(refreshToken);
        const tokenFromDb = await tokenService.findToken(refreshToken);
        if (!userData || !tokenFromDb) {
            throw ApiError.UnauthorizedError();
        }

        const user = await UserModel.findById(userData.id);
        const userDto = new UserDto(user);
        const tokens = tokenService.generateToken({ ...userDto });
        await tokenService.saveToken(userDto.id, tokens.refreshToken);

        return {
            ...tokens,
            user: userDto,
        };
    }

    async getAllUsers() {
        const users = await UserModel.find();
        return users.map((user) => new UserDto(user)).sort((a, b) => b.updatedAt - a.updatedAt);
    }

    async updateMyUser(id, firstName, lastName, birthday, avatar) {
        const user = await UserModel.findById(new ObjectId(id));

        if (!user) {
            throw ApiError.BadRequest(`Користувача з id: "${id}" не знайдено`);
        }
        user.firstName = firstName;
        user.lastName = lastName;
        user.birthday = birthday;
        avatar !== null && (user.avatar = avatar);
        await user.save();

        return new UserDto(user);
    }

    async addFriend(myId, friendId) {
        const myUser = await UserModel.findById(new ObjectId(myId));
        if (!myUser) {
            throw ApiError.BadRequest(`Користувача з id: "${myId}" не знайдено`);
        }

        const friendUser = await UserModel.findById(new ObjectId(friendId));
        if (!friendUser) {
            throw ApiError.BadRequest(`Користувача з id: "${friendId}" не знайдено`);
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
    }

    async removeFriend(myId, friendId, whereRemove) {
        const myUser = await UserModel.findById(new ObjectId(myId));
        if (!myUser) {
            throw ApiError.BadRequest(`Користувача з id: "${myId}" не знайдено`);
        }

        const friendUser = await UserModel.findById(new ObjectId(friendId));
        if (!friendUser) {
            throw ApiError.BadRequest(`Користувача з id: "${friendId}" не знайдено`);
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
    }
}

module.exports = new UserService();
