import { Readable, Transform } from 'stream';
import { Path } from '../../shared/types/base';
import { Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents, responseFS} from '../../lib/socket-management/interfaces';
const ss = require('socket.io-stream');
import { format as uFormat} from 'util';
import { JobProxy } from '../../shared/types/client'
import { ReadErrorFS } from '../../errors/client';
import { logger } from '../../logger';
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
     }
     
     async readToStream(fileName:string):Promise<Readable>{
        
        // DBG implementation, this works
        /*
        const netStream = new Readable();
        netStream.push("dummy stream content");
        netStream.push(null);
        */
        
        // Previous implementation, does not work
        //const netStream = await this._read(fileName);
        
        // DEBUG, causes stream to be consumed
        /*  const chunks: Uint8Array[] = [];
        netStream.on('data', (chunk: Uint8Array) => chunks.push(chunk))
        netStream.on('end', () => {
            const _ = Buffer.concat(chunks).toString('utf8');             
            logger.info("PI::\n" + _);
        });
        netStream.on('error', (err:string) => logger.error(err));
        */

        return new Promise( async (res, rej)=> {

            const chunksArray: Uint8Array[] = [];
            try {
                const netStream = await this._read(fileName); // manage error on name here
                netStream.on('data', (chunk: Uint8Array) => {
               // logger.info("HOUHOU " + chunk.toString());
                    chunksArray.push(chunk);
                });
                netStream.on('end', ()=> {
                //logger.info('CLOSED !!');
                    const oStream = new Readable();
                    res(oStream);
                    chunksArray.forEach( (chunk)=> oStream.push(chunk));
                    oStream.push(null);
                });
            } catch(e:any) {
                rej(e);
            }
        });

        //return netStream as Readable;
     }
 
     async readToString(fileName:string):Promise<string> {
         const netStream = await this._read(fileName);
         const stdout    = await streamToString(netStream)
         return stdout;
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
                }
            });
        });    
    }
 }
 