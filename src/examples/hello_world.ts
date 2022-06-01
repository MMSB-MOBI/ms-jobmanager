import jmClient from '../client';
import { logger, setLogLevel } from '../logger';

setLogLevel("debug");
logger.warn("Basic usage");
const script = `${__dirname}/data/hello.sh`
const cmd = "hello world !"
logger.info(`using following shell script as template ${script}`);
const exportVar = { "sleepTime" : "5" };

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);       
        const stdout  = await jmClient.push({ script, exportVar });
        logger.info(`Job script standard output:: ${stdout}`);
        const stdout2  = await jmClient.push({ cmd, exportVar });
        logger.info(`Job command standard output:: ${stdout2}`);

    } catch(e) {
        logger.error(`Unable to process job ${e}`);
    }
})().then( ()=> process.exit())