import { EventEmitter } from "events"; 
import { logger } from '../../../logger';
import { JobInputs } from '../../../job/inputs';
import { Readable } from 'stream';
import uuidv4 = require('uuid/v4');
import { JobOptBase } from './jobopt_model';
import { format as uFormat } from 'util';

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

    constructor(jobOpt:JobOptBase, uuid?:string){
        super();
      
        logger.debug(`JobBase Constuctor uuid:${uuid} , JobOpt:${uFormat(jobOpt)}`);
        this.id = uuid ? uuid : uuidv4();
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
        if('exportVar' in jobOpt)
            this.exportVar = jobOpt.exportVar;
        logger.debug("job base inputs are "  +  uFormat(jobOpt.inputs));
        
        this.inputs = new JobInputs(jobOpt.inputs);
    }

    pprint():string {
        let asString = `Job id : ${this.id}`;
        asString += this.modules    ? `\n\tmodules    :${this.modules}`    : ''
        asString += this.jobProfile ? `\n\tjobProfile :${this.jobProfile}` : ''
        asString += this.script     ? `\n\tscript     :${this.script}`: ''
        asString += this.tagTask    ? `\n\ttagTask    :${this.tagTask}`: ''
        asString += this.namespace  ? `\n\tnamespace  :${this.namespace}`: ''      
        asString += this.exportVar  ? `\n\texportVar  :${uFormat(this.exportVar)}`: ''
        
        return asString;
    }

}