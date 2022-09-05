import jmClient from '../client';

import {logger, setLogLevel, setLogFile} from '../logger.js';
//setLogLevel("debug");

console.warn("Riding pipeline");

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);
        // push many
        const results = await jmClient.pushMany([
            {cmd : 'sleep 1; echo "Job $tag output"',
            exportVar : {tag : "T1"}},
            {cmd : 'sleep 10; echo "Job $tag output"',
            exportVar : {tag : "T2"}},
        ]);
        console.log("Job results arrays:\n");
        results.forEach((stdout, i)=> {
            console.log(`${i} ==> ${stdout}`)
        });
    } catch(e) {
        console.error(e);
    }
})().then(()=>process.exit());