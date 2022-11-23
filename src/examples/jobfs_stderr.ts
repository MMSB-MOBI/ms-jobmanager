import jmClient from '../client';
import {JobStderrNotEmptyFS} from '../errors/client';

console.warn("Testing simultaneous resolution of identical jobs");
const cmd = `touch valuable_stuff.txt let_me_see.log; >&2 echo "some error content"`
console.log(cmd);
//const exportVar = { "sleepTime" : "10" };

const port = 2020;
const TCPip = "127.0.0.1";

/*
    The JobStderrContent Error is triggered when a job run leads to a non empty stderr stream
    the JobFS obj can be accessed to
*/

(async() => {
    try {
        await jmClient.start(TCPip, port);
        const { stdout, jobFS } = await jmClient.pushFS({ cmd/*, exportVar */});
        console.log("Looks cool " + stdout);
    } catch (e) {
        if (e instanceof JobStderrNotEmptyFS) {
            const stderr = e.stderr;
            const jobFS = e.jobFS;
            const items = await jobFS.list();
            console.log(`${stderr}:\n${items}`)
         // specific error
        } else {
          throw e; // let others bubble up
        }
    }
})();