class UserDto {
    id;
    email;
    firstName;
    lastName;
    avatar;
    birthday;
    wishList;
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
        this.isActivated = model.isActivated;
        this.createdAt = model.createdAt;
        this.updatedAt = model.updatedAt;
    }
}

module.exports = UserDto;
