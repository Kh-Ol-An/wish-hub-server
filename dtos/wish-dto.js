const { encryptData } = require('../utils/encryption-data');

const dataDto = (show, data) => {
    if (data?.length > 0) {
        if (show === 'all') {
            return data;
        }

        return encryptData(data);
    }

    return data;
};

class ImageDto {
    id;
    path;
    position;
    delete;

    constructor(model) {
        this.id = model._id;
        this.path = model.path;
        this.position = model.position;
        this.delete = model.delete;
    }
}

class BookingDto {
    userId;
    start;
    end;

    constructor(model) {
        this.userId = model.userId;
        this.start = model.start;
        this.end = model.end;
    }
}

class WishDto {
    id;
    userId;
    material;
    show;
    name;
    price;
    currency;
    address;
    description;
    executed;
    images;
    createdAt;
    updatedAt;

    constructor(model) {
        this.id = model._id;
        this.userId = model.userId;
        this.material = model.material;
        this.show = model.show;
        this.name = model.name;
        this.price = dataDto(model.show, model.price);
        this.currency = dataDto(model.show, model.currency);
        this.address = model.address;
        this.description = model.description;
        this.executed = model.executed;
        this.images = model.images.map(image => new ImageDto(image));
        this.booking = model.booking ? new BookingDto(model.booking) : null;
        this.createdAt = model.createdAt;
        this.updatedAt = model.updatedAt;
    }
}

module.exports = WishDto;
