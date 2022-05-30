import { EventEmitter } from 'events';
import { JobProxy, JobOptProxy, JobOptClientFactory } from '../shared/types/client'
import { io, Socket } from "socket.io-client";
import { createReadStream } from 'fs';
import { Readable } from 'stream'
import { ClientToServerEvents, ServerToClientEvents, responseFS} from '../lib/socket-management/interfaces';

const ss = require('socket.io-stream');
import { format as uFormat } from 'util';
import { logger } from '../logger';
import { ServerStatus } from '../shared/types/common'
import { JobSerial } from '../shared/types/server'
import { Writable } from 'stream';
import { uuid } from '../shared/types/base';
import { Path } from '../shared/types/base';
let socket:Socket<ServerToClientEvents, ClientToServerEvents>;

type JobWrapStatus = 'idle' | 'sent' | 'bounced' | 'granted' | 'completed';

interface JobWrap {
    job: JobProxy,
    //data: Object,
    jobOpt : JobOptProxy,
    status: JobWrapStatus
}

/*
    Defining object to take care of job sumbissions
*/
class jobAccumulator extends EventEmitter {
    jobsPool:Record<string, JobProxy> = {};
    jobsQueue:JobWrap[] = [];
    jobsPromisesReject:Record<uuid, (value:unknown)=>void>    = {};
    jobsPromisesResolve:Record<uuid, (reason?:unknown)=>void> = {};
    JMstatus:ServerStatus = 'busy';
    socket?:Socket;

    constructor() {
       super();
       logger.info("Coucou from reforging dev");
       // running managment loop;
        //setInterval(this.pulse(), 500);
    }
    _getJobQueueWrapper(jobID:string) {
        for (let jobWrap of this.jobsQueue)
            if (jobWrap.job.id == jobID)
                return jobWrap;
        return undefined;
    }
    _countSentJob() {
        let c = 0;
        for (let jobWrap of this.jobsQueue)
            if (jobWrap.status == 'sent')
                c++;
        return c;
    }
    _getWaitingJob():JobWrap|undefined{
        for (let jobWrap of this.jobsQueue)
            if (jobWrap.status == 'idle' || jobWrap.status == 'bounced')
                return jobWrap;
        return undefined;
    }
    popQueue():Promise<string> {
       
        //Promise resolution is delegated to the socket listener in bind method
        const jobWrap = this._getWaitingJob();
        const self = this;
        const p = new Promise((resolve, reject) => {
           
            if (!jobWrap) {
                logger.debug("Queue exhausted");
                reject({ type: 'exhausted' });
                return;
            }
            self.jobsPromisesResolve[jobWrap.job.id] = resolve;
            self.jobsPromisesReject[jobWrap.job.id] = reject;
            // if bounced status, stream are already setup
            if (jobWrap.status == 'idle') {
                // Building streams for newly submitted job
                // test data refers to a list of file
                // We build a litteral with the same keys but with values that are streams instead of path to file
                // Then we bind stream to the socket using the litteral keys to define the socket event names
                // We handle provided key/value pairs differently
                //  script -> a readable stream
                // inputs -> a string map of readablestream
                // module -> a list of string
                // exportVars -> a string map
                // if a cmd is passed we make it a stream and assign it to script
                //const data = jobWrap.data;
                const _jobOpt = jobWrap.jobOpt;
                const job = jobWrap.job;
                const jobOpt = buildStreams(_jobOpt, job); // 1st arg carries data to server, 2nd arg register events
                logger.debug(`jobOpt passed to socket w/ id ${job.id}:\n${uFormat(jobOpt)}`);
                ss(socket, {}).on(job.id + '/script', (stream:Writable) => { jobOpt.script.pipe(stream); });
                for (let inputEvent in jobOpt.inputs)
                    ss(socket, {}).on(job.id + '/' + inputEvent, (stream:Writable) => {
                        jobOpt.inputs[inputEvent].pipe(stream);
                    });
                logger.silly(`EMITTING THIS ORIGINAL ${job.id}\n${uFormat(jobOpt)}`);
            }
            else {
                logger.silly(`EMITTING THIS RESUB ${jobWrap.job.id}\n${uFormat(jobWrap.jobOpt)}`);
            }
            jobWrap.status = 'sent';
            // I'd prefer socket.emit('newJobSocket', job.id, jobWrap.jobOpt);
            socket.emit('newJobSocket', jobWrap.job.id, jobWrap.jobOpt);
        });
        return p as Promise<string>;
    }

    abortAll(){
        for(const [jobId, jobProxyObj] of Object.entries(this.jobsPool)){
            console.log(jobId +  "abort");
            (jobProxyObj as JobProxy).emit("disconnect_error")
            this.deleteJob(jobId)
        }
    }

    appendToQueue(/*data,*/ jobOpt:JobOptProxy):JobProxy {
        const job = new JobProxy(jobOpt, socket);
        this.jobsPool[job.id] = job;
        //data.id = job.id;
        this.jobsQueue.push({
            'job': job,
          //  'data': data,
            'jobOpt': jobOpt,
            'status': 'idle'
        });
        logger.silly(`appendToQueue ${job.id}`)
        if (this.isIdle())
            this.pulse();
        return job;
    }
    isIdle() {
        for (let jobWrap of this.jobsQueue)
            if (jobWrap.status == 'sent')
                return false;
        return true;
    }
    deleteJob(jobID:string) {
        if (this.jobsPool.hasOwnProperty(jobID)) {
            delete (this.jobsPool[jobID]);
            delete (this.jobsPromisesResolve[jobID]);
            delete (this.jobsPromisesReject[jobID]);
            return true;
        }
        logger.error(`Can't remove job, its id ${jobID} is not found in local jobsPool`);
        return false;
    }
    pulse() {
        if (this.jobsQueue.length == 0)
            return;
        if (this._countSentJob()> 0)
            return;
        let self = this;
        // Maybe done w/ async/await
        this.popQueue().then((jobID) => {
            (self._getJobQueueWrapper(jobID) as JobWrap).status = 'granted';
            self.pulse(); // Trying to send next one asap
        }).catch((err) => {
            if (err.type == 'bouncing') {
                (self._getJobQueueWrapper(err.jobID) as JobWrap).status = 'bounced';
                setTimeout(() => { self.pulse(); }, 1500); // W8 and resend
            }
        });
    }
    flush(jobID:uuid):JobProxy|undefined {
        const job = this.getJobObject(jobID);
        if (!job)
            return undefined;
        (this._getJobQueueWrapper(jobID) as JobWrap).status = 'completed';
        this.deleteJob(jobID);
        return job;
    }
    getJobObject(maybeJobID:uuid):JobProxy|undefined {
        logger.silly(`getJobObject ${maybeJobID}`)
        if (this.jobsPool.hasOwnProperty(maybeJobID))
            return this.jobsPool[maybeJobID];
        logger.error(`job id ${maybeJobID} is not found in local jobsPool`);
        logger.error(`jobsPool : ${uFormat(Object.keys(this.jobsPool))}`);
        return undefined;
    }
    bind(socket:Socket) {
        logger.debug("Binding accumulator to socket");
        this.socket = socket;
        socket.on('jobStart', (data) => {
            logger.silly(`Client : socket on jobStart`)
            // Maybe do smtg
            // data = JSON.parse(data);
        });
        let self = this;
        socket.on('bounced', (jobID:uuid) => {
            logger.silly(`Client : socket on bounced`)
            logger.debug(`Job ${jobID} was bounced !`);
            self.jobsPromisesReject[jobID]({ 'type': 'bouncing', jobID });
        });
        socket.on('granted', (jobID) => {
            logger.silly(`Client : socket on granted`)
            logger.debug(`Job ${jobID} was granted !`);
            self.jobsPromisesResolve[jobID](jobID);
        });
        socket.on('lostJob', (_jobSerial:string) => {
            logger.silly(`Client : socket on lostJob`)
            const jobSerial:JobSerial = JSON.parse(_jobSerial)
            logger.error(`lostJob ${jobSerial.id}`)
            let jRef = this.getJobObject(jobSerial.id);
            if (!jRef){
                return;
            }
            logger.error(`Following job not found in the process pool ${jRef.id}`);
            
            jRef.emit('lostJob', jRef);
            self.deleteJob(jobSerial.id);
        });
        //  *          'listError, {String}error) : the engine failed to list process along with error message

        socket.on('fsFatalError', (msg, err, jobID) => {
            logger.silly(`Client : socket on fsFatalError`)
            let jRef = this.getJobObject(jobID);
            if (!jRef)
                return;
            jRef.emit('fsFatalError', msg, err, jRef);
            self.deleteJob(jobID);
        });
        ['scriptSetPermissionError', 'scriptWriteError', 'scriptReadError', 'inputError'].forEach((eName) => {
            socket.on(eName, (err, jobSerial) => {
                logger.fatal(`socket.on error ${err} ${uFormat(jobSerial)}`)
                let jRef = this.getJobObject(jobSerial.id);
                if (!jRef)
                    return;
                jRef.emit(eName, err, jRef);
                self.deleteJob(jobSerial.id);
            });
        });
        ['submitted', 'ready'].forEach((eName) => {
            socket.on(eName, (_jobSerial) => {
                const jobSerial = JSON.parse(_jobSerial)
                let jRef = this.getJobObject(jobSerial.id);
                if (!jRef)
                    return;
                jRef.emit('ready');
            });
        });
        socket.on('completed', pull);
        //socket.on('centralStatus', (d) => { this.JMstatus = d.status; });
    }
}
/*
    establish socket io connection with job-manager MS (via job-manager-server implementation)
    raise the "ready";
*/
/* The socket forward the following event to the local jobProxyObject
 *          'lostJob', {Object}jobObject : any job not found in the process pool
 *          'listError, {String}error) : the engine failed to list process along with error message
 *          'folderSetPermissionError', {String}msg, {String}err, {Object}job
 *          'scriptSetPermissionError', {String}err, {Object}job;
 *          'scriptWriteError', {String}err, {Object}job
 *          'scriptReadError', {String}err, {Object}job
 *          'inputError', {String}err, {Object}job
 *          'ready'
 *          'submitted', {Object}job;
 *          'completed', {Stream}stdio, {Stream}stderr, {Object}job // this event raising is delegated to jobManager
 */

const jobAccumulatorObject = new jobAccumulator();

export function start(opt:any):Promise<EventEmitter> {
    return new Promise ( (resolve, reject) => {    
        let url = 'http://' + opt.TCPip + ':' + opt.port;
        logger.debug(`jobmanager core microservice coordinates defined as \"${url}\"`);
        socket = io(url); 
        const statusEmitter = new EventEmitter()
        socket.on("connect", () => {
            logger.debug(`manage to connect to jobmanager core microservice at ${url}`);            
            jobAccumulatorObject.bind(socket);
            resolve(statusEmitter);
        })
        socket.on("connect_error", (err) => {
            reject("socket connection error")
        });
        socket.on("disconnect", () => {
            jobAccumulatorObject.abortAll(); 
            statusEmitter.emit("disconnect")
        })
    });
}

function pull(jobSerial:JobSerial) { // Should not need to decode anymore
    logger.debug(`pulling Object : ${uFormat(jobSerial)}`);
    let jobObject = jobAccumulatorObject.flush(jobSerial.id);
    if (!jobObject)
        return;
    logger.debug('completed event on socket');
    logger.silly(`${uFormat(jobObject)}`);
    jobObject.stdout = ss.createStream();
    jobObject.stderr = ss.createStream();
    logger.debug(`Pulling for ${jobObject.id}:stdout`);
    logger.debug(`Pulling for ${jobObject.id}:stderr`);
    ss(socket).emit(`${jobObject.id}:stdout`, jobObject.stdout);
    ss(socket).emit(`${jobObject.id}:stderr`, jobObject.stderr);
    jobObject.emit('completed', jobObject.stdout, jobObject.stderr, jobObject);
    return;
}
export function push(data:any):JobProxy {
   const jobOpt = JobOptClientFactory(data);
    logger.debug(`Passing following data to jobProxy constructor\n${uFormat(jobOpt)}`);
    let job = jobAccumulatorObject.appendToQueue(/*data,*/ jobOpt);
    return job;
}

interface SourcesMap  {
    script: Readable,
    inputs:Record<string,Readable>| undefined
}

function buildStreams(data:any, job:JobProxy) {
    logger.debug(`-->${uFormat(data)}`);
    //let jobInput = new jobLib.jobInputs(data.inputs);
    let jobInput = job.inputs;
    // Register error here at stream creation fail

    const sMap:SourcesMap = {
        script: createReadStream(data.script),
        inputs: undefined
    }
    sMap.script.on('error', function () {
        let msg = `Failed to create read stream from ${data.script}`;
        job.emit('scriptError', msg);
        //throw ("No one here");
    });
    jobInput.on('streamReadError', (e:string) => {
        job.emit('inputError', e);
    });
    sMap.inputs = jobInput.getStreamsMap();
    data.script = sMap.script;
    data.inputs = sMap.inputs;
    /* logger.debug("streams buildt");
     logger.debug(typeof (sMap.script));
     logger.debug(`${uFormat(sMap.script)}`);*/
    return data;
}

export function get_socket() {
    return socket;
}

const streamToString = async (stream:Readable):Promise<string> => {
    const chunks: Uint8Array[] = [];
    return new Promise ( (res, rej) => { 
        stream.on('data', (chunk: Uint8Array) => chunks.push(chunk))
        stream.on('end', () => {
            const _ = Buffer.concat(chunks).toString('utf8');             
            res(_);
        });
        stream.on('error', (err:string) => rej(err));
    })
};

export class JobFileSystemInterface {
   /* private socket:any;
    private jobID:string;
    */
   socket:Socket;
   jobID:string;

    constructor(jobID:string/*, socket:string*/) {
        this.jobID = jobID;
        this.socket = socket;
    }
    async list(path?:Path):Promise<string[]> {
        this.socket.emit('list', {jobID: this.jobID, path});
        
        return new Promise( (res, rej) => {
            this.socket.on(`${this.jobID}:list`, (file_list:string[])=> {
                res(file_list);
            });
        });
    }

    async readToStream(fileName:string):Promise<Readable>{
        const netStream = await this._read(fileName);
        return netStream as Readable;
    }

    async readToString(fileName:string):Promise<string> {
        const netStream = await this._read(fileName);
        const stdout = await streamToString(netStream)
        return(stdout)
    }

    async _read(fileName:Path):Promise<Readable>{
        return new Promise( (res, rej) => {
            // First we check for file status, then we pull stream and resolve/forward it
            this.socket.emit("isReadable", fileName, this.jobID, (response:responseFS) => {
                if (response.status == "ok") {
                    const netStream = ss.createStream();
                    ss(this.socket).emit('fsRead', netStream, {name:fileName});             
                    res(netStream);
                } else {
                    rej(uFormat({ jobID : this.jobID, message: response.content}));
                }
//// emit is readable
              });
        });    
    }
}
