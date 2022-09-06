import jmClient from '../client';

console.warn("Riding pipeline");

const port = 2020;
const TCPip = "127.0.0.1";

console.log("Submitting two jobs and wait for them to complete");
(async() => {
    try {
        await jmClient.start(TCPip, port);
        const results = await jmClient.pushMany([
            {cmd : 'sleep 1; echo "Job $tag output"',
            exportVar : {tag : "T1"}},
            {cmd : 'sleep 10; echo "Job $tag output"',
            exportVar : {tag : "T2"}},
        ]);
        console.log("Job results arrays:\n");
        results.forEach((stdout, i)=> {
            console.log(`${i} ==> ${stdout}`)
        });
    } catch(e) {
        console.error(e);
    }
})().then(()=>process.exit());