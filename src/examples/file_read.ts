import jmClient from '../client';
import { Readable } from 'stream';
import { logger, setLogLevel } from '../logger';

setLogLevel("debug");
logger.warn("Lets'go");
//const script = 10;
//const script = createReadStream(__dirname + './test/hello.sh')
const script = `${__dirname}/data/hello.sh`
console.log(script);
const exportVar = { "titi" : "28" };

const port = 2020;
const TCPip = "127.0.0.1";

const streamToString = (stream:Readable):Promise<string> => {
    const chunks: Uint8Array[] = [];
    return new Promise ( (res, rej) => { 
        stream.on('data', (chunk: Uint8Array) => chunks.push(chunk))
        stream.on('end', () => {
            const _ = Buffer.concat(chunks).toString('utf8');             
            res(_);
        });
        stream.on('error', (err:string) => rej(err));
    })
};


(async() => {
    try {
        await jmClient.start(TCPip, port);

        const { stdout, jobFS } = await jmClient.pushFS({ script, exportVar })
        logger.info(stdout);
        logger.info(jobFS);
        const fsItems:string[] = await jobFS.list();

        console.log(fsItems[0]);
        const contentStream =  await jobFS.read(fsItems[0]);
        const _  = await streamToString(contentStream);
        console.log('==>' + _);
       
    } catch(e) {
        console.error(`Unable to connect ${e}`);
    }

})();