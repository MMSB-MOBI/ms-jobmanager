import jmClient from '../client';
import { logger, setLogLevel } from '../logger';

setLogLevel("info");
const script = `${__dirname}/data/hello_many.sh`
logger.info(`using following shell script as template ${script}`);
const sleepTime=5;

const port = 2020;
const TCPip = "127.0.0.1";
const inputs = [
    { script,  exportVar : { mySecretValue : 'zebra', sleepTime}},
    { script,  exportVar : { mySecretValue : 'tango', sleepTime}},
    { script,  exportVar : { mySecretValue : 'milwaukee', sleepTime}}
];

(async() => {
    try {
        await jmClient.start(TCPip, port);
        
        const job1 = await jmClient.pushFS(inputs[0]);
        const job2 = await jmClient.pushFS(inputs[1]);
        const job3 = await jmClient.pushFS(inputs[2]);

        console.log("2nd job folder content [aka tango]");
        const job2_dir_items = await job2.jobFS.list();
        console.log(job2_dir_items)
        
        console.log("3rd job folder content [aka milwaukee]");
        const job3_dir_items = await job3.jobFS.list();
        console.log(job3_dir_items)

        console.log("1st job folder content [aka zebra]");
        const job1_dir_items = await job1.jobFS.list();
        console.log(job1_dir_items)
    } catch(e) {
        logger.error(e);
    }
})();