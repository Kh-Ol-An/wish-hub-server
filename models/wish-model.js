const { Schema, model } = require('mongoose');

const WishSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    price: { type: String },
    description: { type: String },
    images: { type: String },
});

module.exports = model('Wish', WishSchema);
