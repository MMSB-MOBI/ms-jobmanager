import { EventEmitter } from "events"; 
import { Socket } from "socket.io-client";
import { JobInputs } from '../../job/inputs';
import { Readable } from 'stream';
import { logger } from '../../logger';
import uuidv4 = require('uuid/v4');
import { InputDataSocket} from '../../shared/types/base';
export type ServerStatus = 'busy' | 'available' 
import {isValidJobOptInputs, isRecordOfStringToStringOrNumber, isArrayOfString, isReadableOrString} from './base';
export interface JobOptBase {     
    id?:string;

    cmd? : string,
    exportVar? : Record<string, string|number>    
    inputs? : InputDataSocket|string[]|JobInputs,
    jobProfile?: string;    
    modules? : string [],    
    namespace? :string,
    script? : Readable|string,    
    socket?:Socket,
    sysSettingsKey?:string,
    tagTask? : string,    
    ttl? : number
}

const typeLogError = (varName:string, eType:string, varValue:any):void => {
    logger.error(`jobOpt property ${varName} of value ${varValue} is not of type ${eType}`);
};

// Code duplication across Factory and TypeGuard
// Factorization by callback function may cause TS inference pb

export function jobOptBaseFactory(opt:Object):JobOptBase {
    const jobOptBase:JobOptBase = {
        id: undefined,
        script: undefined,
        cmd: undefined,
        modules: [],
        tagTask: undefined,
        namespace: undefined,
        exportVar: undefined,
        jobProfile: "default",
        ttl: undefined,
        sysSettingsKey:undefined,
        inputs: {},
        socket: undefined  
    };
    for (const [key, value] of Object.entries(opt)) {
        if (!jobOptBase.hasOwnProperty(key)) {
            logger.error(`${key} is not a jobOptAbstract property`);
            continue;
        }
        if (key == 'id' || key == 'cmd' || key == 'jobProfile' || key == 'tagTask' ||
            key == 'namespace' || key == 'sysSettingsKey'
            ) 
            if (typeof(value) != 'string')
                typeLogError(key, 'string', value);
            else
                jobOptBase[key] = value;
        if (key == 'inputs')
            if(!isValidJobOptInputs(value))
                typeLogError(key, 'InputDataSocket|string[]|JobInputs', value);
            else
                jobOptBase[key] = value;
        if (key == 'exportVar')
            if(!isRecordOfStringToStringOrNumber(value))
                typeLogError(key, 'Record<string, string|number>', value);
            else
                jobOptBase[key] = value;
        if (key == 'modules')
            if(!isArrayOfString(value))
                typeLogError(key, 'string[]', value);
            else
                jobOptBase[key] = value;
        if(key == 'script')
            if(!isReadableOrString(value))
                typeLogError(key, 'Readable|string', value);
            else
                jobOptBase[key] = value;
        if(key == 'socket')
            if(!(value instanceof(Socket)))
                typeLogError(key, 'Socket', value);
            else
                jobOptBase[key] = value;
                
    }
     
    return jobOptBase;
}

export function isJobOptBase(data:any): data is JobOptBase {
    if( !( data instanceof(Object) ) ) {
        logger.error('Data is not a JobOptBase as it is not an Object!');
        return false;
    }
    for (const [key, value] of Object.entries(data)) {
        if (key == 'id' || key == 'cmd' || key == 'jobProfile' || key == 'tagTask' ||
            key == 'namespace' || key == 'sysSettingsKey'
            ) 
            if (typeof(value) != 'string') {
                typeLogError(key, 'string', value);
                return false;
            }
        if (key == 'inputs')
            if(!isValidJobOptInputs(value)) {
                typeLogError(key, 'InputDataSocket|string[]|JobInputs', value);
                return false;
            }
        if (key == 'exportVar')
            if(!isRecordOfStringToStringOrNumber(value)) {
                typeLogError(key, 'Record<string, string|number>', value);
                return false;
            }
        if (key == 'modules')
            if(!isArrayOfString(value)) {
                typeLogError(key, 'string[]', value);
                return false;
            }
        if(key == 'script')
            if(!isReadableOrString(value)) {
                typeLogError(key, 'Readable|string', value);
                return false;
            }
            
        if(key == 'socket')
            if(!(value instanceof(Socket))) {
                typeLogError(key, 'Socket', value);
                return false;
            }
    }
    return true;
}


/*
export abstract class JobBase extends EventEmitter {
    id : string;
    script? :string|Readable;
    cmd? :string;
    exportVar? : Record<string, string|number> = {};
    inputs :JobInputs;
    jobProfile? : string;
    tagTask? :string;
    namespace? :string;
    modules? :string[] = []; 
    socket?:Socket
    isShimmeringOf?:Job
    hasShimmerings:JobProxy[] = []

}

*/

/* Mother class for Job and JobOpt */
export class JobBase extends EventEmitter implements JobOptBase{
    id : string;
    script? :string|Readable;
    cmd? :string;
    exportVar? : Record<string, string|number> = {};
    inputs :JobInputs;
    jobProfile? : string;
    tagTask? :string;
    namespace? :string;
    modules? :string[] = []; 
    socket?:Socket

    constructor(jobOpt:JobOptBase, uuid?:string){ // Quick and dirty typing
        super();
        this.id = uuid ? uuid : uuidv4();
      
        if ('modules' in jobOpt)
            this.modules = jobOpt.modules;
        if ('jobProfile' in jobOpt)       
            this.jobProfile =  jobOpt.jobProfile;
        if('script' in jobOpt)
            this.script =  jobOpt.script;
        if ('tagTask' in jobOpt)
            this.tagTask = jobOpt.tagTask;
        if ('namespace' in jobOpt)
            this.namespace = jobOpt.namespace;
        if ('socket' in jobOpt) 
            this.socket = jobOpt.socket;
        if('exportVar' in jobOpt)
            this.exportVar = jobOpt.exportVar;
       
        this.inputs = new JobInputs(jobOpt.inputs);

    }

    pprint():string {
        let asString = `Job id : ${this.id}`;
        asString += this.modules    ? `\n\tmodules    :${this.modules}`    : ''
        asString += this.jobProfile ? `\n\tjobProfile :${this.jobProfile}` : ''
        asString += this.script     ? `\n\tscript     :${this.script}`: ''
        asString += this.tagTask    ? `\n\ttagTask    :${this.tagTask}`: ''
        asString += this.namespace  ? `\n\tnamespace  :${this.namespace}`: ''
        asString += this.socket     ? `\n\tsocket     :${this.socket}`: ''
        asString += this.exportVar  ? `\n\texportVar  :${uFormat(this.exportVar)}`: ''
        
        return asString;
    }

}