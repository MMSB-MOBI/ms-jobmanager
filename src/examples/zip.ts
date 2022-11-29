import jmClient from '../client';
import  { createWriteStream } from 'fs';
console.warn("Testing jobFS zipping utility");
const cmd = `mkdir one two three; touch one/a.txt; touch two/b.txt; touch three/c.txt; touch 0.txt`
console.log(`using following shell cmd '${cmd}'`);
const patt = '**/*.txt'
console.log(`Zipping the entiere working directory in data.zip`);

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);

        const { stdout, jobFS } = await jmClient.pushFS({ cmd });
        const zipArchiveStream = await jobFS.zrap();
        console.dir(zipArchiveStream);
        zipArchiveStream.on('data', () => console.log("===>pouet"));
        zipArchiveStream.on('close', () => { console.log("readable closing")});
        /*
        const output   = createWriteStream('data.zip')
        readable.pipe(output);
        output.on('data', () => console.log("pouet"));
        output.on('close', ()=> process.exit()); 
        */
        readable.pipe(process.stdout);
    } catch(e) {
        console.error(e);
    }

})().then( ()=> process.exit());