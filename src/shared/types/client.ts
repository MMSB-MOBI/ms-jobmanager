export { JobOptBase as JobOptProxy } from './common/jobopt_model' 
import { JobOptBase as JobOptProxy, jobOptBaseFactory } from './common/jobopt_model' 
import { JobBase } from './common/job_model';
export { ClientInput as clientInputAPI } from './common/jobopt_model';
import { Readable } from 'stream';
import { Socket as SocketClient } from 'socket.io-client';
import { format as uFormat } from 'util';

export function JobOptClientFactory(opt:any):JobOptProxy {
    const jobOptProxy:JobOptProxy = jobOptBaseFactory(opt);
    // We check for mandatory set of key

    if(jobOptProxy.script && jobOptProxy.cmd)
        throw(`jobOpt has conflicting script and cmd attributes\n${uFormat(jobOptProxy)}`);
    if(!jobOptProxy.script && !jobOptProxy.cmd)
        throw(`jobOpt must have at least a script or a cmd attributes\n${uFormat(jobOptProxy)}`);

    // Inputs validity is performed server-side
    return jobOptProxy;
}

/*
    This object is meant to live in the job-manager-client space !!!!!!  
    It is basically an empty shell that forwards event and streams
    W/in jmCore it is used as a virtual class for jobObject
    Following event occur on the job-manager-client side 
    job.emit('inputError')
    job.emit('scriptError')
*/

export class JobProxy extends JobBase {
   /* TCPip : string,
    TCPport : number,*/
    stdout?:Readable
    stderr?:Readable
    socket: SocketClient
    constructor(jobOpt:JobOptProxy, socket:SocketClient, uuid?:string ){
        super(jobOpt, uuid)
        this.socket = socket;
    }
}