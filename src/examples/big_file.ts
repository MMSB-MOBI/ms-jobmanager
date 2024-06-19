import jmClient from '../client';

console.warn("Input file(s) usage with file renaming and output file access");
const oneInputFile = `${__dirname}/data/big.txt`

console.info(`applying a shell cmd to a big file`);
const inputs = { 'renamed_file.txt' : oneInputFile };
const cmd = "ls -lrtha input/renamed_file.txt"

const port = 2020;
const TCPip = "127.0.0.1";
(async() => {
    try {
        await jmClient.start(TCPip, port);       
        const { stdout, jobFS }  = await jmClient.pushFS({ cmd, inputs });
        console.log(`Job standard output :: ${stdout}`);
        console.log("Accessing output folder items");
        const items = await jobFS.list();
        console.log( `${items.join('\n\t-')}`);      
    } catch(e) {
        console.error(e);
    }
})().then( ()=> process.exit());