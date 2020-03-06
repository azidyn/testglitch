const crypto = require('crypto');
const querystring = require("querystring");
const fetch = require('node-fetch');

/*
  
To help improve responsiveness during high-load periods, the BitMEX trading engine will begin load-shedding when requests reach a 
  critical queue depth. When this happens, you will quickly receive a 503 status code with the 
  JSON payload {"error": {"message": "The system is currently overloaded. Please try again later.", "name": "HTTPError"}}. 
  The request will not have reached the engine, and you should retry after at least 500 milliseconds.

*/

const API_PATH = '/api/v1';

class BitMEXRest
{
  constructor( opts )
  {
    this.url = opts.url;
    this.key = opts.api_id;
    this.secret = opts.api_secret;
    
  }

  async lob( symbol, depth )
  {        
      let url = `${this.url}${API_PATH}/orderBook/L2?symbol=${symbol}&depth=${depth}`;
      let res = await ( await( fetch( url ) ) ).json();        
      return SORT_LOB( res, depth );
  }


  async instrument(symbol)
  {
    let body = {};

    let verb  = 'GET';
    let path  = `${API_PATH}/instrument?symbol=${symbol}&count=1`;
    let sbody = JSON.stringify(body);
    let url   = `${this.url}${path}`;

    const req = {
      headers: this._header(verb, path, 0, sbody),      
      method: verb,
      body: sbody
    };

    let res = await fetch( url, reqopts );

    return await this.handle_response( res );
 
  }

  async balance()
  {
    let body  = {};

    let verb  = 'GET';
    let path  = `${API_PATH}/user/margin`;    
    let sbody = '';
    let url   = `${this.url}${path}`;

    const reqopts = {
      headers: this._header(verb, path, 0, sbody),
      method: verb
    };

    let res = await fetch( url, reqopts );

    return await this.handle_response( res );
  
  }

  async postonly( symbol, quantity, price, side, opts={} )
  {
    let body = {
        ordType:    'Limit',
        execInst:   'ParticipateDoNotInitiate', 
        symbol:     symbol,
        price: price,
        side: side,
        orderQty: quantity
    };

    Object.assign( body, opts );

    let verb  = 'POST';
    let path  = `${API_PATH}/order`;
    let sbody = JSON.stringify(body)
    const url = `${this.url}${path}`;

    const reqopts = {
      method: verb,
      headers: this._header( verb, path, 0, sbody ),
      body: sbody,      
    }

    let res = await fetch( url, reqopts );

    return await this.handle_response( res );

  }

  async setleverage( symbol, leverage, opts={} )
  {
    let body = {
        symbol: symbol,
        leverage: leverage
    };

    Object.assign( body, opts );

    let verb    = 'POST';
    let path    = `${API_PATH}/position/leverage`;
    let sbody   = JSON.stringify(body)
    let url     = `${this.url}${path}`;

    const req = {
      headers: this._header( verb, path, 0, sbody ),      
      method: verb,
      body: sbody
    };
    
    let res = await fetch( url, req )

    return await this.handle_response( res );

  }


  async limit( symbol, quantity, price, side, opts={} )
  {
    let body = {
        ordType:    'Limit',
        symbol:     symbol,
        price: price,
        side: side,
        orderQty: quantity
    };

    Object.assign( body, opts );

    let verb    = 'POST';
    let path    = `${API_PATH}/order`;
    let sbody   = JSON.stringify(body)
    let url     = `${this.url}${path}`;

    const req = {
      headers: this._header( verb, path, 0, sbody ),      
      method: verb,
      body: sbody
    };
    
    let res = await fetch( url, req )

    return await this.handle_response( res );

  }

  async amend( orderID, origClOrdID, opts={} )
  {

    console.error(`amend() orders not implemented.`)
    return;

    // FIXME: THIS DOES NOT WORK.

    let body = {
      origClOrdID: origClOrdID,
      orderID: orderID,
    };

    Object.assign( body, opts );

    let bulk = {
      orders: [ body ]
    };

    let verb    = 'PUT`';
    let path    = `${API_PATH}/order/bulk`;
    let sbody   = JSON.stringify( bulk )
    let url     = `${this.url}${path}`;

    const req = {
      headers: this._header( verb, path, 0, sbody ),      
      method: verb,
      body: sbody
    };
    
    let res = await fetch( url, req )

    return await this.handle_response( res );

  }

  async marketclose( symbol, opts={}  )
  {
    // Get any existing position
    let position = await this.position( symbol );
    
    // No position? Nothing to close, abort.
    if ( !position.isOpen )      
      return null;
    
    let body = {
        ordType:    'Market',
        execInst:   'Close', 
        symbol:     symbol,
        orderQty: -position.currentQty // Take the other side
    };

    Object.assign( body, opts );

    let verb  = 'POST';
    let path  = `${API_PATH}/order`;
    let sbody = JSON.stringify(body);
    let url   = `${this.url}${path}`;

    const req = {
      headers: this._header( verb, path, 0, sbody ),      
      method: verb,
      body: sbody
    };

    let res = await fetch( url, req )

    return await this.handle_response( res );

  }    

  async marketstop( symbol, price, side, opts={} )
  {
    let execInst = ['Close'];
    
    // Add any additional exec instructions. e.g. bitmex accepts execInst like: 'Close,MarkPrice' 
    if ( opts.execInst )
    {
      if ( Array.isArray( opts.execInst ))
        for ( let e of opts.execInst ) execInst.push( e )

      delete opts.execInst;
    }

    let body = {
        ordType:    'Stop',
        execInst:   execInst.join(','), 
        symbol:     symbol,
        stopPx: price,
        side: side,
    };

    
    Object.assign( body, opts );

    let verb  = 'POST';
    let path  = `${API_PATH}/order`;
    let sbody = JSON.stringify(body);
    let url   = `${this.url}${path}`;

    const req = {
      headers: this._header( verb, path, 0, sbody ),      
      method: verb,
      body: sbody
    };

    let res = await fetch( url, req )

    return await this.handle_response( res );

  }  

  async marketorder( symbol, side, quantity, opts={} )
  {    

    let body = {
        ordType:    'Market',
        symbol:     symbol,
        side:       side,
        orderQty:   quantity
    };

    Object.assign( body, opts );

    let verb  = 'POST';
    let path  = `${API_PATH}/order`;
    let sbody = JSON.stringify(body);
    let url   = `${this.url}${path}`;

    const req = {
      headers: this._header( verb, path, 0, sbody ),      
      method: verb,
      body: sbody
    };

    let res = await fetch( url, req );
    return await this.handle_response( res );

  }  

  async cancelorders( symbol, opts={} )
  {
    let body = {
        symbol: symbol
    };

    Object.assign( body, opts );

    let verb  = 'DELETE';
    let path  = `${API_PATH}/order/all`;
    let sbody = JSON.stringify(body);
    const url = `${this.url}${path}`;

    const reqopts = {
      method: verb,
      headers: this._header( verb, path, 0, sbody ),
      body: sbody,      
    }

    let res = await fetch( url, reqopts );

    return await this.handle_response( res );

  }

  async cancelsingleorder( clOrdID, orderID, opts={} )
  {
    let body = {};
    
    if ( clOrdID ) 
      body.clOrdID = clOrdID;
    else
      body.orderID = orderID;

    Object.assign( body, opts );

    let verb  = 'DELETE';
    let path  = `${API_PATH}/order`;
    let sbody = JSON.stringify(body);
    const url = `${this.url}${path}`;

    const reqopts = {
      method: verb,
      headers: this._header( verb, path, 0, sbody ),
      body: sbody,      
    }

    let res = await fetch( url, reqopts );

    return await this.handle_response( res );

  }

  async position( sym )
  {
    let f = {
      symbol: sym,
    };    

    let filter = `filter=` + encodeURIComponent( `${ JSON.stringify( f )}` );

    let verb = 'GET';
    let path = `${API_PATH}/position?${filter}`;
    let url = `${this.url}${path}`;

    const req = {
      headers: this._header(verb, path, 0, ''),
      method: verb
    };

    let res = await fetch( url, req );

    return await this.handle_response( res );

  }


  async openorders( sym )
  {
    let f = {
      symbol: sym,
      open: true
    };    

    let filter = `filter=` + encodeURIComponent( `${ JSON.stringify( f )}` );
    
    let verb = 'GET';
    let path = `${API_PATH}/order?${filter}`;
    let url = `${this.url}${path}`;

    const req = {
      headers: this._header(verb, path, 0, ''),
      method: verb
    };

    let res = await fetch( url, req );

    return await this.handle_response( res );

  }


  async handle_response( res )
  {

    if ( not_ok( res.status ) )
    {
      let msg = 'Unknown error';
      try { 
        let p = await res.json();
        msg = p.error ? ( p.error.message || 'Unknown BitMEX API error status' ) : 'Unknown BitMEX API error'         
      } catch {
        msg = 'Unknown error (not a JSON response)';
      }

      throw new Error( msg );
      
    }

    let obj = await res.json();      

    if ( Array.isArray( obj ) )
      if (obj.length == 1) obj = obj[0]

    return obj;
  }


  

  _header(verb, path, expires=0, body='')
  {
    // 5 minute expiry, plenty of time to let the order be processed
    expires = expires || Math.round(new Date().getTime() / 1000) + 5; 
    let signature = this._signature(verb, path, expires, body);

    return {
      'content-type' : 'application/json',
      'Accept': 'application/json',
      'X-Requested-With': 'XMLHttpRequest',
      'api-expires': expires,
      'api-key': this.key,
      'api-signature': signature
    };
  }

  _signature(verb, path, expires=0, body={})
  {
    return crypto.createHmac('sha256', this.secret).update(verb + path + expires + body).digest('hex');
  }
}

// Make sure order book is sorted
function SORT_LOB( book, depth=5 )
{
    let sell = book.filter( r => r.side == 'Sell');
    let buy = book.filter( r => r.side == 'Buy');
    
    return { 
        offer: (sell.sort( (a, b) => a.price - b.price )).slice( 0, depth ),
        bid: (buy.sort( (a, b) => b.price - a.price )).slice( 0, depth )
    }
    
}

module.exports = BitMEXRest;


function not_ok( http_status_code )
{

  if ( http_status_code < 200 || http_status_code > 202 )
    return true;
  
  return false;

}