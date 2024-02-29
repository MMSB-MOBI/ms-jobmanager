import jmClient from '../client';
const { Command } = require("commander");

const program = new Command();
program
  .version('0.1.0')
  .option('-p, --port [port number]', 'MS Job Manager port', 2020)
  .option('-a, --adress [IP adress]', 'MS Job Manager adress', 'localhost')
  .parse(process.argv);

let port:number = program.port ? parseInt(program.port) : 2020;
let adress:string = program.adress ? program.adress : 'localhost';

( async () => {
   



const cmd = "echo hello; echo world > file.txt"
const res:any[] = [];
for (let i = 0 ; i < 50 ; i++) {
    await jmClient.start(adress, port);
    const _ = await jmClient.pushFS({ cmd });
    res.push(_)
}

for (let i = 0 ; i < res.length ; i++) {
    const {stdout, jobFS} =  res[i];
    const files = await jobFS.list();
    console.log(i + "//" + files);
}

console.log("Staying for 60 second.");
setTimeout(() => {
    console.log("Exiting");
  }, 60000);

})();
