//import * as jobManagerClient from './comLayer/clientShell';
import{ JobFileSystem } from './comLayer/clientShell/fileSystem' 
import { JobOptProxy, JobProxy } from './shared/types/client';
import { ClientShell } from './comLayer/clientShell';
import { uuid } from './shared/types/base';
import uuidv4 = require('uuid/v4');
import { logger, setLogLevel } from './logger';
import { format as uFormat } from 'util';
setLogLevel('debug');
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

    async start(adress:string, port:number) {
        this.port = port
        this.TCPip = adress
        return new Promise((res, rej) => {
            if (this._connect) res(true)
            else{
                this._shell.start({ port: this.port, TCPip: this.TCPip }).then( (disconnectEmitter :any) => {
                    this._connect = true
                    disconnectEmitter.on("disconnect", () => {
                        this._connect = false
                    })
                    res(true)
                }).catch( (e :any) => {
                    console.error(`Unable to connect at ${this.TCPip}:${this.port} : ${e}`)
                    rej(e)
                })
            }
           
        })
    }

    async pushFS(jobOpt: JobOptProxy): Promise<DatumPushFS>{
        const [job, stdout] = await this._push(jobOpt);
        const jobFileInterface = this._shell.createFS(job);
        return { stdout, jobFS: jobFileInterface }
    }

    async push(jobOpt: JobOptProxy):Promise<string> {       
        const [job, stdout] = await this._push(jobOpt);
        return stdout;
    }

    async _push(jobOpt: JobOptProxy): Promise<[JobProxy, string]> { 
        logger.debug(`Pushing following ${uFormat(jobOpt)}`);      
        return new Promise((res, rej) => {
            this.start(this.TCPip as string, this.port as number).then(async () => {
                const job = await this._shell.push(jobOpt);
                job.on("scriptError", (message: string, data:JobOptProxy) => {
                    console.error("script error");
                    
                    rej(`Error with job ${job.id} : script error`)
                });
                job.on("lostJob", (data:JobOptProxy) => {
                    //console.log("lost job", data);
                    rej(`Error with job ${job.id} : job has been lost`)
                });

                job.on("fsFatalError", (message: string, error: string, data:JobOptProxy) => { //jobObject
                    console.log("fs fatal error");
                    console.log("message:", message);
                    console.log("error:", error);
                    console.log("data:", data);
                    rej(`Error with job ${job.id} : fsFatalError`)
                });
                job.on("scriptSetPermissionError", (err: string) => {
                    console.error(err)
                    rej(`Error with job ${job.id} : script permission error`)
                });
                job.on("scriptWriteError", (err: string) => {
                    console.error("scriptWriteError", err)
                    rej(`Error with job ${job.id} : script write error`)
                });
                job.on("scriptReadError", (err: string) => {
                    console.error("script read error", err);
                    rej(`Error with job ${job.id} : script read error`)
                });
                job.on("inputError", (err: string) => {
                    console.error("input error", err);
                    rej(`Error with job ${job.id} : input error`)
                });

                job.on("disconnect_error",() => {
                    console.error("job disconnected")
                    rej(`Error with job ${job.id} : disconnect error`)
                })

                job.on("completed", (stdout: any, stderr: any) => {
                    const chunks: Uint8Array[] = [];
                    const errchunks: Uint8Array[] = [];
                   
                    stdout.on('data', (chunk: Uint8Array) => chunks.push(chunk))
                    stdout.on('end', () => {
                        const _ = Buffer.concat(chunks).toString('utf8');
                        try {
                            //const data =  _
                            res([job, _]);
                        } catch (e) {
                            rej(e);
                        }
                    });
                    stderr.on('data', (chunk: Uint8Array) => errchunks.push(chunk))
                    stderr.on('end', () => {
                        if (errchunks.length > 0) {                          
                            const _ = Buffer.concat(errchunks).toString('utf8');
                            console.log(`erreur standard job>${_}<`);
                            if (_) rej(_)
                        }
                    })
                })
            })
            .catch(e => {
                rej(`Job manager error : ${e}`)
            })
        })
    }
}

/*
const jmClientSingleton =  new JmClient();
export default jmClientSingleton;
*/

export default new JmClient();