export { JobOptBase as JobOptProxy } from './common/jobopt_model' 
import { JobOptBase as JobOptProxy, jobOptBaseFactory as jobOptBaseFactory } from './common/jobopt_model' 
import { JobBase } from './common/job_model';

import { Readable } from 'stream';

const isStream = require('is-stream');

/*
import { EventEmitter} from 'events';
import { JobInputs } from '../../job/inputs';
import { Job } from '../../job';
import { logger } from '../../logger';
import { Socket } from 'socket.io-client';
import { format as uFormat } from 'util';
import { socketPull } from '../../comLayer/serverShell';
*/


export function JobOptClientFactory(opt:any):JobOptProxy {
    const jobOptProxy:JobOptProxy = jobOptBaseFactory(opt);
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