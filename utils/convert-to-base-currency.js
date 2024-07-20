const axios = require('axios');

async function getExchangeRates() {
    const response = await axios.get(process.env.CURRENCY_EXCHANGE_URL);
    if (response.data.result === 'success') {
        return response.data.conversion_rates;
    } else {
        throw new Error('Failed to fetch exchange rates');
    }
}

const convertToBaseCurrency = async (price, currency) => {
    const exchangeRates = await getExchangeRates();
    const baseCurrency = 'USD';
    const rate = exchangeRates[currency] / exchangeRates[baseCurrency];
    return parseFloat(price) / rate;
};

module.exports = convertToBaseCurrency;
