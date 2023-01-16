import jmClient from '../client';
import  { createWriteStream } from 'fs';
console.warn("Testing jobFS zipping utility");
const cmd = `mkdir one two three; touch one/a.txt; touch two/b.txt; touch three/c.txt; touch 0.txt`
console.log(`using following shell cmd '${cmd}'`);
console.log(`Zipping the entiere working directory in data.zip`);

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);
        
        const { stdout, jobFS } = await jmClient.pushFS({ cmd });
        const zipArchiveStream = await jobFS.zap();
        const output   = createWriteStream('./data_out.zip');
        zipArchiveStream.pipe(output);
        output.on('close', ()=> process.exit())
    } catch(e) {
        console.error(e);
    }

})();