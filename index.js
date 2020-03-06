
const express   = require('express');
const app       = express();
const port      = 3000;
const Bitmex    = require('./Bitmex');
const config    = require('./config');


// Timer delay, to make sure multiple trades aren't fired too often. 5 second delay; see config.js.
let timer = null;


// Parse json body 
app.use( express.json() );

// Send response on error 
const reject = ( res, msg ) => res.status( 400 ).send( msg );

// Probably best to just disable root response when running live
app.get('/', (req, res) => res.status( 200 ).send('Running.'));


// Could use hook `id` param to identify strategies (instead of "strategy" in JSON), or use to trade different mex accounts
// but is unused here.
app.get('/hook/:id', async ( req, res ) => {
    
    let trade =  { signature: "CHANGE_ME", "strategy": "my_strategy", "instrument": "XBTUSD", "side": "Sell", "entry": 1234.5 }

    // We just got a new trade in the last few seconds, cancel the first one and reset the timer for the newest trade instead
    if ( timer ) {        
        console.warn( 'Too many trades received. Ignoring earliest, resetting timer.' );
        clearTimeout( timer );
        timer = null;
    }

    // Process this trade after a short delay
    timer = setTimeout( process, config.TIME_OUT, trade );

    res.status( 200 ).send( "Despatched" );

});



async function process( trade )
{    

    clearTimeout( timer );
    timer = null;

    if ( trade.signature != config.SIGNATURE_STRING )
    {
        console.error( `Invalid signature string '${trade.signature}'` );
        return;
    }

    switch( trade.strategy )
    {
        case 'my_strategy':

            try {                

                await make_order( trade.instrument, trade.side );

                console.log( 'Success' );
                return;

            } catch ( e ) {

                console.error(e)
                return;

            }
            break;
        default:

            console.warn( `Unrecognized strategy '${trade.strategy}'` );
            return;            
    }


}


async function make_order( instrument, side )
{
    let bitmex = new Bitmex( config );

    // See how much margin there is to play with
    let balance = await bitmex.balance();

    // Cancel any outstanding orders on this instrument
    await bitmex.cancelorders( instrument );

    // Close any open positions immediately
    await bitmex.marketclose( instrument );
    
    // Get the best bid and offer
    let lob = await bitmex.lob( instrument, 1 );

    // Which side are we interested in eating into?
    let best = side == 'Buy' ? lob.offer[ 0 ].price : lob.bid[ 0 ].price;

    // Calculate balance in XBT (bitmex returns XBt sats)
    let balance_xbt = ( balance.availableMargin * config.XBt_TO_XBT );

    // Mul * best price in the book to get ~number of 1 USD contracts
    let quantity = best * balance_xbt;

    // Scale position size down according to our tastes
    // also shave a bit off (-10% of total contracts) to be safe and help cover some of the Hayes taker tax
    quantity = Math.floor( quantity * config.percent_of_balance * 0.9 );

    // Set to cross margin
    await bitmex.setleverage( instrument, 0 ); // 0 == 'Cross'
    
    console.log(`${Date()}  =>  ${side}ing ${quantity} ${instrument} contracts`);

    // do the market mash 
    await bitmex.marketorder( instrument, side, Math.floor( quantity ) );
    
}



app.listen(port, () => console.log(`Webhook endpoint listening on port ${port}`));