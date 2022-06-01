import jmClient from '../client';
import { createWriteStream } from 'fs'
import { logger, setLogLevel } from '../logger';

setLogLevel("info");
logger.warn("Testing FS to stream interface");
const script = `${__dirname}/data/hello.sh`
logger.info(`using following shell script as template ${script}`);
const exportVar = { "sleepTime" : "5" };

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);
        const { stdout, jobFS } = await jmClient.pushFS({ script, exportVar });
        console.log(`Job standard output:: ${stdout}`);
        const fsItems:string[] = await jobFS.list();
        console.log(`Listed items at root of job work directory are :\n\t-${fsItems.join("\n\t-")}`);
        const contentStream =  await jobFS.readToStream(fsItems[0]);
       
        console.log(`The content of the file ${fsItems[0]} is piped to stdout\n`);
        contentStream.pipe(process.stdout)
        contentStream.on('end', ()=>process.exit());
    } catch(e) {
        console.error(e);
    }

})();