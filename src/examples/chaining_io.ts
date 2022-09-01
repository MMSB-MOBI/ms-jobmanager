import jmClient from '../client';

/*
import {logger, setLogLevel, setLogFile} from '../logger.js';
setLogLevel("info");
*/

const port = 2020
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);

        const args = {
            cmd : `echo "some input for job2" > job1.out`
        } 
        console.log("1st job arguments:\n");
        console.dir(args);    
        const { stdout, jobFS } = await jmClient.pushFS(args);
        
        const outStream = await jobFS.readToStream("job1.out");
        
        const args2 = {
            cmd : "cat input/job2.in",
            inputs : {
                "job2.in" : outStream
            }
        }
        
        console.log("2nd job arguments:\n");
        console.dir(args2);
        const { stdout : stdout2, jobFS : jobFS2 } = await jmClient.pushFS(args2);
        console.log(`Job 2 standard output:: ${stdout2}`);

    } catch(e) {
        console.log("An error occured");
        console.log(e);
    }

})();