const CryptoJS = require('crypto-js');

const encryptData = data => CryptoJS.AES.encrypt(data, process.env.CRYPTO_JS_SECRET).toString();

const decryptData = data => {
    console.log('decryptData')
    try {
        const decrypted = CryptoJS.AES.decrypt(data, process.env.CRYPTO_JS_SECRET).toString(CryptoJS.enc.Utf8);
        console.log('decrypted: ', decrypted);
        if (!decrypted) {
            throw new Error('Decryption failed');
        }
        return decrypted;
    } catch (error) {
        return data;
    }
};

module.exports = {
    encryptData,
    decryptData,
};
