//import * as jobManagerClient from './comLayer/clientShell';
import{ JobFileSystem } from './comLayer/clientShell/fileSystem' 
import { JobOptProxy as JobOptAPI, JobProxy, clientInputAPI } from './shared/types/client';
import { ClientShell } from './comLayer/clientShell';
import { uuid } from './shared/types/base';
import uuidv4 = require('uuid/v4');
import { format as uFormat } from 'util';
import {ConnectionError, StartConnectionError, 
        RemoteFileSystemError, PushConnectionLostError, 
        ScriptError, RemoteScriptError,JobStderrNotEmpty, JobStderrNotEmptyFS,
        JobConnectionLostError, RemoteInputError, LostJobError } from './errors/client';
import { EventEmitter } from 'events';

export { clientInputAPI };

// Limited PUBLIC CLIENT API

/*
    For now they are (re) declared for sole public purpose here
    They may be imported from ./shared/types/* in the future
*/

export interface DatumPushFS {
    stdout:string,
    jobFS: JobFileSystem
}

//export type PublicInputSrc = { [ name:string ] : string|Readable } | string[];
/*
export interface JobOptAPI {
    exportVar: { [key: string]: string },
    inputs: clientInputAPI,
    modules? : string[],
    script? : string,
    jobProfile? : string,
    sysSettingsKey? : string, 
};*/
/* ---------------------- */

export class JmClient {
    private port?: number;
    private TCPip?: string;
    private _connect: boolean = false;
    private _uuid: uuid;
    private _shell:ClientShell;

    static instance: JmClient;
    constructor() {
        this._uuid = uuidv4();
        //console.info("jobmanager client instance " + this._uuid);
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
    async push(jobOpt: JobOptAPI):Promise<string> {       
        const [job, stdout] = await this._push(jobOpt);
        return stdout;
    }
    async pushMany(jobOptArray: JobOptAPI[]):Promise<string[]> {
        const _ = await this._pushMany(jobOptArray)
        return _.map( ([jobProxy, stdout]) => stdout );
    }

    async pushFS(jobOpt: JobOptAPI): Promise<DatumPushFS>{
        try {
            const [job, stdout] = await this._push(jobOpt);     
            const jobFileInterface = this._shell.createFS(job);
            return { stdout, jobFS: jobFileInterface }
       
        } catch(e) {
            if(e instanceof JobStderrNotEmpty) {
                const job = e.job;
                const jobFileInterface = this._shell.createFS(job);
                throw new JobStderrNotEmptyFS(e, jobFileInterface);
            } else {
                throw(e);
            }
        }
    }
    
    async pushManyFS(jobOptArray: JobOptAPI[]):Promise<DatumPushFS[]> {
        const _ = await this._pushMany(jobOptArray);
        return _.map( ([job, stdout]) => { return { stdout, jobFS:this._shell.createFS(job)};})
    }
   
    private async _pushMany(jobOptArray: JobOptAPI[]):Promise<[JobProxy, string][]> {
        const _:[JobProxy, string][] = await Promise.all(
            jobOptArray.map( (jobOpt) => {
                console.log("Loading one _push over " + uFormat(jobOpt));
                return this._push(jobOpt);
            })
        );
        return _;
    }

    private async _push(jobOpt: JobOptAPI): Promise<[JobProxy, string]> { 
        //logger.debug(`Pushing following ${uFormat(jobOpt)}`);      
        return new Promise((res, rej) => {
            this.start(this.TCPip as string, this.port as number).then(async () => {
                try {
                    const job = await this._shell.push(jobOpt);
                    job.on("scriptError", (message: string, data:JobOptAPI) => {                    
                        rej(new ScriptError(message, job.id));
                    });
                    job.on("lostJob", (data:JobOptAPI) => {
                        rej(new LostJobError(job.id, data))
                    });

                    job.on("fsFatalError", (message: string, error: string, data:JobOptAPI) => { //jobObject
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
                                rej( new JobStderrNotEmpty(_, job) );
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