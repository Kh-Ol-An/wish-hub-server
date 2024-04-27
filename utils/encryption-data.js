const CryptoJS = require('crypto-js');

const encryptedData = data => CryptoJS.AES.encrypt(data, process.env.CRYPTO_JS_SECRET).toString();

const decryptedData = data => {
//    try {
//        const decrypted = CryptoJS.AES.decrypt(data, process.env.CRYPTO_JS_SECRET).toString(CryptoJS.enc.Utf8);
//        if (!decrypted) {
//            throw new Error('Decryption failed');
//        }
//        return decrypted;
//    } catch (error) {
//        return data;
//    }
//    *******************************************************
    return CryptoJS.AES.decrypt(data, process.env.CRYPTO_JS_SECRET).toString(CryptoJS.enc.Utf8) || data;
};

module.exports = {
    encryptedData,
    decryptedData,
};
