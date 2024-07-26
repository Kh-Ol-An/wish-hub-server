const axios = require('axios');

const getExchangeRates = async () => {
    const response = await axios.get(process.env.CURRENCY_EXCHANGE_URL);
    // ***** fixer.io ***** //
    // if (response.data.success) {
    //     return response.data.rates;
    // } else {
    //     throw new Error('Failed to fetch exchange rates');
    // }
    // ***** fixer.io ***** //

    // ========================================================================================= //

    // ***** exchangerate-api.com ***** //
    if (response.data.result === 'success') {
        return response.data.conversion_rates;
    } else {
        throw new Error('Failed to fetch exchange rates');
    }
    // ***** exchangerate-api.com ***** //
}

const convertToBaseCurrency = async (price, currency) => {
    const exchangeRates = await getExchangeRates();
    const baseCurrency = 'USD';
    const rate = exchangeRates[currency] / exchangeRates[baseCurrency];
    return parseFloat(price) / rate;
};

module.exports = convertToBaseCurrency;
