import jmClient from '../client';
import { logger, setLogLevel } from '../logger';

setLogLevel("info");
logger.info("Exceeding worker pool size example");
const cmd = `sleep 5; echo command $my_value output`;
logger.info(`using following shell cmd as template ${cmd}`);
const port = 2020;
const TCPip = "127.0.0.1";
const job_num = 20;
(async() => {
    try {
        await jmClient.start(TCPip, port);      
        const _ =  [...Array(job_num).keys()].map( (i)=> {
            const exportVar = { my_value:i };
            return jmClient.push({ cmd, exportVar } )
        });
        Promise.all(_).then((stdouts:string[])=> {
            stdouts.forEach((stdout, i) => logger.info(`stdout of job ${i}:: ${stdout}`));
            logger.info("exiting");
            process.exit()
        });
    
    } catch(e) {
        logger.error(e);
    }
})();