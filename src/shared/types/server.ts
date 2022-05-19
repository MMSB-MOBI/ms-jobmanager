import { JobOptBase } from './common/jobopt_model';
import { EngineInterface, EngineSpecs, BinariesSpec, isBinariesSpec, isEngineSpec } from '../../lib/engine';


import path = require('path');
import {logger} from '../../logger';
import util = require('util');

export type ServerStatus = 'busy' | 'available' 


export interface JobOpt extends JobOptBase{
    engine : EngineInterface, // it is added by the jm.push method
    
    // To allow mutliple slurm user 
    sysSettingsKey?:string,
   
    port : number, // JobManager MicroService Coordinates
    adress : string, // ""
    workDir : string,
    emulated? : boolean,
    cwd? : string,
    cwdClone? : boolean,
    ttl? : number
}

export interface JobSerial extends JobOptBase{
    id:string,
    workDir: string,
    scriptHash :string,
    inputHash? : Record<string, string|number>
    cmd?:string
}

export interface jobManagerSpecs {
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

export function isSpecs(opt: any): opt is jobManagerSpecs {
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