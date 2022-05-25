/*
import jmClient from '../client';
import { Readable } from 'stream';
import { logger, setLogLevel } from '../logger';

setLogLevel("info");
logger.warn("Testing FS interface");
const script = `${__dirname}/data/hello.sh`
console.log(script);
const exportVar = { "sleepTime" : "5" };

const port = 2020;
const TCPip = "127.0.0.1";


(async() => {
    try {
        await jmClient.start(TCPip, port);

        const { stdout, jobFS } = await jmClient.pushFS({ script, exportVar })
        logger.info(`Job standard output:: ${stdout}`);
        const fsItems:string[] = await jobFS.list();
        logger.info(`Listed items at root of job work directory are :\n-${fsItems.join("\n-")}`);
        const contentStream =  await jobFS.read(fsItems[0]);
        const _  = await streamToString(contentStream);
        console.log(`File content of ${fsItems[0]} is ::\n${_}`);
    } catch(e) {
        console.error(`Unable to connect ${e}`);
    }

})();
*/