import jmClient from '../client';
import { Readable } from 'stream';
import {logger, setLogLevel, setLogFile} from '../logger.js';
setLogLevel("info");
const outputForJob1 = 'job1.out';
const cmd1          = `echo "some input for job2" > ${outputForJob1}`;

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
        //console.log(`Job 1 standard output:: ${stdout}`);

       /* 
        const outString = await jobFS.readToString("job1.out")
        console.log("Out 1 string :")
        console.log(outString)
        */
        
        const outStream = await jobFS.readToStream("job1.out")
       /* console.log("Providing this stream as input for 2nd job");
        console.log(outStream);
        */
        //outStream.pipe(process.stdout);
        //outStream.on('end', ()=>process.exit());
        

        const args2 = {
            cmd : "cat input/job2.in", //"echo toto",
            inputs : {
                "job2.in" : outStream
            }
        }
        
        console.log("2nd job arguments:\n");
        console.dir(args2);
        const { stdout : stdout2, jobFS : jobFS2 } = await jmClient.pushFS(args2);
        console.log(`Job 2 standard output:: ${stdout2}`);
        /*const outString2 = await jobFS.readToString("file2.txt")
        console.log("Out 2 string :")
        console.log(outString2)*/
       
    } catch(e) {
        console.error(e);
    }

})();