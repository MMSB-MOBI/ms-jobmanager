import jmClient from '../client';
import { logger, setLogLevel } from '../logger';
import { Readable } from 'stream';

setLogLevel("info");
logger.warn("Input w/ file and stream usage");


const port = 2020;
const TCPip = "127.0.0.1";

const my_stream:Readable = new Readable();
my_stream.push('beep');
my_stream.push(null);
const oneInputFile = `${__dirname}/data/file.txt`

const inputs = {
    "file_from_stream.log" : my_stream,
    "file_from_file.txt" : oneInputFile
};
const cmd = 'ls input/';
(async() => {
    try {
        await jmClient.start(TCPip, port);       
        try {
            const stdout  = await jmClient.push({ cmd, inputs });
            logger.info(`Job standard output :: ${stdout}`) 
        } catch(e) {          
            console.log(e); 
        }       
    } catch(e) {      
        console.log(e);
    }
})().then( ()=> process.exit())