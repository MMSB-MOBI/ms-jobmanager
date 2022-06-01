import jmClient from '../client';
import { logger, setLogLevel } from '../logger';

setLogLevel("info");
logger.warn("Input file(s) usage");
const script = `${__dirname}/data/process_input_file.sh`
const oneInputFile = `${__dirname}/data/file.txt`
logger.info(`using following shell script as template ${script}`);
//const inputs = { 'myFile' : oneInputFile };
const inputs = [ oneInputFile ];
const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);       
        const stdout  = await jmClient.push({ script, inputs });
        logger.info(`Job standard output :: ${stdout}`);
        const _  = await jmClient.push({ script:'./idonot/exist', inputs });     
    } catch(e) {
        logger.error(`Unable to process job ${e}`);
    }
})().then( ()=> process.exit())