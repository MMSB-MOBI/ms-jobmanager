import jmClient from '../client';

console.warn("Testing the glob pattern search feature of jobFS.list");
const cmd = `mkdir one two three; touch one/a.txt; touch two/b.txt; touch three/c.txt; touch 0.txt`
console.log(`using following shell cmd '${cmd}'`);
const patt = '**/*.txt'
console.log(`Searching for files matching ${patt}`);
const exportVar = { "sleepTime" : "5" };

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);

        const { stdout, jobFS } = await jmClient.pushFS({ cmd, exportVar });
        console.log(`List of job local files matching ${patt}`);
        const matches = await jobFS.list(patt)    
        console.dir(matches);

    } catch(e) {
        console.error(e);
    }

})().then( ()=> process.exit());