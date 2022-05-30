import jmClient from '../client';
import { logger, setLogLevel } from '../logger';

setLogLevel("debug");
logger.warn("Basic usage");
const script = `${__dirname}/data/hello.sh`
logger.info(`using following shell script as template ${script}`);
const exportVar = { "sleepTime" : "5" };

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);       
        const stdout  = await jmClient.push({ script, exportVar });
        logger.info(`Job standard output:: ${stdout}`);

    } catch(e) {
        logger.error(`Unable to process job ${e}`);
    }
})().then( ()=> process.exit())