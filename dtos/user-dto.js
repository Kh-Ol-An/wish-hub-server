class UserDto {
    id;
    email;
    firstName;
    lastName;
    avatar;
    birthday;
    wishList;
    friends;
    friendReqFrom;
    friendReqTo;
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
        this.friendReqFrom = model.friendReqFrom;
        this.friendReqTo = model.friendReqTo;
        this.isActivated = model.isActivated;
        this.createdAt = model.createdAt;
        this.updatedAt = model.updatedAt;
    }
}

module.exports = UserDto;
