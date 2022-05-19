import * as jobManagerClient from './comLayer/clientShell';
import{ JobFileSystemInterface } from './comLayer/clientShell' 
import { JobOptProxy, JobProxy } from './shared/types/client';


interface DatumPushFS {
    stdout:string,
    jobFS: JobFileSystemInterface
}

class JmClient {
    private port?: number;
    private TCPip?: string;
    private _connect: boolean = false;

    constructor() {}

    async start(adress:string, port:number) {
        this.port = port
        this.TCPip = adress
        console.log(this.port,  this.TCPip )
        return new Promise((res, rej) => {
            if (this._connect) res(true)
            else{
                jobManagerClient.start({ port: this.port, TCPip: this.TCPip }).then( (disconnectEmitter :any) => {
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
        const jobFileInterface = new JobFileSystemInterface(job.id);
        return { stdout, jobFS: jobFileInterface }
    }

    async push(jobOpt: JobOptProxy):Promise<string> {
        const [job, stdout] = await this._push(jobOpt);
        return stdout;
    }

    async _push(jobOpt: JobOptProxy): Promise<[JobProxy, string]> { // Guillaume doit typer l'objet job

        return new Promise((res, rej) => {
            this.start(this.TCPip as string, this.port as number).then(() => {
                const job = jobManagerClient.push(jobOpt);
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
                    console.log("STDOUT");
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
                            console.log('FUCK')
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

export default new JmClient();