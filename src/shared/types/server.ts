import { JobOptBase } from './common/jobopt_model';
import { EngineInterface, EngineSpecs, BinariesSpec, isBinariesSpec, isEngineSpec } from '../../lib/engine';
import { Readable } from 'stream';
import { Socket as SocketServer } from 'socket.io';
import path = require('path');
import {logger} from '../../logger';
import util = require('util');
import { uuid } from './base';
import { JobInputs } from '../../job/inputs';
export type ServerStatus = 'busy' | 'available' 

export const JobOptKeys = [ 'exportVar', 'venv', 'modules', 'script', 'cmd', 'inputs', 'tagTask', 'ttl', 'socket', 'sysSettingsKey', 'jobProfile'];

export interface JobOpt extends JobOptBase{
    id: uuid,
    engine : EngineInterface, 
    emulated: boolean,   
    internalIP:string,
    internalPort:number,
    workDir : string,    
    cwd? : string,
    cwdClone? : boolean,
    ttl? : number
    sysSettingsKey?:string,
    fromConsumerMS : boolean
    inputs : Record<string, Readable>|JobInputs,
    script : Readable
    socket : SocketServer
}

export interface netStreamInputs {
    script: Readable,
    inputs: Record<string, Readable>
}


export interface JobSerial extends JobOptBase{
    id:string,
    workDir: string,
    scriptHash :string,
    inputHash? : Record<string, string|number>
    cmd?:string
}

export interface JobManagerSpecs {
    cacheDir : string,
    tcp : string,
    port : number,
    nWorker?:number,
    cycleLength? : string,
    forceCache? : string,
    engineSpec : EngineSpecs,
    microServicePort?:number;
    warehouseAddress?: string,
    warehousePort?: number,
    warehouseTest?: boolean,
    engineBinaries?: BinariesSpec
}

export function isSpecs(opt: any): opt is JobManagerSpecs {
    console.dir(opt);
    if(!path.isAbsolute(opt.cacheDir)) {
        logger.error('cacheDir parameter must be an absolute path');
        return false;
    }

    if (opt.engineBinaries) {
        logger.debug("Testing specified engineBinaries")
        if (!isBinariesSpec(opt.engineBinaries)) {
            logger.error(`Wrong binariesSpec\n ${util.inspect(opt.engineBinaries)}`)
            return false;
        }
    }

    if ('cacheDir' in opt && 'tcp' in opt && 'port' in opt && 'engineSpec' in opt){
        return typeof(opt.cacheDir) == 'string' && typeof(opt.tcp) == 'string' &&
               typeof(opt.port) == 'number' && isEngineSpec(opt.engineSpec);
    }
        
    return false;
}