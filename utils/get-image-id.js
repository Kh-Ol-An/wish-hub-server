const getImageId = (url) => {
    const urlWithoutProtocol = url.replace('https://', '');
    const imageName = urlWithoutProtocol.split('/')[3];
    return imageName.split('_')[0];
};

module.exports = getImageId;
