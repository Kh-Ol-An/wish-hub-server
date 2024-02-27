const { Schema, model } = require('mongoose');

const ImageSchema = new Schema({
    path: { type: String },
    name: { type: String },
});

const WishSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    price: { type: String, required: true },
    description: { type: String },
    images: [ImageSchema],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

WishSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = model('Wish', WishSchema);
