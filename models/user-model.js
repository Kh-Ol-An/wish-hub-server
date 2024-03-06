const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    lastName: { type: String },
    avatar: { type: String },
    birthday: { type: Date },
    wishList: [{ type: Schema.Types.ObjectId, ref: 'Wish' }],
    isActivated: { type: Boolean, default: false },
    activationLink: { type: String },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

UserSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});


module.exports = model('User', UserSchema);
