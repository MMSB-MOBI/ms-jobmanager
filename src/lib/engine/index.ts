import {logger} from '../../logger.js';
import jobLib = require('../../job');
import { Job } from '../../job';

import events = require('events');

//export {jobObject} from '../../job';

//import cType = require('../../commonTypes.js');
import *  as nixLike from './localNixLike';
//import nixLike = require('./localNixLike.js');
import *  as slurm from './slurm';
//import slurm = require('./slurm.js');

export interface EngineListData {
        'id'?:        string[];
        'partition'?: (string|null)[];
        'nameUUID':   string[]; // Only mandatory one
        'status'?:    string[];
}

export interface SetSysProfileFunc { // Redefine engine system settings using profiles.engineSys stringMap eg: progiles/slurm.ts
    (profileName:string): void;
}

export interface EngineHeaderFunc {
    (jobID:string, jobProfileKey:string|undefined, workDir:string) :string;
}
export interface EngineList {
    () :events.EventEmitter;
}
export interface EngineTest {
    () :string;
}
export interface EngineKill {
    (jobList:Job[], overrideBinary?:string) :events.EventEmitter;
}

export interface engineExecUser {
    ():string|undefined
}

export interface EngineInterface {
    generateHeader : EngineHeaderFunc;
    submitBin : string;
    queueBin? : string;
    cancelBin? : string;
    list : EngineList;
    kill : EngineKill;
    testCommand : EngineTest;
    specs:engineSpecs;
    setSysProfile : SetSysProfileFunc;
    iCache?:string;
    execUser?: string; 
}

export type engineSpecs = "slurm" | "sge" | "emulate" | "dummy";
export function isEngineSpec(type: string): type is engineSpecs {
    return type == "slurm" || type ==  "sge" || type ==  "emulate";
}

export interface BinariesSpec {
    cancelBin : string;
    queueBin : string;
    submitBin : string;
 }

 const isSetEqual = (a:Set<any>,b:Set<any>) => a.size === b.size && [...a].every(value => b.has(value))

 const binariesKeys:Set<string> = new Set(["submitBin", "queueBin", "cancelBin"])
 
 export function isBinariesSpec(binaries: any): binaries is BinariesSpec {
    let x = new Set(Object.keys(binaries))
    return isSetEqual(x, binariesKeys);
 }

export interface preprocessorMapFn {
    (v:string) : string;
}
export type preprocessorMapperType = { [s:string] : preprocessorMapFn }

//Returns new instance of engine Object
export function getEngine(engineName?:engineSpecs, engineBinaries?:BinariesSpec): EngineInterface{
    //logger.info("Get engine " + Object.keys(engineBinaries))
    logger.debug(`Asked engine symbol ${engineName}`);

    if (engineBinaries) logger.debug(`Personnalized engineBinaries provided : ${JSON.stringify(engineBinaries)}`)

    if (!engineName) {
        logger.info('Binding manager with dummy engine');
        return new dummyEngine();
    }

    if(engineName == 'emulate')
        return new nixLike.nixLikeEngine();

    if(engineName == 'slurm')
        return new slurm.slurmEngine(engineBinaries);

        
    logger.error(`Unknown engine name ${engineName}`);
    return new dummyEngine();
}


export class dummyEngine implements EngineInterface {
    constructor() {
    }
    specs:engineSpecs='dummy';
    submitBin:string = 'dummyExec';
    //logger.info(engineBinaries)
    setSysProfile(a:string) {
       logger.info("Dummy Engine setSysProfile call");
    }
    generateHeader (a : string, b : string|undefined):string {
        return 'dummy Engine header';
    }
    list() {
        let evt = new events.EventEmitter();
        let t:NodeJS.Timer =  setTimeout(function() {
            evt.emit("data", <EngineListData>{  'id': ['dummyID'], 'partition': ['dummyPartition'],
                                'nameUUID': ['dummyNameUUID'], 'status': ['dummyStatus'] });
      //your code to be executed after 1 second
        }, 500);
        return evt;
    }
    kill(jobList : Job[]) {
        return new events.EventEmitter();
    }
    testCommand() {
        return 'sleep 10; echo "this is a dummy command"';
    }
}

