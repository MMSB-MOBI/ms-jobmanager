import { JobOpt, JobOptKeys  } from '../shared/types/server';
import { EngineInterface } from '../lib/engine' ;
import {format as uFormat} from 'util';
import { logger } from '../logger';
import { JobOptProxy } from '../shared/types/client';
import { uuid } from '../shared/types/base';
import { netStreamInputs } from '../shared/types/server';
import { Socket } from 'socket.io';

interface JobOptSpecs {
    engine : EngineInterface,
    emulator: boolean,
    internalIP : string,
    internalPort : number,
    cache:string,
    socket:Socket
}
// Test for jobProfile

export function transformProxyToJobOpt( jobID:uuid, 
                                        jopx:JobOptProxy,
                                        remoteData:netStreamInputs,
                                        joSpec:JobOptSpecs
                                        ):JobOpt {

    const { engine, emulator, internalIP, internalPort, cache, socket } = joSpec;
   
    const jo:Partial<JobOpt> = {};

    for (let jok of JobOptKeys.filter((k:string) => k != 'inputs')) {
        //@ts-ignore
        jo[jok] = jopx[jok];
    }
    jo.id             = jobID;
    jo.engine         = engine;
    jo.emulated       = emulator;
    jo.internalIP     = internalIP;
    jo.internalPort   = internalPort;
    jo.jobProfile     = jopx.jobProfile ? jopx.jobProfile : "default";
    jo.fromConsumerMS = socket ? true : false;
    jo.socket         = socket ?? undefined

    jo.workDir = `${cache}/${jobID}`;
    if (jopx.namespace || engine.iCache) {       
        jo.workDir = cache ? `${cache}/` : "";
        jo.workDir += engine.iCache ? `${engine.iCache}/` : ""; 
        jo.workDir += jopx.namespace ? `${jopx.namespace}/` : ""; 
        jo.workDir += jobID;
        logger.debug(`Set job workDir to ${jo.workDir}`);
    }

    jo.inputs = remoteData.inputs;
    jo.script = remoteData.script;
    logger.debug(`Transformed JobOpt is :\n${uFormat(jo)}`)
    return jo as JobOpt;
}

export function pprintJobTemplate(jt:JobOpt):string {

    let asString = `jobOptInterface\n\tengine:${jt.engine}}\n\tworkDir:${jt.workDir}\n\temulated:${jt.emulated}`;
    asString    += `\n\tadress/port:${jt.internalIP}${jt.internalPort}\n\tjobProfile:${jt.jobProfile}`;
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