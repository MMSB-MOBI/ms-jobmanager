import jmClient from '../client';
import { logger, setLogLevel } from '../logger';
import { Readable } from 'stream';

setLogLevel("info");
logger.warn("Input file(s) usage");
const script = `${__dirname}/data/process_input_file.sh`
const oneInputFile = `${__dirname}/data/file.txt`
logger.info(`using following shell script as template ${script}`);
//const inputs = { 'myFile' : oneInputFile };
//const inputs = [ oneInputFile ];
const port = 2020;
const TCPip = "127.0.0.1";

const my_stream:Readable = new Readable();
my_stream.push('beep');
my_stream.push(null);

const inputs = {
    "file.log" : my_stream,
    
};
const cmd = 'sleep 2;cat input/file.log';

(async() => {
    try {
        await jmClient.start(TCPip, port);       
        //const stdout  = await jmClient.push({ script, inputs });
        const stdout  = await jmClient.push({ cmd, inputs });
        logger.info(`Job standard output :: ${stdout}`);
        //const _  = await jmClient.push({ script:'./idonot/exist', inputs });
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
        console.log("###1)");
        console.log(e);
    }
})().then( ()=> process.exit())