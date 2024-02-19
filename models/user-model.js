const { Schema, model } = require('mongoose');

const UserSchema = new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    birthday: { type: Date },
    avatar: { type: String },
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
