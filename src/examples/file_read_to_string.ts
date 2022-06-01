import jmClient from '../client';
import { logger, setLogLevel } from '../logger';
setLogLevel("info");
logger.warn("Testing the  FS to string interface over various cases");
const script = `${__dirname}/data/hello.sh`
logger.info(`using following shell script as template ${script}`);
const exportVar = { "sleepTime" : "5" };

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);

        const { stdout, jobFS } = await jmClient.pushFS({ script, exportVar });
        console.log(`Case 1: job standard output\n${stdout}`);
        
        const fsItems:string[] = await jobFS.list();
        console.log(`\nCase 2: listing items at root of job work directory\n\t-${fsItems.join("\n\t-")}`);
        
        console.log(`\nCase 3: reading the content of the file ${fsItems[0]}`);
        const contentString =  await jobFS.readToString(fsItems[0]);
        console.log(contentString);
        
        console.log(`\nCase 4: reading the content of a nested file at ./deep/path/to/file/gotit.txt`)
        const contentNestedString =  await jobFS.readToString("./deep/path/to/file/gotit.txt");
        console.log(contentNestedString);
        
        console.log(`\nCase 5: trying to read a file that does not exist`);
        const _ =  await jobFS.readToString("this/is/not/a/file");

    } catch(e) {
        console.error(e);
    }

})().then( ()=> process.exit());