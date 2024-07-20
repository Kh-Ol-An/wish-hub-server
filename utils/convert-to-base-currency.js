const axios = require('axios');

async function getExchangeRates() {
    const response = await axios.get(`http://data.fixer.io/api/latest?access_key=${process.env.FIXER_API_KEY}`);
    if (response.data.success) {
        return response.data.rates;
    } else {
        throw new Error('Failed to fetch exchange rates');
    }
}

const convertToBaseCurrency = async (price, currency) => {
    const exchangeRates = await getExchangeRates();
    console.log('exchangeRates: ', exchangeRates);
    console.log('price: ', price);
    const baseCurrency = 'USD';
    const rate = exchangeRates[currency] / exchangeRates[baseCurrency];
    console.log('rate: ', rate);
    return parseFloat(price) / rate;
};

module.exports = convertToBaseCurrency;
