class UserDto {
    name;
    email;
    birthday;
    avatar;
    createdAt;
    updatedAt;
    id;
    isActivated;

    constructor(model) {
        this.name = model.name;
        this.email = model.email;
        this.birthday = model.birthday;
        this.avatar = model.avatar;
        this.createdAt = model.createdAt;
        this.updatedAt = model.updatedAt;
        this.id = model._id;
        this.isActivated = model.isActivated;
    }
}

module.exports = UserDto;
