import { EventEmitter } from "events"; 
import { Socket } from "socket.io-client";
import { JobInputs } from '../../../job/inputs';
import { Readable } from 'stream';
import uuidv4 = require('uuid/v4');
import { JobOptBase } from './jobopt_model';
import { format as uFormat } from 'util';

/*
export abstract class JobBase extends EventEmitter {
    id : string;
    script? :string|Readable;
    cmd? :string;
    exportVar? : Record<string, string|number> = {};
    inputs :JobInputs;
    jobProfile? : string;
    tagTask? :string;
    namespace? :string;
    modules? :string[] = []; 
    socket?:Socket
    isShimmeringOf?:Job
    hasShimmerings:JobProxy[] = []

}

*/

/* Mother class for Job  and JobProxy */
export class JobBase extends EventEmitter implements JobOptBase{
    id : string;
    script? :string|Readable;
    cmd? :string;
    exportVar? : Record<string, string|number> = {};
    inputs :JobInputs;
    jobProfile? : string;
    tagTask? :string;
    namespace? :string;
    modules? :string[] = []; 
    socket?:Socket

    constructor(jobOpt:JobOptBase, uuid?:string){ // Quick and dirty typing
        super();
        this.id = uuid ? uuid : uuidv4();
        console.log("===>" + this.id);
        if ('modules' in jobOpt)
            this.modules = jobOpt.modules;
        if ('jobProfile' in jobOpt)       
            this.jobProfile =  jobOpt.jobProfile;
        if('script' in jobOpt)
            this.script =  jobOpt.script;
        if ('tagTask' in jobOpt)
            this.tagTask = jobOpt.tagTask;
        if ('namespace' in jobOpt)
            this.namespace = jobOpt.namespace;
        if ('socket' in jobOpt) 
            this.socket = jobOpt.socket;
        if('exportVar' in jobOpt)
            this.exportVar = jobOpt.exportVar;
       
        this.inputs = new JobInputs(jobOpt.inputs);

    }

    pprint():string {
        let asString = `Job id : ${this.id}`;
        asString += this.modules    ? `\n\tmodules    :${this.modules}`    : ''
        asString += this.jobProfile ? `\n\tjobProfile :${this.jobProfile}` : ''
        asString += this.script     ? `\n\tscript     :${this.script}`: ''
        asString += this.tagTask    ? `\n\ttagTask    :${this.tagTask}`: ''
        asString += this.namespace  ? `\n\tnamespace  :${this.namespace}`: ''
        asString += this.socket     ? `\n\tsocket     :${this.socket}`: ''
        asString += this.exportVar  ? `\n\texportVar  :${uFormat(this.exportVar)}`: ''
        
        return asString;
    }

}