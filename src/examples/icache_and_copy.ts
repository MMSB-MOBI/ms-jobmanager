import jmClient from '../client';

import {logger, setLogLevel, setLogFile} from '../logger.js';
setLogLevel("debug");

console.warn("spercifying and intermediar cache and using the jobFS.copy");

const port = 2020;
const TCPip = "127.0.0.1";

(async() => {
    try {
        await jmClient.start(TCPip, port);       
        const { stdout, jobFS } = await jmClient.pushFS(
            { 
            cmd:"echo 'hello world'; echo 'more stuff' > data.out", 
            sysSettingsKey : "iCache-test"
            }
        );
        console.log(`Job script standard output:: ${stdout}`);
        console.log(`Copying content of remote file dtaa.out into ${__dirname}/data.out.2`);
            
        await jobFS.copy('data.out', __dirname + '/data.out.2');
        
    } catch(e) {
        console.error(e);
    }
})().then( ()=> process.exit())


/* server-side palce where namespace engine.iCache seems to be accessed
    We need to check client-side for sysSettings key value
    
    const jobOpt = transformProxyToJobOpt(jobID, jobOptProxy, remoteData, 
        { engine, emulator, internalIP, internalPort, cache: cacheDir as string,
            socket:nspJobSocket
        })

*/
