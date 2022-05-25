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

export const JobOptKeys = [ 'exportVar', 'modules', 'script', 'cmd', 'inputs', 'tagTask', 'ttl', 'socket', 'sysSettingsKey', 'jobProfile'];

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

/*

        logger.debug(`i grant access to ${jobID}`);
            
            const socketNamespace = jobID;
            const newData:Record<string, any> = {
                script: ss.createStream(),
                inputs: {}
            };
            for (let inputSymbol in jobOptProxy.inputs) {
                //let filePath = data.inputs[inputSymbol];
                //logger.debug(`-->${filePath}`);
                newData.inputs[inputSymbol] = ss.createStream();
                logger.debug(`ssStream emission for input symbol '${inputSymbol}'`);
                ss(socket).emit(`${socketNamespace}/${inputSymbol}`, newData.inputs[inputSymbol]);
                //logger.warn('IeDump from' +  socketNamespace + "/" + inputSymbol);
                //newData.inputs[inputSymbol].pipe(process.stdout)
            }
            ss(socket).emit(socketNamespace + "/script", newData.script);
            //logger.error(`TOTOT2\n${util.format(newData)}`);
            for (let k in data) {
                if (k !== 'inputs' && k !== 'script')
                    newData[k] = data[k];
            }
            newData.socket = socket;
*/



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