const crypto = require('crypto');

const generateFileId = (buffer) => {
    if (!buffer) {
        return '';
    }
    const hash = crypto.createHash('md5');
    hash.update(buffer);
    return hash.digest('hex');
};

module.exports = generateFileId;
