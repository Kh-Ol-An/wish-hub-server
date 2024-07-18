const { Schema, model } = require('mongoose');

const ImageSchema = new Schema({
    path: { type: String },
    position: { type: Number },
    delete: { type: Boolean, default: false },
});

const AddressSchema = new Schema({
    id: { type: String, required: true },
    value: { type: String, required: true }
}, { _id: false });

const BookingSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    start: { type: Date },
    end: { type: Date }
}, { _id: false });

const LikeSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    userAvatar: { type: String },
    userFullName: { type: String }
}, { _id: false });

const WishSchema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: 'User' },
    material: { type: Boolean, required: true },
    show: { type: String, required: true, enum: ['all', 'friends', 'nobody'] },
    name: { type: String, required: true },
    images: [ImageSchema],
    price: {
        type: String,
        required: function() {
            return this.material;
        }
    },
    currency:  { type: String, enum: ['UAH', 'USD', 'EUR'] },
    addresses:  [AddressSchema],
    description: { type: String },
    executed: { type: Boolean, default: false },
    booking: BookingSchema,
    likes: [LikeSchema],
    dislikes: [LikeSchema],
    sortByLikes: { type: Number },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

WishSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = model('Wish', WishSchema);
