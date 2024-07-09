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
    images;
    price;
    currency;
    addresses;
    description;
    executed;
    booking;
    likes;
    dislikes;

    constructor(model) {
        this.id = model._id;
        this.userId = model.userId;
        this.material = model.material;
        this.show = model.show;
        this.name = model.name;
        this.images = model.images.map(image => new ImageDto(image));
        this.price = dataDto(model.show, model.price);
        this.currency = dataDto(model.show, model.currency);
        this.addresses = model.addresses;
        this.description = model.description;
        this.executed = model.executed;
        this.booking = model.booking ? new BookingDto(model.booking) : null;
        this.likes = model.likes.length;
        this.dislikes = model.dislikes.length;
    }
}

module.exports = WishDto;
