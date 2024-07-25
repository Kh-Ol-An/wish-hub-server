const { Schema, model } = require('mongoose');
const { LINK_WILL_EXPIRE_IN } = require('../utils/variables');

const UserSchema = new Schema({
    email: { type: String, required: true, unique: true },
    showEmail: { type: String, required: true, default: 'all', enum: ['all', 'friends', 'nobody'] },
    password: { type: String },
    passwordResetLink: { type: String },
    passwordResetLinkExpires: { type: Date },
    isActivated: { type: Boolean, default: false },
    activationLink: { type: String },
    activationLinkExpires: { type: Date, default: Date.now() + LINK_WILL_EXPIRE_IN },
    lang: { type: String, default: 'uk', enum: ['en', 'uk'] },
    notificationSubscription: { type: Object },
    quoteNumber: { type: Number, default: 0 },
    showedInfo: { type: Boolean, default: false },
    firstLoaded: { type: Boolean, default: false },
    firstName: { type: String, required: true },
    lastName: { type: String },
    avatar: { type: String },
    deliveryAddress: { type: String },
    showDeliveryAddress: { type: String, required: true, default: 'all', enum: ['all', 'friends', 'nobody'] },
    birthday: { type: Date },
    showBirthday: { type: String, required: true, default: 'all', enum: ['all', 'friends', 'nobody'] },
    wishList: [{ type: Schema.Types.ObjectId, ref: 'Wish' }],
    successfulWishes: { type: Number, default: 0 },
    unsuccessfulWishes: { type: Number, default: 0 },
    friends: [{ type: Schema.Types.ObjectId, ref: 'User' }], // двосторонній запит
    followFrom: [{ type: Schema.Types.ObjectId, ref: 'User' }], // слідкують за мною
    followTo: [{ type: Schema.Types.ObjectId, ref: 'User' }], // я за ними слідкую
    likedWishes: [{ type: Schema.Types.ObjectId, ref: 'Wish' }],
    dislikedWishes: [{ type: Schema.Types.ObjectId, ref: 'Wish' }],
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

UserSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

module.exports = model('User', UserSchema);
