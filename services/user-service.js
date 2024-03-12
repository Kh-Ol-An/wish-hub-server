const UserModel = require("../models/user-model");
const { ObjectId } = require('mongoose').Types;
const bcrypt = require("bcrypt");
const uuid = require("uuid");
const mailService = require("./mail-service");
const tokenService = require("./token-service");
const UserDto = require("../dtos/user-dto");
const ApiError = require("../exceptions/api-error");

class UserService {
    async registration(firstName, email, password) {
        const candidate = await UserModel.findOne({ email });
        if (candidate) {
            throw ApiError.BadRequest(`Користувач з електронною адресою ${email} вже існує`);
        }

        const hashPassword = await bcrypt.hash(password, 3);
        const activationLink = uuid.v4();

        const user = await UserModel.create({ firstName, email, password: hashPassword, activationLink });
        await mailService.sendActivationMail(email, `${process.env.API_URL}/api/activate/${activationLink}`);

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

        user.isActivated = true;
        await user.save();
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
        return users.map((user) => new UserDto(user));
    }

    async updateMyUser(id, firstName, lastName, birthday, avatar) {
        const convertedId = new ObjectId(id);
        const user = await UserModel.findById(convertedId);

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
           myUser.friends && myUser.friends.filter(friendUser.id);
           friendUser.friends && friendUser.friends.filter(myUser.id);
        }

        if (whereRemove === 'followFrom') {
           myUser.followFrom && myUser.followFrom.filter(friendUser.id);
           friendUser.followTo && friendUser.followTo.filter(myUser.id);
        }

        if (whereRemove === 'followTo') {
           myUser.followTo && myUser.followTo.filter(friendUser.id);
           friendUser.followFrom && friendUser.followFrom.filter(myUser.id);
        }

        await myUser.save();
        await friendUser.save();

        return new UserDto(myUser);
    }
}

module.exports = new UserService();
