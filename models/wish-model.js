const { Schema, model } = require('mongoose');

const ImageSchema = new Schema({
    id: { type: String },
    path: { type: String },
});

const WishSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    price: { type: String },
    description: { type: String },
    images: [ImageSchema],
});

module.exports = model('Wish', WishSchema);
