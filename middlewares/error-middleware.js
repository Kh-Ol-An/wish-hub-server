const ApiError = require('../exceptions/api-error');

module.exports = function (err, req, res, next) {
    console.error(err);

    if (err instanceof ApiError) {
        return res.status(err.status).json({ message: err.message, errors: err.errors });
    }

    return res.status(500).json({ message: 'Непередбачена помилка. Спробуйте ще раз. Або зв\'яжіться з нами: wish-hub@ukr.net' });
};
