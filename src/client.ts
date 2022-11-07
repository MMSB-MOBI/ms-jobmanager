//import * as jobManagerClient from './comLayer/clientShell';
import{ JobFileSystem } from './comLayer/clientShell/fileSystem' 
import { JobOptProxy, JobProxy } from './shared/types/client';
import { ClientShell } from './comLayer/clientShell';
import { uuid } from './shared/types/base';
import uuidv4 = require('uuid/v4');
import { logger, setLogLevel } from './logger';
import { format as uFormat } from 'util';
import {ConnectionError, StartConnectionError, 
        RemoteFileSystemError, PushConnectionLostError, 
        ScriptError, RemoteScriptError,JobStderrNotEmpty,
        JobConnectionLostError, RemoteInputError, LostJobError } from './errors/client';
import { EventEmitter } from 'events';

// THIS PUBLIC CLIENT API SHOULD BE INCLUDED IN D.TS

interface DatumPushFS {
    stdout:string,
    jobFS: JobFileSystem
}

class JmClient {
    private port?: number;
    private TCPip?: string;
    private _connect: boolean = false;
    private _uuid: uuid;
    private _shell:ClientShell;
    constructor() {
        this._uuid = uuidv4();
        logger.info("jobmanager client instance " + this._uuid);
        this._shell = new ClientShell();       
    }

    async start(adress:string, port:number):Promise<void> {
        this.port = port
        this.TCPip = adress
        return new Promise((res, rej) => {
            if (this._connect) res()
            else{
                this._shell.start({ port: this.port, TCPip: this.TCPip })
                .then( (disconnectEmitter :EventEmitter) => {
                    this._connect = true
                    disconnectEmitter.on("disconnect", () => {
                        this._connect = false
                    })
                    res()
                }).catch( (e :any) => {                    
                    if (e instanceof ConnectionError)
                        rej(new StartConnectionError(e.TCP, e.port));
                })
            }
        })
    }
    async stop():Promise<void> {
        return new Promise((res, rej) => {
            if (!this._connect) res();
            else {

                this._shell.disconnect();
            }
        })
    }

    // Handling of submitted jobs
    async push(jobOpt: JobOptProxy):Promise<string> {       
        const [job, stdout] = await this._push(jobOpt);
        return stdout;
    }
    async pushMany(jobOptArray: JobOptProxy[]):Promise<string[]> {
        const _ = await this._pushMany(jobOptArray)
        return _.map( ([jobProxy, stdout]) => stdout );
    }

    async pushFS(jobOpt: JobOptProxy): Promise<DatumPushFS>{
        const [job, stdout] = await this._push(jobOpt);
        const jobFileInterface = this._shell.createFS(job);
        return { stdout, jobFS: jobFileInterface }
    }
    async pushManyFS(jobOptArray: JobOptProxy[]):Promise<DatumPushFS[]> {
        const _ = await this._pushMany(jobOptArray);
        return _.map( ([job, stdout]) => { return { stdout, jobFS:this._shell.createFS(job)};})
    }
   
    private async _pushMany(jobOptArray: JobOptProxy[]):Promise<[JobProxy, string][]> {
        const _:[JobProxy, string][] = await Promise.all(
            jobOptArray.map( (jobOpt) => {
                console.log("Loading one _push over " + uFormat(jobOpt));
                return this._push(jobOpt);
            })
        );
        return _;
    }

    private async _push(jobOpt: JobOptProxy): Promise<[JobProxy, string]> { 
        logger.debug(`Pushing following ${uFormat(jobOpt)}`);      
        return new Promise((res, rej) => {
            this.start(this.TCPip as string, this.port as number).then(async () => {
                try {
                    const job = await this._shell.push(jobOpt);
                    job.on("scriptError", (message: string, data:JobOptProxy) => {                    
                        rej(new ScriptError(message, job.id));
                    });
                    job.on("lostJob", (data:JobOptProxy) => {
                        rej(new LostJobError(job.id, data))
                    });

                    job.on("fsFatalError", (message: string, error: string, data:JobOptProxy) => { //jobObject
                        rej(new RemoteFileSystemError(message, error, job.id, data));
                    });
                    job.on("scriptSetPermissionError", (err: string) => {
                        rej( new RemoteScriptError(`(permission problem) ${err}`, job.id) )
                    });
                    job.on("scriptWriteError", (err: string) => {
                        rej( new RemoteScriptError(`(write error) ${err}`, job.id) )
                    });
                    job.on("scriptReadError", (err: string) => {
                        rej( new RemoteScriptError(`(read error) ${err}`, job.id) )                
                    });
                    job.on("inputError", (err: string) => {
                        rej(new RemoteInputError(err, job.id))
                    });

                    job.on("disconnect_error",() => {
                        rej(new JobConnectionLostError(this.TCPip as string, this.port as number, job.id) )
                    })
                    /* stderr rej as precedence over stdout res */
                    job.on("completed", (stdout: any, stderr: any) => {
                        const chunks: Uint8Array[] = [];
                        const errchunks: Uint8Array[] = [];
                    
                        stderr.on('data', (chunk: Uint8Array) => errchunks.push(chunk))
                        stderr.on('end', () => {
                            if (errchunks.length > 0) {                          
                                const _ = Buffer.concat(errchunks).toString('utf8');                                               
                                rej( new JobStderrNotEmpty(_, job.id) );
                                return;
                            }
                        
                            stdout.on('data', (chunk: Uint8Array) => chunks.push(chunk))
                            stdout.on('end', () => {                        
                                const _ = Buffer.concat(chunks).toString('utf8');                            
                                res([job, _]);                        
                            });
            
                        })
                    })
                } 
                catch(e) {
                    rej(e);
                }
            })
            .catch(e => {
                rej(new PushConnectionLostError(this.TCPip as string, this.port as number))
            })
        })
    }
}

/*
const jmClientSingleton =  new JmClient();
export default jmClientSingleton;
*/

export default new JmClient();