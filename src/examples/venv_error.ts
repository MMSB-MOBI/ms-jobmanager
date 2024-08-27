import jmClient from '../client';

console.warn("How to specify a python venv leading  to error here");
const script = `${__dirname}/data/hello.sh`

console.log(`using following script as template ${script}`);
const exportVar = { "sleepTime" : "5" };

const cmd = "sleep $sleepTime; echo hello world !"
console.log(`using following shell command template ${cmd}`);

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);       
        const stdout  = await jmClient.push({ script, exportVar, venv:"/tmp/my_venv" });
        console.log(`Job script standard output:: ${stdout}`);     
        const stdout2  = await jmClient.push({ script, exportVar, venv:"non_absolute/tmp/my_venv" });
        console.log(`Job script standard output:: ${stdout2}`);     
    } catch(e) {
        console.error(e);
    }
})().then( ()=> process.exit())