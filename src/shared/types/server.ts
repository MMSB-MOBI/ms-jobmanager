import { JobOptBase } from './common';
import { EngineInterface } from '../../lib/engine';


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
}