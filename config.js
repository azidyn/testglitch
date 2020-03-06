

const USE_TESTNET = true;

module.exports = {

    percent_of_balance: 0.5,            // trade with 50% account balance position
    TIME_OUT: 5 * 1000,                 // Wait 5 seconds before placing a trade, if another new trade arrives within that time, cancel the first one
    SIGNATURE_STRING: 'CHANGE_ME',      // Make sure this is set in the tradingview alert 

    url: USE_TESTNET ? 'https://testnet.bitmex.com' : 'https://www.bitmex.com',
    api_id: 'E6NIAkqmySdvXzMnk1er1k1J',
    api_secret: 'CVzPP6_I6YkD_C93ZrhA16DmOeaqNjvMDlppx-96jy2mMkv1',
    XBt_TO_XBT: 1 / 100000000


    
    
};
