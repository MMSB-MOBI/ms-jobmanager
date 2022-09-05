import {format as uFormat, inspect as uInspect} from 'util';
import uuidv4 = require('uuid/v4');
import { EventEmitter } from 'events';
import {logger} from './logger.js';
import { Job, melting }  from './job';
import { isJobOptFromClientToServer as isJobOptProxy } from './lib/socket-management/validators';
import { JobOptProxy } from './shared/types/client';
import { JobOpt } from './shared/types/server';
import { getEngine, EngineInterface } from './lib/engine'; 
//import jmServer = require('./nativeJS/job-manager-server.js');
//import *  as jmServer from 'comLayer/serverShell';// = require('./nativeJS/job-manager-server.js');

import { SocketRegistry, bouncer, granted, startSocketServer, openBar } from './comLayer/serverShell';
import * as liveMemory from './lib/core/pool.js';
import {open as openSocket} from "./lib/core/net";
import {isSpecs, JobManagerSpecs, JobSerial, netStreamInputs} from "./shared/types/server";
import { uuid } from './shared/types/base';
import {wardenKick, setWarden } from './lib/core/warden';
import {transformProxyToJobOpt, pprintJobTemplate} from './job/template';
import { MS_lookup, test as whTest, setParameters as whSetConnect, storeJob } from './lib/warehouse';
import {create as createCache} from "./lib/core/cache";
import { Socket } from 'socket.io';
//export {EngineSpecs} from './lib/engine';


let engine:EngineInterface; // to type with Engine contract function signature



let scheduler_id :string = uuidv4();

// Intervall for periodic operations
let corePulse :number = 500;
let core :NodeJS.Timer;
// Intervall for periodic monitoring
let wardenPulse :number = 5000;
let warden : NodeJS.Timer;
let cacheDir :string|null = null;

let nWorker:number = 10; // running job max poolsize


let topLevelEmitter = new EventEmitter();

let exhaustBool :boolean = false; // set to true at any push, set to false at exhausted event raise

let emulator :boolean = false; // Trying to keep api/events intact while running job as fork on local

let isStarted :boolean = false;

let microServiceSocket:SocketRegistry|undefined = undefined;

let internalIP = '127.0.0.1';
let internalPort = 2222;

function _pulse() {
    let c:number = liveMemory.size();
    if (c === 0) {
        if (exhaustBool) {
            topLevelEmitter.emit("exhausted");
            exhaustBool = false;
        }
    }
}

//CH 02/12/19
// Maybe use promess instead of emit("ready"), emit("error")
export function start(opt:JobManagerSpecs):EventEmitter {
    logger.debug(`${uFormat(opt)}`);

    if (isStarted) {
        let t:NodeJS.Timer = setTimeout(()=>{ topLevelEmitter.emit("ready"); }, 50);
        return topLevelEmitter;
    }

    if (!isSpecs(opt)) {
        let msg:string = `Missing or wrong type arguments : engine, cacheDir, opt, tcp, binariesSpec (in conf file)`;
        msg += `${uFormat(opt)}`
        //eventEmitter.emit("error", msg)
        let t:NodeJS.Timer = setTimeout(()=>{ topLevelEmitter.emit("error", msg); },50);
        return topLevelEmitter;
    }

    engine = getEngine(opt.engineSpec, opt.engineBinaries);
   
    emulator = opt.engineSpec == 'emulate' ? true : false;

    // Address, port  of the jobManager MicroService node worker communications
    internalIP  =   opt.tcp  || internalIP;
    internalPort  = opt.port || internalPort;
    
    // if a port is provided for microservice we open connection
    if(opt.microServicePort) {
        microServiceSocket =  startSocketServer(opt.microServicePort);
        logger.debug(`Listening for consumer microservices at : ${opt.microServicePort}`);
        microServiceSocket
        .on('newJobSocket', pushMS)
        .on('clientMainSocketConnection',() => logger.debug('Connection on microservice consumer socket'));
    }

    nWorker = opt.nWorker || nWorker;

    if(opt.cycleLength)
        wardenPulse = parseInt(opt.cycleLength);
    
    // Warehouse business 
    const addressWH = opt.warehouseAddress ? opt.warehouseAddress : '127.0.0.1';
    const portWH    = opt.warehousePort    ? opt.warehousePort    : 7688;
    whSetConnect({ warehouseAddress: addressWH, portSocket : portWH});
    if(opt?.warehouseTest)
        whTest(addressWH, portWH);

    cacheDir = createCache(opt.forceCache, opt.cacheDir, scheduler_id);
    
    // worker socket listener
    logger.debug(`[${internalIP}] opening worker socket at port ${internalPort}`);
    const s = openSocket(internalPort);
    s.on('coreSocketError', (e:any)  => topLevelEmitter.emit('error', e))
    .on('coreSocketListen', () => {
        isStarted = true;
        warden = setWarden({topLevelEmitter, engine, nWorker, wardenPulse})
        core      = setInterval(() => _pulse(), corePulse);
        
        topLevelEmitter.emit("ready");

        logger.info(`${pprint(opt)}`);    
    })
    .on("coreSocketUnregistredJob", (jid)=> topLevelEmitter.emit("unregistredJob", jid))
    .on("letsPull", (job) => _pull(job)); //TO DO)
    return topLevelEmitter;
}

// New job packet arrived on MS socket, 1st arg is streamMap, 2nd the socket
async function pushMS(jobID:uuid, jobOptProxy:JobOptProxy, nspJobSocket:Socket):Promise<void> {
    logger.debug(`newJob Packet arrived w/ ${uFormat(jobOptProxy)}`);
    logger.silly(` Memory size vs nWorker :: ${liveMemory.size()} <<>> ${nWorker}`);
    if (liveMemory.size("notBound") >= nWorker) {
        logger.warn("must refuse packet, max pool size reached");
        bouncer(jobID, nspJobSocket);
        return;
        // No early exit yet
    }
    
    const remoteData:netStreamInputs = await granted(jobOptProxy, jobID, nspJobSocket); 

    const jobOpt = transformProxyToJobOpt(jobID, jobOptProxy, remoteData, 
        { engine, emulator, internalIP, internalPort, cache: cacheDir as string,
            socket:nspJobSocket
        })
    const _ = _push(jobOpt);
}


function _push(jobOpt:JobOpt):Job {
    logger.debug(`Attempting Job construction w/ following jobOpt element\n${uFormat(jobOpt)}`);
    const newJob = new Job(jobOpt, jobOpt.id);

   
                  // 3 outcomes
          // newJob.launch // genuine start
          // newJob.resurrect // load from wareHouse a complete job
          // newJob.melt // replace newJob by an already running job
          //                just copying client socket if fromConsumerMS 

    if (newJob.engine.iCache) {       
        newJob.workDir = cacheDir ? `${cacheDir}/` : "";
        newJob.workDir += newJob.engine.iCache ? `${newJob.engine.iCache}/` : ""; 
        newJob.workDir += newJob.id;
        logger.info(`Redefined job workDir ${newJob.workDir}`);
    }
    logger.debug(`Following jobObject was successfully buildt \n ${newJob.pprint()}`);
        

    newJob.start();
    liveMemory.addJob(newJob);

    const fatal_error = ["folderCreationError", "folderSetPermissionError"]

    fatal_error.forEach((symbol:string) => {
        newJob.on(symbol, wardenKick);
    });

    newJob.on('submitted', function(j) {
        liveMemory.jobSet('SUBMITTED', { jobObject : newJob });
    })
    newJob.on('inputSet', function() { 
        // All input streams were dumped to file(s), we can safely serialize
        const jobSerial = newJob.getSerialIdentity();
        /*
        always lookin warehouse first, if negative look in jobsArray

        case1) warehouse/-, jobsArray/-              => submit
        case2) warehouse/+, dont look at jobsArray   => resurrect
        case3) warehouse/-, jobsArray/+              => copy jobReference and return it
        */
        MS_lookup(jobSerial)
            .on('known', function(fStdoutName: string, fStderrName: string, workPath: string) {
                newJob.respawn(fStdoutName, fStderrName, workPath);
                newJob.jEmit("completed", newJob);
            })
            .on('unknown', function() {
                logger.silly("####No suitable job found in warehouse");
                
                const previousJobs:Job[]|undefined = liveMemory.lookup(newJob);
                
                if(previousJobs) {
                    logger.debug(`${previousJobs.length} suitable living job(s) found, shimmering`);
                    melting(previousJobs[0], newJob);
                    return;
                }
                logger.debug('No Suitable living jobs found, launching');
                liveMemory.jobSet('source', { jobObject : newJob });
                newJob.launch();

                newJob.on('jobStart', function(job) {
                    engine.list()
            // shall we call dropJob function here ?
            // CH/GL 02/12/19
            //We should check for liveMemory management and client socket event propagation. 
                }).on('scriptReadError', function (err, job) {
                    logger.error(`ERROR while reading the script : \n ${err}`);
                }).on('scriptWriteError', function (err, job) {
                    logger.error(`ERROR while writing the coreScript : \n ${err}`);
                }).on('scriptSetPermissionError', function (err, job) {
                    logger.error(`ERROR while trying to set permissions of the coreScript : \n ${err}`);
                });
            });
    });

    return newJob;
}
/* USED ONLY IN SINGLERUNTIME JOBMANAGER --> MAYBE DEPREDCATED ?
function push(jobProfileString : string, jobOpt:any , namespace?: string): Job {
    logger.debug(`Following litteral was pushed \n ${uInspect(jobOpt, false, 0)}`);

    const jobID = jobOpt.id || uuidv4();
    const workDir:string = cacheDir + '/' + jobID;

    const jobTemplate = coherceIntoJobTemplate(jobProfileString, jobOpt, workDir, { engine, emulator, TCPip, TCPport });
  
    logger.debug(`Following jobTemplate was successfully buildt \n ${pprintJobTemplate(jobTemplate)}`);
    
    exhaustBool = true;

    return newJob;
}
*/
/*
    handling job termination.
    Eventualluy resubmit job if error found
*/
function _pull(job:Job):void { 
    logger.silly(`Pulling ${job.id}`);
    job.stderr().then((streamError) => {     
        let stderrString:string|null = null;
        streamError.on('data', function (datum) {
            stderrString = stderrString ? stderrString + datum.toString() : datum.toString();
        })
        .on('end', function () {          
            if(!stderrString) { _storeAndEmit(job.id); return; }
            logger.warn(`Job ${job.id} delivered the following non empty stderr stream\n${stderrString}`);
            job.ERR_jokers--;
            if (job.ERR_jokers > 0){
                logger.warn(`Resubmitting the job ${job.id} : ${job.ERR_jokers} try left`);
                job.resubmit();
                liveMemory.setCycle({jobObject:job}, 0);                
            } else {
                logger.warn(`The job ${job.id} will be set in error state`);
                _storeAndEmit(job.id, 'error');
            }
        });
    });
};

/*
 We treat error state emission / document it for calling scope
 // MAybe use jobObject as 1st parameter?
*/
function _storeAndEmit(jid:string, status?:string) {

    //let jobSel = {'jid' : jid};
    logger.debug("Store&Emit");
    let job:Job|undefined = liveMemory.getJob({ jid });
    if (job) {
        liveMemory.removeJob({ jid });
        if(liveMemory.size("notBound") < nWorker)
            openBar();       
        job.jEmit("completed", job);

        const serialJob:JobSerial = job.getSerialIdentity(); 
        // add type 
        // Make some tests on the jobFootPrint literal?
        
        storeJob(serialJob).on('addSuccess', (message: any) => {
           logger.log('success', `Job footprint stored in Warehouse`)
        });
       

        //warehouse.store(jobObj); // Only if genuine
    } else {
        logger.error('Error storing job is missing from pool');
    }
}

function pprint(opt:JobManagerSpecs) {
    return `-==JobManager successfully started==-
    scheduler_id : ${scheduler_id}
    engine type : ${engine.specs}
    internal ip/port : ${internalIP}/${internalPort}
    consumer port : ${opt.microServicePort}
    worker pool size : ${nWorker}
    cache directory : ${cacheDir}
    [DEFAULT BINARIES]
    submit binary : ${engine.submitBin}
    queue binary : ${engine.queueBin ? engine.queueBin : "No one"}
    cancel binary : ${engine.cancelBin ? engine.cancelBin : "No one"}
    `
}