class UserDto {
    id;
    email;
    firstName;
    lastName;
    avatar;
    birthday;
    wishList;
    friends;
    followFrom;
    followTo;
    isActivated;
    createdAt;
    updatedAt;

    constructor(model) {
        this.id = model._id;
        this.email = model.email;
        this.firstName = model.firstName;
        this.lastName = model.lastName;
        this.avatar = model.avatar;
        this.birthday = model.birthday;
        this.wishList = model.wishList;
        this.friends = model.friends;
        this.followFrom = model.followFrom;
        this.followTo = model.followTo;
        this.isActivated = model.isActivated;
        this.createdAt = model.createdAt;
        this.updatedAt = model.updatedAt;
    }
}

module.exports = UserDto;
