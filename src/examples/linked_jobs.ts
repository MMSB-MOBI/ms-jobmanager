import jmClient from '../client';
import { Readable } from 'stream';

const script1 = `${__dirname}/data/create_file.sh`
const script2 = `${__dirname}/data/add_to_file.sh`

const port = 6001
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);

        const args = {
            exportVar:  { "sleepTime" : 5},
            script : script1
        } 
        console.log("push")
        console.log(args)    
        const { stdout, jobFS } = await jmClient.pushFS(args);
        console.log(`Job 1 standard output:: ${stdout}`);

        const outString = await jobFS.readToString("file.txt")
        console.log("Out 1 string :")
        console.log(outString)
        const outStream = await jobFS.readToStream("file.txt")
        const args2 = {
            script : script2,
            exportVar : {sleepTime : 5},
            inputs : {
                "file.txt" : outStream
            }
        }

        console.log("push 2")
        console.log(args2)

        const { stdout : stdout2, jobFS : jobFS2 } = await jmClient.pushFS(args2);
        console.log(`Job 2 standard output:: ${stdout2}`);

        const outString2 = await jobFS.readToString("file2.txt")
        console.log("Out 2 string :")
        console.log(outString2)
       
    } catch(e) {
        console.error(e);
    }

})();