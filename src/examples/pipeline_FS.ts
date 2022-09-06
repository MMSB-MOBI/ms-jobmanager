import jmClient from '../client';

console.warn("Submitting two jobs and join there results into a third one");

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);
        const resultsWithFS = await jmClient.pushManyFS([
            {cmd : 'sleep 1; echo "Job $tag output" > job1.out',
            exportVar : {tag : "T1"}},
            {cmd : 'sleep 10; echo "Job $tag output" > job2.out',
            exportVar : {tag : "T2"}},
        ]);
        const jobFS_1 = resultsWithFS[0].jobFS;
        const jobFS_2 = resultsWithFS[1].jobFS;

        const outStream_1 = await jobFS_1.readToStream("job1.out");
        const outStream_2 = await jobFS_2.readToStream("job2.out");
        
        const stdout = await jmClient.push({
            cmd: "paste input/job1.in input/job2.in",
            inputs : {  "job1.in" : outStream_1,
                        "job2.in" : outStream_2,
            }
        });
        console.log(`Final job stdout:\n>${stdout}<`);
    } catch(e) {
        console.error(e);
    }
})().then(()=>process.exit());

