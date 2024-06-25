import { EventEmitter } from 'events';
import { JobProxy, JobOptProxy, JobOptClientFactory } from '../../shared/types/client'
import { io, Socket } from "socket.io-client";
import { ClientToServerEvents, ServerToClientEvents, responseFS} from '../../lib/socket-management/interfaces';

import { format as uFormat } from 'util';
import { logger } from '../../logger';
import { uuid } from '../../shared/types/base';
import { JobAccumulator } from './accumulator';
import { JobFileSystem } from './fileSystem';
import {ConnectionError} from '../../errors/client';
import { client_debugger } from './debugLogger';
export class ClientShell {
    acc:JobAccumulator;
    mainSocket?:Socket<ServerToClientEvents, ClientToServerEvents>;
    TCPip='localhost';
    port=1234;
    constructor() {
        this.acc = new JobAccumulator();
    }
    start(opt:any):Promise<EventEmitter> {
        return new Promise ( (resolve, reject) => {    
            this.TCPip = opt.TCPip;
            this.port = opt.port;
            let url = 'http://' + opt.TCPip + ':' + opt.port;
            logger.debug(`jobmanager core microservice coordinates defined as \"${url}\"`);
            this.mainSocket = io(url);
           
            const statusEmitter = new EventEmitter()
            this.mainSocket.on("connect", () => {
                logger.debug(`manage to connect to jobmanager core microservice at ${url}`);            
                //this.acc.bind(/*this.socket as Socket*/this.TCPip, this.port);
                this.acc.TCPip = this.TCPip;
                this.acc.port  = this.port;
                resolve(statusEmitter);
            })
            this.mainSocket.on("connect_error", (err) => {
                //console.error("socket connection error")
                reject(new ConnectionError("socket connection error", this.TCPip, this.port))
            });
            this.mainSocket.on("disconnect", () => {
                client_debugger(`ClientShell "disconnect" event received on mainSocket !`);
                this.acc.abortAll(); 
                statusEmitter.emit("disconnect")
            })
        });
    }
    async push(data:any):Promise<JobProxy> {
        const jobOpt = JobOptClientFactory(data);
        logger.debug(`Passing following data to jobProxy constructor\n${uFormat(jobOpt)}`);
        const job = await this.acc.appendToQueue(jobOpt);
        return job;    
    }

    get_socket():Socket|undefined {
        return this.mainSocket;
    }

    createFS(job:JobProxy):JobFileSystem {
        return new JobFileSystem(job); // TO ADAPT
    }

    disconnect():void{
        this.mainSocket?.disconnect();
    }
}




