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
        
        const [ job1, job2, job3 ] = await Promise.all( inputs.map((e)=>jmClient.pushFS(e)));
        
        const job1_items = await job1.jobFS.list();
        console.log(`1st job folder content [aka zebra]\n${job1_items}`);
        
        const job2_items = await job2.jobFS.list();
        console.log(`2nd job folder content [aka tango]\n${job2_items}`);
        
        const job3_items = await job3.jobFS.list();
        console.log(`3rd job folder content [aka milwaukee]\n${job3_items}`);

    } catch(e) {
        console.error(e);
    }
})();