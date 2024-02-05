class UserDto {
    name;
    email;
    birthday;
    id;
    isActivated;

    constructor(model) {
        this.name = model.name;
        this.email = model.email;
        this.birthday = model.birthday;
        this.id = model._id;
        this.isActivated = model.isActivated;
    }
}

module.exports = UserDto;
