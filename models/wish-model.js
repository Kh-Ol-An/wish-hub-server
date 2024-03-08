const { Schema, model } = require('mongoose');

const ImageSchema = new Schema({
    path: { type: String },
    position: { type: Number },
    delete: { type: Boolean, default: false },
});

const WishSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User' },
    material: { type: Boolean, required: true },
    show: { type: String, required: true, enum: ['all', 'friends', 'nobody'] },
    name: { type: String, required: true },
    price: {
        type: String,
        required: function() {
            return this.material;
        }
    },
    link:  { type: String },
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
