import { Readable } from 'stream';
import { Path } from '../../shared/types/base';
import { Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents, responseFS} from '../../lib/socket-management/interfaces';
const ss = require('socket.io-stream');
import { format as uFormat} from 'util';
import { JobProxy } from '../../shared/types/client'
import { ReadErrorFS } from '../../errors/client';
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

export class JobFileSystem {
    /* private socket:any;
     private jobID:string;
     */
    socket:Socket<ServerToClientEvents, ClientToServerEvents>;
    job:JobProxy;
 
    constructor(job:JobProxy) {
        this.job = job;
        this.socket = job.socket;
     }
     async list(path?:Path):Promise<string[]> {
        return new Promise( (res, rej) => {
            this.socket.emit('list', path ?? '*', (folder_items:string[]) => res(folder_items) );
        });
        /*
        
            // @ts-ignore
            this.socket.on(`${this.jobID}:list`, (file_list:string[])=> {
                res(file_list);
            });
        });*/
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
             this.socket.emit("isReadable", fileName, (response:responseFS) => {
                 if (response.status == "ok") {
                     const netStream = ss.createStream();
                     ss(this.socket).emit('fsRead', netStream, {name:fileName});             
                     res(netStream);
                 } else {
                    rej(new ReadErrorFS(response.content, this.job.id))
                    // rej(uFormat({ jobID : this.job.id, message: response.content}));
                 }
 //// emit is readable
               });
         });    
     }
 }
 