export { JobOptBase as JobOptProxy } from './common' 
import { JobOptBase as JobOptProxy, JobBase } from './common' 
import { jobOptBaseFactory as baseFactory} from './common';
import { EventEmitter} from 'events';
import { Readable } from 'stream';
import { JobInputs } from '../../job/inputs';
import { Job } from '../../job';

import { logger } from '../../logger';
import { Socket } from 'socket.io-client';
import { format as uFormat } from 'util';
const isStream = require('is-stream');
import { socketPull } from '../../comLayer/serverShell';

/*
    type guard for data container send from the consumer microservice to the JM.
    aka "newJobSocket" event
*/
export function isJobOptFromClientToServer(data: any): data is JobOptProxy {

    if (!data.hasOwnProperty('script') && !data.hasOwnProperty('inputs')) return false;
    if (!isStream(data.script)){    
        return false;
    }
    for (let k in data.inputs){
        if ( !isStream(data.inputs[k]) ){
            
            return false;
        }
    }

    return true;
}

export function JobOptClientFactory(opt:any):JobOptProxy {
    const jobOptProxy:JobOptProxy = baseFactory(opt);
    // We chack for mandatory set of key

    if(jobOptProxy.script && jobOptProxy.cmd)
        throw('jobOpt has conflicting script and cmd attributes\n${uFormat(jobOptProxy)}');
    if(!jobOptProxy.script && !jobOptProxy.cmd)
        throw('jobOpt must have at least a script or a cmd attributes\n${uFormat(jobOptProxy)}');

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

    stdout?:Readable
    stderr?:Readable
    constructor(jobOpt:JobOptProxy, uuid?:string){
        super(jobOpt, uuid)
    }
}