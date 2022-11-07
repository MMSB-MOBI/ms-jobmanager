
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
We can inspect the folders of each job and confirm that they all refer to a single folder, the one the first/single genuine job
*/

(async() => {
    try {
        await jmClient.start(TCPip, port);

        /*
        Wait 5 sc to submit 2 identical jobs: the 2nd will be bound to the first which is still running
        Listing the work folders of both jobs shows they are identical and a both refer to the working folder of the 1st job.
        */
        const job_promise_1 = jmClient.pushFS({ script, exportVar });
        job_promise_1.then( async ({stdout, jobFS}) => {
            const folderContent = await jobFS.list();
            console.log("Work Folder of job1\n", folderContent);
        });
        setTimeout( ( ) => {
            const job_promise_2 = jmClient.pushFS({ script, exportVar });
            job_promise_2.then( async ({stdout, jobFS}) => {
                const folderContent = await jobFS.list();
                console.log("Work Folder of job2\n", folderContent);
            });
        }, 5000);
    } catch(e) {
        console.error(`Unable to connect ${e}`);
    }
   
})();