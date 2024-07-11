class UserDto {
    id;
    email;
    hasPassword;
    isActivated;
    lang;
    showedInfo;
    firstLoaded;
    firstName;
    lastName;
    avatar;
    deliveryAddress;
    birthday;
    wishList;
    successfulWishes;
    unsuccessfulWishes;
    friends;
    followFrom;
    followTo;

    constructor(model) {
        this.id = model._id;
        this.email = model.email;
        this.hasPassword = !!(model.password && model.password.length > 0);
        this.isActivated = model.isActivated;
        this.lang = model.lang;
        this.showedInfo = model.showedInfo;
        this.firstLoaded = model.firstLoaded;
        this.firstName = model.firstName;
        this.lastName = model.lastName;
        this.avatar = model.avatar;
        this.deliveryAddress = model.deliveryAddress;
        this.birthday = model.birthday;
        this.wishList = model.wishList;
        this.successfulWishes = model.successfulWishes;
        this.unsuccessfulWishes = model.unsuccessfulWishes;
        this.friends = model.friends;
        this.followFrom = model.followFrom;
        this.followTo = model.followTo;
    }
}

module.exports = UserDto;
