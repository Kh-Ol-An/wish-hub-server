const { Schema, model } = require('mongoose');

const ImageSchema = new Schema({
    path: { type: String },
    position: { type: Number },
    delete: { type: Boolean, default: false },
});

const WishSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    material: { type: Boolean, required: true },
    show: { type: String, required: true, enum: ['all', 'friends', 'nobody'] },
    name: { type: String, required: true },
    price: {
        type: String,
        required: function() {
            return this.material;
        }
    },
    currency:  { type: String, enum: ['UAH', 'USD', 'EUR'] },
    address:  { type: String },
    description: { type: String },
    executed: { type: Boolean, default: false },
    images: [ImageSchema],
    booking: {
        userId: { type: Schema.Types.ObjectId, ref: 'User' },
        start: { type: Date },
        end: { type: Date }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

WishSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = model('Wish', WishSchema);
