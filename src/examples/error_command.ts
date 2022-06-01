import jmClient from '../client';
import { logger, setLogLevel } from '../logger';

setLogLevel("info");
logger.warn("job error managment");
const script = `${__dirname}/data/hello.sh`
const cmd = "not_a_valid shell command line"
const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);
        try {
            const stdout = await jmClient.push({ cmd });
            console.log(`Job script standard output:: ${stdout}`);
        } catch(jobErrorMessage) {
            console.error(`Following error occurs during job execution:\n${jobErrorMessage}`);
        }
    } catch(e) {
        console.error(`e`);
    }
})().then( ()=> process.exit())