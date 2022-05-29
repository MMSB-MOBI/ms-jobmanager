import  { EventEmitter } from 'events';
import { createWriteStream, readdir, chmod, ReadStream, createReadStream, readFileSync, writeFile, writeFileSync, stat, access, constants } from 'fs';

import mkdirp = require('mkdirp');
import {format as uFormat } from 'util';
import isStream = require('is-stream');

import md5 = require('md5');
//import streamLib = require('stream');
import {logger} from '../logger.js';
import { JobOpt } from '../shared/types/server';
import childProc = require('child_process');
import { Path } from '../shared/types/base'
import { EngineInterface, getEngine } from '../lib/engine';
import { JobSerial } from '../shared/types/server'
import { Readable } from 'stream';
import { JobBase } from '../shared/types/common/job_model';
import { socketPull } from '../comLayer/serverShell';
import { Socket as SocketServer } from 'socket.io'
/* The jobObject behaves like an emitter
 * Emitter exposes following event:
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

// We type socketPullArgs, which is a vanilla nodeJS function
//type socketPullArgs = [Job|jobProxy, Promise<streamLib.Readable>, Promise<streamLib.Readable>] | [Job|jobProxy, undefined, undefined];


export function melting(previousJobs:Job, newJob:Job) {
    logger.debug("metling!")
    // Local melting
    newJob.isShimmeringOf = previousJobs;
    previousJobs.hasShimmerings.push(newJob);
    if(logger.level == 'debug') {
        const shimAsStr = previousJobs.hasShimmerings.map((j)=>j.pprint()).reduce( (pStr:string, curr:string)=> {
            return pStr += `$\n\t${curr}`;
        });
        logger.debug(`HEAD job is ${previousJobs.pprint()}\n\tCurrent shimmerings are [${shimAsStr}\n]`);
    }
}

/*
    Constuctor performs synchronous operations
    It should be modifed to async
    -> Emit event to confirm safe construction
*/






export class Job extends JobBase implements JobOpt  {
   
    inputSymbols : any = {};
    ERR_jokers :number = 3; //  Number of time a job is allowed to be resubmitted if its stderr is non null
    MIA_jokers :number = 3; //  Number of time
    engine : EngineInterface;
    socket : SocketServer;
    fromConsumerMS : boolean = false;
    script:Readable;
    workDir :string;
    execUser?: string; 
    internalIP:string;
    internalPort:number;
    cwd? :string;
    cwdClone? :boolean = false;
    ttl? :number;
    emulated:boolean=false;
    scriptFilePath?:string;
    fileOut? :string;
    fileErr? : string;
    _stdout? : ReadStream;
    _stderr? : ReadStream;    
    isShimmeringOf?:Job
    hasShimmerings:Job[] = []  // Can only be Job instances not JobProxy

    constructor( jobOpt:JobOpt,uuid? :string ){
        super(jobOpt, uuid);
        this.socket = jobOpt.socket;
        console.log("###" + uuid  + "###");
        logger.debug(`Job Constuctor JobOpt:${jobOpt}`);
        this.internalPort = jobOpt.internalPort;
        this.internalIP = jobOpt.internalIP;
        this.workDir = jobOpt.workDir;
        //logger.info() 
        this.script = jobOpt.script;
        //const completeProfile = jobOpt.jobProfile === "default" ? undefined : getSlurmProfile(jobOpt.jobProfile)
        //this.execUser = completeProfile ? completeProfile.execUser : undefined
        
        if ('emulated' in jobOpt)
            this.emulated = jobOpt.emulated;
     
        if ('cwd' in jobOpt)
            this.cwd = jobOpt.cwd;
        if ('cwdClone' in jobOpt)
            this.cwdClone = jobOpt.cwdClone;
        if ('ttl' in jobOpt)
            this.ttl = jobOpt.ttl;

        //Default JM-level engine
        this.engine =  jobOpt.engine;
        if (! ("sysSettingsKey" in jobOpt) )
            return;
        logger.debug(`sysSettingsKey in jobOpt ${jobOpt.sysSettingsKey}`);
        // Job specific engine
        const sysSettingsKey = jobOpt['sysSettingsKey'];
        if(!sysSettingsKey) {
            logger.error("Undefined value for sysSettings of job engine, using default engine");
            return;
        }
        this.engine = getEngine(this.engine.specs);
        logger.info(`Overidding default engine for ${this.engine.specs} w/ settings ${sysSettingsKey}`);
        this.engine.setSysProfile(sysSettingsKey);
    }
    
    async list(path?:Path):Promise<string[]> {
        /* job API for through socket results file access  */
        const workDirContent:string[] = []
        const jobID = this.id;
        logger.info(`Listing !! in ${this.workDir}`);
       
        return new Promise ( (resolve, reject) => {

            readdir(this.workDir, (err, files) => {
                if (err)
                    reject(err);
                resolve(files);
            }); 
        });
    }
    async read(relativePath:Path):Promise<ReadStream>{
        //const subPath = relativePath ?? '';
        const path = `${this.workDir}/${relativePath}`
        logger.info(`reading fs from ${path}`)
        return new Promise ( (resolve, reject) => {
            const readStream = createReadStream(path);
            readStream.on('open', () => resolve(readStream));
            readStream.on('error', (err) => {
                logger.error(`Error reading from ${path}` + '::' + err);
                reject(err);
            });
        });
    }
    async access(maybeRelativeFileName:Path):Promise<void> {
        const path = `${this.workDir}/${maybeRelativeFileName}`
        return new Promise ( (res, rej) => {
            access(path, constants.R_OK, (err:NodeJS.ErrnoException) => {
                if(err)
                    rej(err)
                else
                    res();
            });
        });
    }
    pprint(): string {
        return super.pprint();
    }
    toJSON():JobSerial{
       return this.getSerialIdentity();
    }
    start () :void {

        let self = this;
        mkdirp(`${this.workDir}/input`, function(err) {
            if (err) {                
                var msg = 'failed to create job w/ ID ' + self.id + ' directory, ' + err;
                logger.error(msg);
                self.emit('folderCreationError', msg, err, self);
                return;
            }
            chmod(self.workDir, '777', function(err) {
                if (err) {
                    var msg = 'failed to change perm job ' + self.id + ' directory, ' + err;
                    self.emit('folderSetPermissionError', msg, err, self);
                    return;
                }
                self.emit('workspaceCreated');
                self.setInput(); //ASYNC or SYNC, Hence the call after the callback binding
            });
        });
    }
    // Rewrite This w/ jobInputObject calls
    // DANGER script HASH not possible on string > 250MB
    getSerialIdentity ():JobSerial {
        const serial:JobSerial = {
            workDir : this.workDir,
            id : this.id,
            cmd : this.cmd,
            script : this.scriptFilePath,
            exportVar : this.exportVar,
            modules : this.modules,
            tagTask : this.tagTask,
            scriptHash : '',
            inputHash : this.inputs.hash()
        }
        let content:string = '';
        if(this.script) {
            //logger.debug(`Accessing${<string>this.scriptFilePath}`);
            content = readFileSync(<string>this.scriptFilePath).toString(); // TO CHECK
        } else if(this.cmd) {
            content = this.cmd;
        } else {
            logger.error("serializing no cmd/script job object");
        }
        serial.scriptHash = md5(content);
     
        return serial;
    }
    
    setInput() : void {
        if (!this.inputs) {
            this.jEmit("inputSet");
            return;
        }
        
        this.inputs.write(`${this.workDir}/input`)
        .on('OK', ()=> {
            let self = this;
            let fname = this.workDir + '/' + this.id + '.batch';
            batchDumper(this).on('ready', function(string) {
                writeFile(fname, string, function(err) {
                    if (err) {
                        return console.log(err);
                    }
                    jobIdentityFileWriter(self);
                self.jEmit('inputSet');
            });
        });
    });
    }

    // Process argument to create the string which will be dumped to an sbatch file
    launch() : void {
        //logger.debug("launching")
        let fname = this.workDir + '/' + this.id + '.batch';
        /*batchDumper(this).on('ready', function(string) {
            fs.writeFile(fname, string, function(err) {
                if (err) {
                    return console.log(err);
                }
                jobIdentityFileWriter(self);
*/
                this.submit(fname);
  //          });
   //     });
    }

    submit(fname:string):void {        
        let submitArgArray = [fname];
        //logger.info(uFormat(this))
        logger.debug(`job submitting w/, ${this.engine.submitBin} ${submitArgArray}`);
        ///logger.debug(`workdir : > ${this.workDir} <`);
        logger.info(`execUser : ${this.engine.execUser}`); 
        const cmd = this.engine.execUser ? 'sudo' : this.engine.submitBin
        const args = this.engine.execUser ? ['-u', this.engine.execUser, this.engine.submitBin, fname] : [fname]
        logger.info(`execute : > ${cmd} ${args}`)
        let child = childProc.spawn(cmd, args
        , {
            cwd: this.workDir,           
            detached: false, //false, 
            //shell : true,
            //uid: 1322, 
            stdio: [ 'ignore', 'pipe', 'pipe' ] // ignore stdin, stdout / stderr set to pipe 
        });
        // and unref() somehow disentangles the child's event loop from the parent's: 
        //child.unref(); 
        child.on("exit", ()=>{ logger.silly('Child process exited'); });
        child.on("error", (err)=>{ logger.silly('Child process error state'); logger.error(`        Child process error state: ${err}`) });
        child.on("close", ()=>{ logger.silly('Child process close'); });
        child.on("end", ()=>{ logger.silly('Child process ended'); });
        child.stdout.pipe(process.stdout);
        child.stderr.pipe(process.stderr);

        /*
        let stdoutData = '';
        child.stdout.on('data', function(data:any) {
            stdoutData += data;            
        });
        child.stdout.on('end', function() {
            logger.debug(`submission stdout::${stdoutData}`);
        });

        let stderrData = '';
        child.stderr.on('data', function(data:any) {
            stderrData += data;            
        });
        child.stderr.on('end', function() {
            logger.debug(`submission stderr::${stderrData}`);
        });
        */
        



      
        
        if(this.emulated) {
            let fNameStdout:string = this.fileOut ? this.fileOut : this.id + ".out"; 
            let streamOut = createWriteStream(this.workDir + '/' + fNameStdout);
            let fNameStderr:string = this.fileErr ? this.fileErr : this.id + ".err"; 
            let streamErr = createWriteStream(this.workDir + '/' + fNameStderr);

            child.stdout.pipe(streamOut);
            child.stderr.pipe(streamErr);
        }
        this.jEmit("submitted", this)
    }

    resubmit():void  {
        let fname = this.workDir + '/' + this.id + '.batch';

        this.submit(fname);
    }

    async stdout():Promise<Readable>{
        logger.silly(`async stdout call at ${this.id} `);
        const fNameStdout:string = this.fileOut ? this.fileOut : this.id + ".out";
        const fPath:string = this.workDir + '/' + fNameStdout;
        const stdoutStream:Readable = await dumpAndWrap(fPath, this._stdout);

        return stdoutStream;
    }

    async stderr():Promise<Readable>{
        logger.silly(`async stderr call at ${this.id} `)
        const fNameStderr:string = this.fileErr ? this.fileErr : this.id + ".err";
        const fPath:string = this.workDir + '/' + fNameStderr;
        const stderrStream:Readable = await dumpAndWrap(fPath, this._stderr);

        return stderrStream;
    }


    respawn(fStdoutName: string, fStderrName: string, workPath: string): void {
        this.fileOut = fStdoutName;
        this.fileErr = fStderrName;
        this.workDir = workPath;
    }

        // 2ways Forwarding event to consumer or publicMS 
    // WARNING wont work with streams
    jEmit(eName:string|symbol, ...args: any[]):boolean {
        logger.debug(`jEmit ${String(eName)}`);
        this.hasShimmerings.forEach((shimJob:Job) => {
            shimJob.jEmit(eName, shimJob);
        }); 

        // We call the original emitter anyhow
        //logger.debug(`${eName} --> ${uFormat(args)}`);
        //this.emit.apply(this, eName, args);
        //this.emit.apply(this, [eName, ...args])
        if(eName !== 'completed') {
            this.emit(eName, ...args);
        // Boiler-plate to emit conform completed event
        // if the consumer is in the same MS as the JM.
        } else if( this instanceof Job ){
            let stdout, stderr:Promise<Readable>;
            if (this.isShimmeringOf) {
                stderr =  this.isShimmeringOf.stderr();
                stdout = this.isShimmeringOf.stdout();
            } else {
                stderr = this.stderr();
                stdout = this.stdout();
            }
            Promise.all([stdout, stderr]).then((results)=>{
                logger.debug("Emitting completed event");
                logger.debug(`${uFormat(this)}`);
                this.emit('completed', ...results)
            });
        }
            
        //return true;
        // if a socket is registred we serialize objects if needed, then
        // pass it to socket
        //If it exists, 
        // arguments are tricky (ie: streams), we socketPull
        // otherwise, we JSON.stringify arguments and emit them on socket
        if (this.socket) {
           // logger.warn(`jEmitToSocket ${eName}`);
            if(eName === 'completed') {

                //logger.debug(`SSP::\n${uFormat(args)}`);
                logger.debug("KIKOU");
                const _parentJob:Job|undefined = this.isShimmeringOf;
                socketPull(this, this.isShimmeringOf ? this.isShimmeringOf.stdout() : undefined,
                                 this.isShimmeringOf ? this.isShimmeringOf.stderr() : undefined
                        );
                return true;
            }
       // Easy to serialize content
            let _args = args.map((e)=>{
                return JSON.stringify(e); // Primitive OR s
            });
            logger.silly(`socket emiting event ${String(eName)}`);    
            this.socket.emit(eName as string, ..._args);
        }
        return true;
    }
}



function jobIdentityFileWriter(job : Job) :void {
    let serial = job.getSerialIdentity();
    let json = JSON.stringify(serial);
    writeFileSync(job.workDir + '/jobID.json', json, 'utf8');
}

function batchDumper(job: Job) {
    let emitter : EventEmitter = new EventEmitter();
    let batchContentString  : string = "#!/bin/bash\n";
    const address : string = job.emulated ? 'localhost' : job.internalIP;
    const port = job.internalPort
    var trailer = 'echo "JOB_STATUS ' + job.id + ' FINISHED"  | nc -w 2 ' + address + ' ' + port + " > /dev/null\n";

    let engineHeader = job.engine.generateHeader(job.id, job.jobProfile, job.workDir);
    batchContentString += engineHeader; /// ENGINE SPECIFIC PREPROCESSOR LINES

    batchContentString += 'echo "JOB_STATUS ' + job.id + ' START"  | nc -w 2 ' + address + ' ' + port + " > /dev/null\n"

    if (job.exportVar) {
        for (var key in job.exportVar) {
            //string += 'export ' + key + '=' + job.exportVar[key] + '\n';
            batchContentString += key + '="' + job.exportVar[key] + '"\n';
        }
    }

    if (job.inputs) {
        for (var key in job.inputs.paths) {
            batchContentString += key + '="' + job.inputs.paths[key] + '"\n';
        }
    }

    if (job.modules) {
        job.modules.forEach(function(e) {
            batchContentString += "module load " + e + '\n';
        });
    }

    if (job.script) {
        job.scriptFilePath = job.workDir + '/' + job.id + '_coreScript.sh';
        batchContentString += '. ' + job.scriptFilePath + '\n' + trailer;
        _copyScript(job, job.scriptFilePath, /*string,*/ emitter);
        /* This should not be needed, as _copyScript emits the ready event in async block
             setTimeout(function(){
             emitter.emit('ready', string);
         }, 5);
         */
    } else if (job.cmd) {
        batchContentString += job.cmd ? job.cmd : job.engine.testCommand;
        batchContentString += "\n" + trailer;
        setTimeout(function() {
            emitter.emit('ready', batchContentString);
        }, 5);
    } else {
        throw ("You ask for a job but provided not command and script file");
    }

    emitter.on('scriptReady', function() {
        emitter.emit('ready', batchContentString);
    })
    return emitter;
}

function _copyScript(job:Job, fname:string, emitter:EventEmitter) {
    //if (!job.script)
    //    return;
    let src:Readable;
    if(isStream(job.script)) {
        src = <Readable>job.script;        
    } else {
        src = createReadStream(<string>job.script);
    }
    src.on("error", function(err) {
        job.jEmit('scriptReadError', err, job);
    });
    var wr = createWriteStream(fname);
    wr.on("error", function(err) {
        job.jEmit('scriptWriteError', err, job);
    });
    wr.on("close", function() {
        chmod(fname, '777', function(err) {
            if (err) {
                job.jEmit('scriptSetPermissionError', err, job);
            } else {
                emitter.emit('scriptReady' /*, string*/ );
            }
        });
    });
    src.pipe(wr);
}

/*
    Path{String} => ReadableStream
    Given a path we try to open file
    if ok return stream
    if not 
        we try to pump from _stdio
    return empty stream
*/
function dumpAndWrap(fName:string/*, localDir:string*/, sourceToDump?:Readable):Promise<Readable>{

    let p = new Promise<Readable>(function(resolve) {

        stat(fName,(err, stat)=>{
            if(!err) {
                if(stat.isFile()) {     
                    logger.debug(`Found a file to wrap at ${fName}`);
                    let stream:Readable = createReadStream(fName, {
                        'encoding': 'utf8'
                    });
                    resolve(stream);
                    return;
                }
                logger.error(`Should not be here:\n ${uFormat(stat)}`);
            } else {
                logger.warn(`cant find file ${fName}`);
                if(sourceToDump){

                    logger.debug(`Found alternative source dumping it from \n ${uFormat(sourceToDump)}`);
                    let target = createWriteStream(fName, {'flags': 'a'});
                    sourceToDump.pipe(target);
                    target.on('close', () =>{
                    let stream:Readable = createReadStream(fName, {
                        'encoding': 'utf8'
                        });
                        logger.debug(`should resolve with ${uFormat(stream)}`);
                        resolve(stream);
                        return;
                    });
                } else {
                    logger.error("Output file error, Still cant open output file, returning empy stream");
                    let dummyStream:Readable = new Readable();
                    dummyStream.push(null);
                    resolve(dummyStream);
                    return;
                }
            }

        });
    });
    return p;
} 
