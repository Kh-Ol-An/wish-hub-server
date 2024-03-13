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
    user;
    material;
    show;
    name;
    price;
    address;
    description;
    images;
    createdAt;
    updatedAt;

    constructor(model) {
        this.id = model._id;
        this.user = model.user;
        this.material = model.material;
        this.show = model.show;
        this.name = model.name;
        this.price = model.price;
        this.address = model.address;
        this.description = model.description;
        this.images = model.images.map(image => new ImageDto(image));
        this.createdAt = model.createdAt;
        this.updatedAt = model.updatedAt;
    }
}

module.exports = WishDto;
