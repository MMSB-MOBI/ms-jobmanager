import { JobInputs } from '../../../job/inputs';
import { Readable } from 'stream';
import { logger } from '../../../logger';
import { InputDataSocket} from '../../../shared/types/base';
 
import {isValidJobOptInputs, isRecordOfStringToStringOrNumber, isArrayOfString, isReadableOrString} from '../base';
import { Path, isReadableOrPath } from '../base';
import { JobOptError } from '../../../errors/client';

export type JobOptInputs = InputDataSocket|string[]|Record<string, string|Readable> | JobInputs;
export interface JobOptBase {     
    cmd? : string,
    exportVar? : Record<string, string|number>    
    jobProfile?: string;    
    modules? : string [],    
    namespace? :string,
    script? : Readable|Path,    
  
    sysSettingsKey?:string,
    tagTask? : string,    
    ttl? : number
    inputs? : JobOptInputs, /* Cover all possible types in inherited interface, should be "abstracted" */
}
/* Moved to errors
const typeLogError = (varName:string, eType:string, varValue:any):void => {
    logger.error(`jobOpt property ${varName} of value ${varValue} is not of type ${eType}`);
};
*/
// Code duplication across Factory and TypeGuard
// Factorization by callback function may cause TS inference pb

export function jobOptBaseFactory(opt:Object):JobOptBase {
    const jobOptBase:JobOptBase = {       
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
       
    };
    for (const [key, value] of Object.entries(opt)) {
        if (!jobOptBase.hasOwnProperty(key)) {
            logger.error(`${key} is not a jobOptAbstract property`);
            continue;
        }
        if (key == 'cmd' || key == 'jobProfile' || key == 'tagTask' ||
            key == 'namespace' || key == 'sysSettingsKey'
            ) 
            if (typeof(value) != 'string')
                //typeLogError(key, 'string', value);
                throw(new JobOptError(key, 'string', value));
            else
                jobOptBase[key] = value;
        if (key == 'inputs')
            if(!isValidJobOptInputs(value))
                //typeLogError(key, 'InputDataSocket|string[]|JobInputs|Record<string, string|Readable>', value);
                throw(new JobOptError(key, 'InputDataSocket|string[]|JobInputs|Record<string, Path|Readable>', value));    
            else
                jobOptBase[key] = value;
        if (key == 'exportVar')
            if(!isRecordOfStringToStringOrNumber(value))
                throw ( new JobOptError(key, 'Record<string, string|number>', value) )
                //typeLogError(key, 'Record<string, string|number>', value);
            else
                jobOptBase[key] = value;
        if (key == 'modules')
            if(!isArrayOfString(value))
                throw ( new JobOptError(key, 'string[]', value) )
                //typeLogError(key, 'string[]', value);
            else
                jobOptBase[key] = value;
        if(key == 'script')
            if(!isReadableOrPath(value))
                throw ( new JobOptError(key, 'Readable|Path', value) )
                //typeLogError(key, 'Readable|Path', value);
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
        if (key == 'cmd' || key == 'jobProfile' || key == 'tagTask' ||
            key == 'namespace' || key == 'sysSettingsKey'
            ) 
            if (typeof(value) != 'string') {
                //typeLogError(key, 'string', value);
                return false;
            }
        if (key == 'inputs')
            if(!isValidJobOptInputs(value)) {
                //typeLogError(key, 'InputDataSocket|string[]|JobInputs', value);
                return false;
            }
        if (key == 'exportVar')
            if(!isRecordOfStringToStringOrNumber(value)) {
                //typeLogError(key, 'Record<string, string|number>', value);
                return false;
            }
        if (key == 'modules')
            if(!isArrayOfString(value)) {
                //typeLogError(key, 'string[]', value);
                return false;
            }
        if(key == 'script')
            if(!isReadableOrString(value)) {
                //typeLogError(key, 'Readable|string', value);
                return false;
            }
    }
    return true;
}
