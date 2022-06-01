import jmClient from '../client';
import { logger, setLogLevel } from '../logger';

setLogLevel("info");
logger.warn("Input file(s) usage with file renaming and output file access");
const script = `${__dirname}/data/process_input_file_rename_and_access.sh`
const oneInputFile = `${__dirname}/data/file.txt`
logger.info(`using following shell script as template ${script}`);
const inputs = { 'renamed_file.txt' : oneInputFile };
const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);       
        const { stdout, jobFS }  = await jmClient.pushFS({ script, inputs });
        console.log(`Job standard output :: ${stdout}`);
        console.log("Accessing output folder items");
        const items = await jobFS.list();
        console.log( `${items.join('\n\t-')}`);      
    } catch(e) {
        console.error(e);
    }
})().then( ()=> process.exit());