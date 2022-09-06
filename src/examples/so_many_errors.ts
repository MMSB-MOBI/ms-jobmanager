import jmClient from '../client';
import { logger, setLogLevel } from '../logger';

console.warn("Testing various errors managments");
const script = `${__dirname}/data/process_input_file.sh`
console.log(`using following shell script as template ${script}`);
const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);       
       
        try {     
            console.log("Testing command error");
            const _  = await jmClient.push({ cmd:'not_a_shell_command'});  
        } catch(e) {          
            console.error(e); 
        }
        try {    
            console.log("Testing empty input values error");  
            const _  = await jmClient.push({ 
                cmd:'echo "ls input/ "',
                inputs : { "dummy.txt" : ""}
            });  
        } catch(e) {          
            console.error(e); 
        }
        try {    
            console.log("Testing script error")  
            const _  = await jmClient.push({ script:'./idonot/exist'});  
        } catch(e) {          
            console.error(e); 
        }
        try {    
            console.log("Testing stderr content error");  
            const _  = await jmClient.push({ cmd:'>&2 echo "Please Help !!!!"'});  
        } catch(e) {          
            console.error(e); 
        }
       
    } catch(e) {
        console.error(e);
    }
})().then( ()=> process.exit())