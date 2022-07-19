
import jmClient from '../client';

console.warn("Testing simultaneous resolution of identical jobs");
const script = `${__dirname}/data/hello.sh`
console.log(script);
const exportVar = { "sleepTime" : "10" };

const port = 2020;
const TCPip = "127.0.0.1";

/*
Identical jobs are submitted at different times, but all resolved simultaneously.
B/C submitted jobs identical to already running ones are bound to the first/genuine one.
*/

(async() => {
    try {
        await jmClient.start(TCPip, port);
        [1000,3000,6000].map((t,i) => {
            
            setTimeout( ()=> {
                console.log(`Submitting job number ${i} delayed by ${t}`);
                jmClient.push({ script, exportVar })
                    .then( (stdout:string)=> console.log(`job number ${i} stdout:${stdout}`) );
                //logger.info("Waiting for a while ...")
            }, t);
        });
    } catch(e) {
        console.error(`Unable to connect ${e}`);
    }

})();