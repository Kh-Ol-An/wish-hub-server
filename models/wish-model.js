const { Schema, model } = require('mongoose');

const WishSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    name: { type: String, required: true },
    price: { type: String, required: true },
    description: { type: String },
});

module.exports = model('Wish', WishSchema);
