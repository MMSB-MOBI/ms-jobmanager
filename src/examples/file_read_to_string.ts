import jmClient from '../client';
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

        const { stdout, jobFS } = await jmClient.pushFS({ script, exportVar });
        logger.info(`Job standard output:: ${stdout}`);
        
        const fsItems:string[] = await jobFS.list();
        logger.info(`Listed items at root of job work directory are :\n\t-${fsItems.join("\n\t-")}`);
        
        logger.info(`Trying to access the file ${fsItems[0]}`);
        const contentString =  await jobFS.readToString(fsItems[0]);
        logger.info(`The string content of the file ${fsItems[0]} is::\n${contentString}`);
        
        logger.info(`Tryning to read a nested file at ./deep/path/to/file/gotit.txt`)
        const contentNestedString =  await jobFS.readToString("./deep/path/to/file/gotit.txt");
        logger.info(`The string content of the file ./deep/path/to/file/gotit.txt is::\n${contentNestedString}`);
        
        logger.info(`Trying to access a file that definitely does not exist`);
        const noContentString =  await jobFS.readToString("this/is/not/a/file");

    } catch(e) {
        logger.error(`Unable to process job ${e}`);
    }

})();