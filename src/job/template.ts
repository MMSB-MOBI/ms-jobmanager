import { JobOpt, JobOptKeys  } from '../shared/types/server';
import { EngineInterface } from '../lib/engine' ;
import {format as uFormat} from 'util';
import { logger } from '../logger';
import { JobOptProxy } from '../shared/types/client';
import { uuid } from '../shared/types/base';
import { netStreamInputs } from '../shared/types/server';


interface JobOptSpecs {
    engine : EngineInterface,
    emulator: boolean,
    internalIP : string,
    internalPport : number,
    cache:string,
    fromConsumerMS:boolean
}
// Test for jobProfile

export function transformProxyToJobOpt( jobID:uuid, 
                                        jopx:JobOptProxy,
                                        remoteData:netStreamInputs,
                                        joSpec:JobOptSpecs
                                        ):JobOpt {

    const { engine, emulator, internalIP, internalPport, cache, fromConsumerMS } = joSpec;
    // All engine parameters are set at this stage, working on folder creations should be safe
    // Check for intermediary folders in workdirpath
    // rootCache /job.iCache??""/ namespace ??"" / jobID
   
    const jo:Partial<JobOpt> =  {
        // "engineHeader": engine.generateHeader(jobID, jobProfileString, workDir),
     "engine" : engine,
     "emulated": emulator,
     "adress": TCPip,
     "port" : TCPport,
     "jobProfile" : jopx.jobProfile ? jopx.jobProfile : "default",
     "fromConsumerMS" : fromConsumerMS
     };

    for (let jok of JobOptKeys.filter((k:string) => k != 'inputs')) {
        //@ts-ignore
        jo[jok] = jopx[jok];
    }
    jo.id = jobID;

    jo.workDir = `${cache}/${jobID}`;
    if (jopx.namespace || engine.iCache) {       
        jo.workDir = cache ? `${cache}/` : "";
        jo.workDir += engine.iCache ? `${engine.iCache}/` : ""; 
        jo.workDir += jopx.namespace ? `${jopx.namespace}/` : ""; 
        jo.workDir += jobID;
        logger.debug(`Set job workDir to ${jo.workDir}`);
    }

    jo.inputs = remoteData.inputs;  // TO RESUME HERE
    jo.script = remoteData.script;
    logger.debug(`Transformed JobOpt is :\n${uFormat(jo)}`)
    return jo as JobOpt;
}

export function pprintJobTemplate(jt:JobOpt):string {

    let asString = `jobOptInterface\n\tengine:${jt.engine}}\n\tworkDir:${jt.workDir}\n\temulated:${jt.emulated}`;
    asString    += `\n\tadress/port:${jt.adress}${jt.port}\n\tjobProfile:${jt.jobProfile}`;
    asString    += jt.modules        ? `\n\tmodules:${jt.modules}` : '';
    asString    += jt.script         ? `\n\texportVar:${jt.script}` : '';
    asString    += jt.cmd            ? `\n\tcmd:${jt.cmd}` : '';
    asString    += jt.inputs         ? `\n\tinputs:${jt.inputs}` : '';
    asString    += jt.exportVar      ? `\n\texportVar:${uFormat(jt.exportVar)}` : '';
    asString    += jt.tagTask        ? `\n\ttagTask:${jt.tagTask}` : '';
    asString    += jt.ttl            ? `\n\tttl:${jt.ttl}` : '';
    asString    += jt.sysSettingsKey ? `\n\tsysSettingsKey:${jt.sysSettingsKey}` : '';

    return asString;
}