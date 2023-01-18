import { PassThrough, Readable, Transform, Writable } from 'stream';
import { Path } from '../../shared/types/base';
import { Socket } from 'socket.io-client';
import { ClientToServerEvents, ServerToClientEvents, responseFS} from '../../lib/socket-management/interfaces';
const ss = require('socket.io-stream');
import { format as uFormat} from 'util';
import { JobProxy } from '../../shared/types/client'
import { ReadErrorFS, WriteErrorFS } from '../../errors/client';
import { logger } from '../../logger';
import { access, stat, createWriteStream, constants as fsConst } from 'fs';
import { dirname } from 'path';

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
    async copy(sourceFileName:string, targetFileName:Path):Promise<void> {
        await this.checkTargetPath(targetFileName);
        const sourceStream = await this.readToStream(sourceFileName);
        const targetStream = createWriteStream(targetFileName);
        const id = this.job.id;
        return new Promise ((res,rej)=>{
            targetStream.on('close', ()=>res());
            targetStream.on('err'  , ()=>rej(
                new WriteErrorFS(`Error writing to ${targetFileName}`,id))
            );
            sourceStream.pipe(targetStream);
        });
    }
    // Zip entiere working folder
    async zap(noHeaderFiles=true):Promise<Readable> {
        return new Promise( async (res, rej)=> {
            const chunksArray: Uint8Array[] = [];
            const netStream = ss.createStream();
            console.log(`=>${noHeaderFiles}`);
            try {
                ss(this.socket).emit('fsZip', netStream, noHeaderFiles );             
                netStream.on('data', (chunk: Uint8Array) => {
                    chunksArray.push(chunk);
                });
                netStream.on('end', ()=> {
                    const oStream = new Readable();
                    res(oStream);
                    chunksArray.forEach( (chunk)=> oStream.push(chunk));
                    oStream.push(null);
                });
            } catch(e) {
                rej(e);
            }
        });       
    };
    private async checkTargetPath(targetFileName:string):Promise<void> {
        return new Promise( async (res, rej)=> {
            const id = this.job.id;
            const dirName = dirname(targetFileName); 
            const _this = this;       
            access(dirName, fsConst.W_OK, (err) => {
                if(err) {
                    rej(new WriteErrorFS(`${dirName} not a writable folder`, id));
                    return 
                }
                stat(targetFileName, function(err, stat) {
                    if (err.code !== 'ENOENT') {
                        rej(new WriteErrorFS(`${targetFileName} already exists`, id));
                        return;
                    }
                    res();
                });                
            });
        });
    }
    async readToStream(fileName:string):Promise<Readable>{
        return new Promise( async (res, rej)=> {

            const chunksArray: Uint8Array[] = [];
            try {
                const netStream = await this._read(fileName);
                    netStream.on('data', (chunk: Uint8Array) => {
                    chunksArray.push(chunk);
                });
                netStream.on('end', ()=> {
                    const oStream = new Readable();
                    res(oStream);
                    chunksArray.forEach( (chunk)=> oStream.push(chunk));
                    oStream.push(null);
                });
            } catch(e) {
                rej(e);
            }
        });
    }
 
    async readToString(fileName:string):Promise<string> {
        const netStream = await this._read(fileName);
        const stdout    = await streamToString(netStream)
        return stdout;
    }
 
    private async _read(fileName:Path):Promise<Readable>{
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
 