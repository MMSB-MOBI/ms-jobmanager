import jmClient from '../client';
import { logger, setLogLevel } from '../logger';
import { Readable } from 'stream';

setLogLevel("info");
logger.warn("Testing various errors managments");
const script = `${__dirname}/data/process_input_file.sh`
logger.info(`using following shell script as template ${script}`);
const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);       
       
        try {     
            console.log("Testin input error") 
            const stdout_never  = await jmClient.push({ script, inputs: {'my_input_file.pipo': ''} });  
        } catch(e) {          
            console.log(e); 
        }
        try {    
            console.log("Testing script error")  
            const stdout_never  = await jmClient.push({ script:'./idonot/exist'});  
        } catch(e) {          
            console.log(e); 
        }
    } catch(e) {
        console.log(e);
    }
})().then( ()=> process.exit())