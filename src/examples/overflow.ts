import jmClient from '../client';

console.log("Exceeding worker pool size example");
const cmd = `sleep 5; echo command $my_value output`;
console.log(`using following shell cmd as template ${cmd}`);
const port = 2020;
const TCPip = "127.0.0.1";
const job_num = 20;
(async() => {
    try {
        await jmClient.start(TCPip, port);      
        const _ =  [...Array(job_num).keys()].map( (i)=> {
            const exportVar = { my_value:i };
            return jmClient.push({ cmd, exportVar } )
        });
        Promise.all(_).then((stdouts:string[])=> {
            stdouts.forEach((stdout, i) => console.log(`stdout of job ${i}:: ${stdout}`));
            console.log("exiting");
            process.exit()
        });
    
    } catch(e) {
        console.error(e);
    }
})();