import jmClient from '../client';
import { createWriteStream } from 'fs'
import { logger, setLogLevel } from '../logger';

setLogLevel("info");
logger.warn("Testing FS interface");
const script = `${__dirname}/data/hello.sh`
logger.info(`using following shell script as template ${script}`);
const exportVar = { "sleepTime" : "5" };

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);
        const outputFile = 'hello.out';
        const output = createWriteStream(outputFile);
        const { stdout, jobFS } = await jmClient.pushFS({ script, exportVar });
        logger.info(`Job standard output:: ${stdout}`);
        const fsItems:string[] = await jobFS.list();
        logger.info(`Listed items at root of job work directory are :\n\t-${fsItems.join("\n\t-")}`);
        const contentStream =  await jobFS.readToStream(fsItems[0]);
        contentStream.pipe(output)
        logger.info(`The content of the file ${fsItems[0]} was piped in::\n${outputFile}`);
    } catch(e) {
        logger.error(`Unable to process job ${e}`);
    }

})();