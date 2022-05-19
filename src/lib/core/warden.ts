import {logger} from '../../logger';
import { openBar } from '../../comLayer/serverShell'
import * as liveMemory from './pool';
import { EventEmitter } from 'events';
import { EngineInterface, EngineListData } from '../engine'
import {format as uFormat} from 'util';
import { Job } from '../../job';
import { Socket } from 'socket.io';

let engine:EngineInterface, 
nWorker:number,
wardenPulse:number,
topLevelEmitter : EventEmitter;

interface wardenSpecs {
    topLevelEmitter : EventEmitter, 
    engine:EngineInterface, 
    nWorker:number,
    wardenPulse: number
}
export function setWarden(spec:wardenSpecs):NodeJS.Timer {
    engine = spec.engine;
    nWorker = spec.nWorker;
    topLevelEmitter = spec.topLevelEmitter;
    wardenPulse = spec.wardenPulse;
    return setInterval(() => jobWarden(), wardenPulse);
}


export function wardenKick(msg:string, error:string, job:Job):void{
    logger.silly('wardenKick')
    liveMemory.removeJob({jobObject : job});
    if (job.socket)
        job.socket.emit('fsFatalError', msg, error, job.id);
}


let prevMemSize=0;
export function jobWarden():void {
    if(!engine)
        throw("warden must be set");
        
    logger.silly("jobWarden")
    const _ = liveMemory.size();
    if (_ != prevMemSize) {
        logger.debug(`liveMemory changed ${prevMemSize} => ${_}`);
        prevMemSize = _;
    }
    engine.list().on('data', function(d:EngineListData) {
        logger.silly(`${uFormat(d)}`);
        for (let job of liveMemory.startedJobiterator()) {
            let jobSel = { jobObject : job };            
            if (d.nameUUID.indexOf(job.id) === -1) { // if key is not found in listed jobs
                job.MIA_jokers -= 1;
                logger.warn(`The job ${job.id} missing from queue! Jokers left is ${job.MIA_jokers}`);
                if (job.MIA_jokers === 0) {
                    const tmpJob = job;
                    liveMemory.removeJob(jobSel);
                    if(liveMemory.size("notBound") < nWorker)
                        openBar();
                    logger.error(`job ${job.id} definitively lost`)    
                    tmpJob.jEmit('lostJob', tmpJob);
                }
            } else {
                if (job.MIA_jokers < 3)
                    logger.info(`Job ${job.id} found BACK ! Jokers count restored`);

                    job.MIA_jokers = 3;
                    liveMemory.setCycle(jobSel,'++');
                    ttlTest(job);
                }
        }
    }).on('listError', function(err:any) {
        topLevelEmitter.emit("wardenError", err)
    });
}

function ttlTest(job:Job, ) {
    if (!job.ttl) return;
    let jobSel = { jobObject : job }; 
    let nCycle = liveMemory.getCycle(jobSel);
    if (typeof nCycle === 'undefined') {
        logger.error("TTL ncycle error");
        return;
    }
    const elaspedTime = wardenPulse * nCycle;
    logger.warn(`Job is running for ~ ${elaspedTime} ms [ttl is : ${job.ttl}]`);
    if(elaspedTime > job.ttl) {
        logger.warn(`TTL exceeded for Job ${job.id} attempting to terminate it`);
        engine.kill([job]).on('cleanExit', function(){
            job.jEmit('killed');
            //eventEmitter.emit("killedJob", job.id);
            liveMemory.removeJob(jobSel);
            if(liveMemory.size() < nWorker)
                openBar();
        }); // Emiter is passed here if needed
    }
}