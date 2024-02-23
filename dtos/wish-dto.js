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
        this.images = model.images;
        this.createdAt = model.createdAt;
        this.updatedAt = model.updatedAt;
    }
}

module.exports = WishDto;
