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

        Promise.all( inputs.map((e)=>jmClient.pushFS(e))).then( ([job_1, job_2, job_3])=>{
            job_2.jobFS.list().then((job_2_dir_items)=> console.log(`PromiseAll 2nd job folder content [aka tango]\n${job_2_dir_items}`));
            job_1.jobFS.list().then((job_1_dir_items)=> console.log(`PromiseAll 1st job folder content [aka zebra]\n${job_1_dir_items}`));
            job_3.jobFS.list().then((job_3_dir_items)=> console.log(`PromiseAll 3rd job folder content [aka milwaukee]\n${job_3_dir_items}`));
        });


    } catch(e) {
        logger.error(e);
    }

})();