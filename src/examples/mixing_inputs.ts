import { createReadStream } from 'fs';
import jmClient from '../client';
import { clientInputAPI } from '../client';

console.warn("Testing inputs mixing !!!");
let cmd = `cat input/hello.sh > results.log ; cat input/a.txt >> results.log; cat input/b.txt >> results.log;`
cmd    += `cat input/file.txt >> results.log ; cat input/c.txt >> results.log; cat input/d.txt >> results.log;`
cmd    += `sleep $sleepTime`;
console.info(`using following shell command \"${cmd}\"`);
const exportVar = { "sleepTime" : "5" };

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);
        // Define a obfuscating input list of various elemnt
        const inputs = [ 
            `${__dirname}/data/hello.sh`,
            { 
                "a.txt" :  `${__dirname}/data/hello.sh`,
                "b.txt" :  createReadStream(`${__dirname}/data/hello.sh`)
            },
            `${__dirname}/data/file.txt`,
            { 
                "c.txt" :  `${__dirname}/data/file2.txt`,
                "d.txt" :  createReadStream(`${__dirname}/data/hello_many.sh`)
            }
        ] as clientInputAPI;
        const { stdout, jobFS } = await jmClient.pushFS({ cmd, exportVar, inputs });
        console.log(`Job standard output:: ${stdout}`);

        const contentStream =  await jobFS.readToStream("results.log");            
        contentStream.pipe(process.stdout)
        contentStream.on('end', ()=>process.exit());
       
    } catch(e) {
        console.error(e);
    }

})();