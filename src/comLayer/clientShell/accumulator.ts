import { EventEmitter } from 'events';
import { JobProxy, JobOptProxy } from '../../shared/types/client'
import { JobWrap, SourcesMap } from './type';
import { uuid } from '../../shared/types/base';
import { ServerStatus } from '../../shared/types/common'
import { logger } from '../../logger';
import { format as uFormat} from 'util';
import { Writable, Readable } from 'stream';
import { io, Socket } from "socket.io-client";
const ss = require('socket.io-stream');
import { JobSerial } from '../../shared/types/server'
import { createReadStream } from 'fs';
import uuidv4 = require('uuid/v4');

export class JobAccumulator extends EventEmitter {
    jobsPool:Record<string, JobProxy> = {};
    jobsQueue:JobWrap[] = [];
    jobsPromisesReject:Record<uuid, (value:unknown)=>void>    = {};
    jobsPromisesResolve:Record<uuid, (reason?:unknown)=>void> = {};
    JMstatus:ServerStatus = 'busy';
    TCPip='localhost';
    port=1234;
    //socket?:Socket; // Trying to use NS

    constructor() {
       super();
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
            const _jobOpt = jobWrap.jobOpt;
            const job = jobWrap.job;
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
                
                const jobOpt = buildStreams(_jobOpt, job); 
                logger.debug(`jobOpt passed to socket w/ id ${job.id}:\n${uFormat(jobOpt)}`);
                //ss(this.socket, {}).on(job.id + '/script', (stream:Writable) => { jobOpt.script.pipe(stream); });
                ss(job.socket, {}).on('script', (stream:Writable) => { jobOpt.script.pipe(stream); });
                for (let inputEvent in jobOpt.inputs)
                  //  ss(this.socket, {}).on(job.id + '/' + inputEvent, (stream:Writable) => {
                    ss(job.socket, {}).on('input_streams/' + inputEvent, (stream:Writable) => {
                        jobOpt.inputs[inputEvent].pipe(stream);
                    });
                logger.silly(`EMITTING THIS ORIGINAL ${job.id}\n${uFormat(jobOpt)}`);
            }
            else {
                logger.silly(`EMITTING THIS RESUB ${jobWrap.job.id}\n${uFormat(jobWrap.jobOpt)}`);
            }
            jobWrap.status = 'sent';
            logger.debug("newJob attempt at " + job.id);
           job.socket.emit('newjob', jobWrap.job.id, jobWrap.jobOpt);
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

    async appendToQueue(jobOpt:JobOptProxy):Promise<JobProxy> {
        const jid = uuidv4();
        const nspJobSocket = await this.createJobSocket(jid)
        const job = new JobProxy(jobOpt, nspJobSocket, jid);
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
    // Create one namespaced socket by job
    async createJobSocket(jobID:uuid):Promise<Socket> {
        logger.debug(`Creating job ${jobID} socket`);
        const job_nsp = `http://${this.TCPip}:${this.port}/job-${jobID}`;
        logger.debug(`Corresponding ns is ${job_nsp}`)
        
        const nspJobSocket = io(job_nsp);
       
        nspJobSocket.on('jobStart', (data) => {
            logger.silly(`Client : socket on jobStart`)
            // Maybe do smtg
            // data = JSON.parse(data);
        });
        let self = this;
        nspJobSocket.on('bounced', (jobID:uuid) => {
            logger.silly(`Client : socket on bounced`)
            logger.warn(`Job ${jobID} was bounced !`);
            self.jobsPromisesReject[jobID]({ 'type': 'bouncing', jobID });
        });
        nspJobSocket.on('granted', (jobID) => {
            logger.silly(`Client : socket on granted`)
            logger.debug(`Job ${jobID} was granted !`);
            self.jobsPromisesResolve[jobID](jobID);
        });
        nspJobSocket.on('lostJob', (_jobSerial:string) => {
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

        nspJobSocket.on('fsFatalError', (msg, err, jobID) => {
            logger.silly(`Client : socket on fsFatalError`)
            let jRef = this.getJobObject(jobID);
            if (!jRef)
                return;
            jRef.emit('fsFatalError', msg, err, jRef);
            self.deleteJob(jobID);
        });
        ['scriptSetPermissionError', 'scriptWriteError', 'scriptReadError', 'inputError'].forEach((eName) => {
            nspJobSocket.on(eName, (err, jobSerial) => {
                logger.fatal(`socket.on error ${err} ${uFormat(jobSerial)}`)
                let jRef = this.getJobObject(jobSerial.id);
                if (!jRef)
                    return;
                jRef.emit(eName, err, jRef);
                self.deleteJob(jobSerial.id);
            });
        });
        ['submitted', 'ready'].forEach((eName) => {
            nspJobSocket.on(eName, (_jobSerial) => {
                const jobSerial = JSON.parse(_jobSerial)
                let jRef = this.getJobObject(jobSerial.id);
                if (!jRef)
                    return;
                jRef.emit('ready');
            });
        });
        nspJobSocket.on('completed', (jobSerial:JobSerial) => {
            logger.debug(`pulling Object : ${uFormat(jobSerial)}`);
            const jobObject = this.flush(jobSerial.id);
            if (!jobObject)
                return;
            logger.debug('completed event on socket');
            logger.silly(`${uFormat(jobObject)}`);
            jobObject.stdout = ss.createStream();
            jobObject.stderr = ss.createStream();
            logger.debug(`Pulling for ${jobObject.id}:stdout`);
            logger.debug(`Pulling for ${jobObject.id}:stderr`);
            ss(nspJobSocket).emit(`${jobObject.id}:stdout`, jobObject.stdout);
            ss(nspJobSocket).emit(`${jobObject.id}:stderr`, jobObject.stderr);
            jobObject.emit('completed', jobObject.stdout, jobObject.stderr, jobObject);

        });
        nspJobSocket.on('disconnect', () => {
            logger.debug(`job nsp socket ${jobID} disconnect`);
        });
        //socket.on('centralStatus', (d) => { this.JMstatus = d.status; });
        return new Promise ( (res, rej) => {
            nspJobSocket.on('registred', () => {
                logger.debug(`${job_nsp} registred`);
                res(nspJobSocket);
            });
        });
    }
    
   /* _bind(socket:Socket) {
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
        socket.on('completed', (jobSerial:JobSerial) => {
            logger.debug(`pulling Object : ${uFormat(jobSerial)}`);
            const jobObject = this.flush(jobSerial.id);
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

        });
        //socket.on('centralStatus', (d) => { this.JMstatus = d.status; });
    }*/
}

function buildStreams(data:any, job:JobProxy) {
    logger.debug(`Building streams from ${uFormat(data)}`);
    let jobInput = job.inputs;

    const setScriptStream = ():Readable => {
        if(data.script)
            return createReadStream(data.script);
        const _ = new Readable();
        _.push(data.cmd);
        _.push(null);
        return _;
    };
    const sMap:SourcesMap = {
        script: setScriptStream(),
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
  
    return data;
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

