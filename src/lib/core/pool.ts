/*
    Managing the jobManager Core jobs Object References
*/
const deepEqual = require('deep-equal');
import { Job } from '../../job';
import { JobSerial } from '../../shared/types/server';
//import {lookup as liveLookup, add as liveStore, remove as liveDel} from "./warehouse.js";
import {logger} from '../../logger';
import {format as uFormat} from 'util';

export type jobStatus = "CREATED" | "SUBMITTED" | "COMPLETED"| "START"|"FINISHED";
export function isJobStatus(type: string): type is jobStatus {
    return type == "CREATED" || type ==  "SUBMITTED" || type ==  "COMPLETED" || type == "START"|| type == "FINISHED";
}
type jobShimmering = "source" | "bound";

type shimOrStatus = jobShimmering | jobStatus;

export function isShimOrStatus(type: jobShimmering|jobStatus): type is shimOrStatus {  // We exclude undefined
    return type == "CREATED" || type ==  "SUBMITTED" || type ==  "COMPLETED" || type == "START"|| type == "FINISHED" || type == "source" || type == "bound";
}


interface jobWrapper {
    'obj': Job,
    'status': jobStatus,
    'nCycle': number,
    'sType' : jobShimmering|undefined
};


let jobsArray : {[s:string] : jobWrapper } = {};

export type ISearchKey = { jid: string } | { jobSerial: JobSerial } | { jobObject:Job };


export function size(opt?:string):number{
    let c:number = 0;
    if(!opt) {
        for (let w of wrapperIter())
            c++;
    }
    else if (opt === 'source') {
        for (let w of sourceWrapperIter())
            c++;
    }
    else if (opt === 'notBound') {
        for (let w of notBoundWrapperIter())
            c++;
    }
  
    return c;
}

/*  We should follow shimmerings */
export function removeJob(query:ISearchKey):boolean {

    logger.silly(`Trying to remove ${uFormat(query)}`)
    let queryID = coherceToID(query);
    if(!queryID) {
        logger.error(`Unable to removeJob based on following query ${uFormat(query)}`);
        return false;
    }
    let jobToDel:Job|undefined = getJob(query);
    if (!jobToDel) {
        logger.debug(`No job in memory for job selector ${query}`);
        return false;
    }
    logger.debug(`Removing ${jobToDel.pprint()}\n
==>[${jobToDel.hasShimmerings.length} shimmerings to delete]`);
    jobToDel.hasShimmerings.forEach((shimerJob)=>{removeJob({jobObject:shimerJob});});

    delete jobsArray[queryID];
    logger.debug("Removing successfully");
    
    return true;
}

export function addJob(newJob:Job){
    let nWrapper:jobWrapper = {
        'obj': newJob,
        'status': 'CREATED',
        'nCycle': 0,
        'sType':undefined
    };
    jobsArray[newJob.id] = nWrapper;
    logger.debug("Adding successfully")

}

export function setCycle(query:ISearchKey, n:number|string):boolean{
    let w = getJobWrapper(query);
    if(!w) {
        logger.error('Cant set cycle');
        return false;
    }
    if(typeof(n) == "number")
        w.nCycle = n;
    else if(n === '++')
        w.nCycle += 1;
    else {
        logger.error(`Cant set cycle with that \"${uFormat(n)}\"`);
        return false;
    }
    return true;
}

export function getCycle(query:ISearchKey):number|undefined{
    let w = getJobWrapper(query);
    if(!w) {
        logger.error('Cant get cycle');
        return undefined;
    }

    return w.nCycle;
}

function getJobWrapper(query:ISearchKey):jobWrapper|undefined {
    let queryID = coherceToID(query);
    if(!queryID) 
        return undefined;
    
    if(jobsArray.hasOwnProperty(queryID)) 
        return jobsArray[queryID];
    
    logger.error(`id \"${queryID}\" not found in current jobs pool:\n
${asString()}`);
    return undefined;
}

export function getJob(query:ISearchKey):Job|undefined {
    let jobWrapper = getJobWrapper(query);
    if(jobWrapper) 
        return jobWrapper.obj;
    return undefined;
}

export function getJobStatus(query:ISearchKey):jobStatus|undefined {
    let jobWrapper = getJobWrapper(query);
    if(jobWrapper) 
        return jobWrapper.status;
    return undefined;
}

 export function* startedJobiterator(){
    for (let w of sourceWrapperIter()){        
        if(w.status !== "CREATED")
            yield w.obj;
    }
}

export function asString():string {
    return Object.keys(jobsArray).map((jid:string)=>{
        let j:Job = <Job>getJob({'jid' : jid});
        return `${uFormat(j.toJSON())}`;
    }).join('\n');
}

export function jobSet(status:any,query:ISearchKey):boolean {
    let jobWrapper = getJobWrapper(query);
    if (!jobWrapper)
        return false;
    if(!isShimOrStatus(status)) {
        logger.error(`unrecognized status to set \"${status}\"`);
        return false;
    }

   if(isJobStatus(status))
        jobWrapper.status = status; 
    else // its a shim
        jobWrapper.sType = status;
    
        return true;
}

/* low-level iterators */
function* wrapperIter() {
    for (let j in jobsArray) {
        yield jobsArray[j];
    }
}

function* sourceWrapperIter() {
    for (let _w of wrapperIter()) {
        let w = <jobWrapper>_w;
        if(w.sType)
            if(w.sType == 'source')
                yield w;
    }
}

// To count the number of job that are source or yet to be set
function* notBoundWrapperIter() {
    //logger.info("notBoundWrapperIter");
    for (let _w of wrapperIter()) {
        let w = <jobWrapper>_w;
        if(!w.sType)
            yield w;
        else if(w.sType == 'source')
            yield w;
    }
}

function* sourceJobIter() {
    for (let w of sourceWrapperIter())
        yield w.obj;
}

function coherceToID(query:ISearchKey):string|undefined {
    if('jid' in query)
        return query.jid;
    if('jobSerial' in query)
        return query.jobSerial.id;
    if('jobObject' in query) 
        return query.jobObject.id;
    
    logger.error(`can\'t coherce that ${uFormat(query)}`);
    return undefined;
}




/*  job resurrection source search 
    Operation are performed on a subset of jobsArray element, the ones that are wrapped with the "source" sType

*/

/*
 Returns list of common element bewteen a and b sets
*/
function _intersect(a:any[], b:any[]):any[] {
    // console.dir(a);
    // console.dir(b);
    let t;
    if (b.length > a.length) t = b, b = a, a = t; // indexOf to loop over shorter
    return a.filter(function (e) { // loop onto the shorter
        for (let i in b) {
            if (deepEqual(b[i], e)) return true;
        }
        return false;
    });
}

//lambda function to filterout item/warehouse elemnt

type deepKey = 'exportVar'| 'modules'| 'inputHash';
type shallowKey = 'tagTask'| 'scriptHash';
function isConstraintsOk(item:JobSerial, query:JobSerial): boolean {
    // Deep check // escaping module values check
    for ( let field of ['exportVar', 'inputHash', 'modules']) {
        let k = <deepKey>field;
        if(!query[k] && item[k]) return false;
       
        if (query[k]) {
            if (!item[k]) return false;
            if(field === 'module') continue;

            let queryIter =<Record<string, string>>query[k];
            let itemIter = <Record<string, string>>item[k];

            if ( Object.keys(queryIter).length !=  Object.keys(itemIter).length) return false;
            if (_intersect( Object.keys(queryIter), Object.keys(itemIter) ).length !=  Object.keys(queryIter).length) return false;
            
            for (let i in queryIter)
                if (queryIter[i] !== itemIter[i]) return false;
        }
    };

    for ( let field of ['modules']) {
        let k = <deepKey>field;
        let queryIter = query[k] as string[];
        let itemIter = item[k] as string[];
        if (queryIter.length != itemIter.length) return false;
        if (_intersect(queryIter, itemIter).length !=  queryIter.length) return false;
    }

    // Scalar/shallow check
    for ( let field in ['tagTask', 'scriptHash']) {
        let k = <shallowKey>field;
        if(!query[k] && item[k]) return false;

        if (query[k]) {
            if (!item[k]) return false;
            if (query[k] !== item[k]) return false;
        }
    };

    return true;
}

/* --  a function that look for jobs satisfying a constraints in a list --*/
export function lookup(jobAsked:Job):Job[]|undefined {
    let hits:Job[] = []
    let query = jobAsked.getSerialIdentity();
    for (let job of sourceJobIter()) {
        let item = job.getSerialIdentity();
        if( isConstraintsOk(query, item) )
            hits.push(job);
    }
    logger.silly(`Found ${hits.length} hits in liveMemory`);
    if(hits.length == 0) return undefined;
    return hits;

}