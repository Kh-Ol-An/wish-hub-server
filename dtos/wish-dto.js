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


class WishDto {
    id;
    name;
    price;
    description;
    images;
    createdAt;
    updatedAt;

    constructor(model) {
        this.id = model._id;
        this.name = model.name;
        this.price = model.price;
        this.description = model.description;
        this.images = model.images.map(image => new ImageDto(image));
        this.createdAt = model.createdAt;
        this.updatedAt = model.updatedAt;
    }
}

module.exports = WishDto;
