import { EventEmitter } from 'events';
import { Server as SocketIOServer, Socket } from 'socket.io';

import * as util from 'util';
import { v4 as uuidv4 } from 'uuid';
import { ServerStatus } from '../shared/types/common';
import { ReadStream, WriteStream } from 'fs';
import { uuid } from '../shared/types/base';
import { JobOptProxy } from '../shared/types/client';
import { Job } from '../job'
const ss = require('socket.io-stream')

import { Readable } from 'stream';
const my_logger = require('../logger.js');
const logger = my_logger.logger;
import { netStreamInputs } from '../shared/types/server';
import { ClientToServerEvents, ServerToClientEvents,/* InterServerEvents, SocketData*/ } from '../lib/socket-management/interfaces';
/*let io:SocketIOServer;
let socketRegistry:Record<string, Socket> = {};
*/


let socketRegistry:SocketRegistry;

export class SocketRegistry extends EventEmitter {
    private registry:Record<string, Socket> = {};
    private server:SocketIOServer;
    private port:number;
    constructor(port:number){
        super();
        this.port   = port;
        this.server = new SocketIOServer<ClientToServerEvents, ServerToClientEvents/*, InterServerEvents, SocketData*/>(port);
        this.server.on('connection', (socket:Socket)=> {
            const uuid = this.register(socket);
            this.emit('connection'); // for login purposes
            this.emit('clientSocketConnection', socket); // concrete socket
            const self = this;
            socket.on('newJobSocket', (jobID:uuid, jobOptProxy:JobOptProxy) => {
                logger.debug(`========\n=============\nnewJobSocket received container:\n${util.format(jobOptProxy)}`);
                // Emitting the corresponding event/Symbols for socket streaming
                //logger.debug(`========\n=============\nnewJobSocket emmitting container:\n${util.format(newData)}`);
                self.emit('newJobSocket', jobID, jobOptProxy, socket);
            });
            socket.on('disconnect', function () {
                self.remove(uuid);
            });

        });
    }
    register(socket:Socket):string {
        const _ = uuidv4();
        this.registry[_] = socket;
        return _;
    }
    remove(uuid:string) {
        delete this.registry[uuid];
    }
    broadcast(status:ServerStatus) {
        for (let k in this.registry) {
            this.registry[k].emit('centralStatus', status);
        }
    }
    
}

export function startSocketServer(port:number):SocketRegistry {
    socketRegistry = new SocketRegistry(port);

    return socketRegistry;
}

//type socketPullArgs = [Job|JobProxy, Promise<Readable>, Promise<Readable>] | [Job|JobProxy, undefined, undefined];

export function socketPull(jobObject:Job/*|JobProxy*/, stdoutStreamOverride?:Promise<Readable>, stderrStreamOverride?:Promise<Readable>):void {
    if (stdoutStreamOverride)
        logger.debug(`${jobObject.id} Shimmering Socket job pulling`);
    else
        logger.debug(`${jobObject.id} Genuine socket job pulling`);
    //  logger.debug(`${util.format(stdout)}`);
    const stdoutStream = stdoutStreamOverride ? stdoutStreamOverride : jobObject.stdout();
    const stderrStream = stderrStreamOverride ? stderrStreamOverride : jobObject.stderr();
    ss(jobObject.socket).on(`${jobObject.id}:stdout`, function (stream:WriteStream) {
        stdoutStream.then((_stdout) => {
            logger.info(`${jobObject.id} Pumping stdout [${jobObject.id}:stdout]`);
            //logger.warn(`stdoutStream expected ${util.format(_stdout)}`);
            _stdout.pipe(stream);
        });
    });
    ss(jobObject.socket).on(`${jobObject.id}:stderr`, function (stream:WriteStream) {
        stderrStream.then((_stderr) => {
            logger.silly(`${jobObject.id} Pumping stderr [${jobObject.id}:stderr]`);
            //logger.warn(`stderrStream expected ${util.format(_stderr)}`);
            _stderr.pipe(stream);
        });
    });

    if (!jobObject.socket)
        return;
    jobObject.socket.on("list", (path?:string) => { 
        //logger.info(`List request received for job ${jobID}`)
        jobObject.list(path).then( (list_items)=>  {
            if (jobObject.socket)
                jobObject.socket.emit(`${jobObject.id}:list`, list_items /*["toto.txt", "tata.txt"]*/);
        });
    });
    //_SOCKET.on("DoyouMind", ()=> { console.log("I dont mind")});
    jobObject.socket.on("DoyouMind", ()=> { console.log("I dont mind")});
    //ss(_SOCKET).on('fsRead', function(stream, data) {
    ss(jobObject.socket).on('fsRead', function(stream:WriteStream, data:any) {
        logger.info(`${jobObject.id} Trying to start pumping fsRead from ${data.name}`);
           /* const dum_stream = new Readable();
           
            dum_stream.push("AAA");
            dum_stream.push("BBB");
            dum_stream.push(null);
            dum_stream.pipe(stream);*/
        jobObject.read(data.name).then( (readableStream)=>  {
            readableStream.pipe(stream);
            logger.info(`${jobObject.id} Pumping fsRead 2/2`);
        });


    }); 
    /*
    jobObject.socket.on("read", (filename) => {         
        jobObject.read(filename).then( (readableStream)=>  {
            const fsStreamToken = 'toto';//`fs_streaming:${filename}`;
            logger.info(`network stream rdy at ${fsStreamToken}`)
            ss(jobObject.socket)
                .on(fsStreamToken, function(network_stream) {
                    logger.warn(`SOMEONE IS PULLING ${fsStreamToken}`);
                    //network_stream.pipe(readableStream)
                    readableStream.pipe(network_stream)
                 
                });
            jobObject.socket.emit(`${filename}:open_success`, fsStreamToken);

        }).catch(e => jobObject.socket.emit(`${filename}:open_error`, e));
    });*/

    jobObject.socket.emit('completed', jobObject /*JSON.stringify(jobObject)*/);
    // Can be customized w/ toJSON() // method
}

/*
 For now we dont do much just boreadcasting were overloaded
*/
export function bouncer(jobID:uuid, socket:Socket) {
    logger.debug(`Bouncing ${jobID}`);
    socketRegistry.broadcast('busy');
    socket.emit('bounced', jobID);
}

// We build streams only at granted
// We souhld type ss.createReadStream
export async function granted(jobOptProxy:JobOptProxy, jobID:uuid, socket:Socket):Promise<netStreamInputs> {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            logger.debug(`i grant access to ${jobID}`);
            socketRegistry.broadcast('available');
            const socketNamespace = jobID;
            const remoteData:netStreamInputs = {
                script: ss.createStream(),
                inputs: {}
            };
            for (let inputSymbol in jobOptProxy.inputs) {
                //let filePath = data.inputs[inputSymbol];
                //logger.debug(`-->${filePath}`);
                remoteData.inputs[inputSymbol] = ss.createStream();
                logger.debug(`ssStream emission for input symbol '${inputSymbol}'`);
                ss(socket).emit(`${socketNamespace}/${inputSymbol}`, remoteData.inputs[inputSymbol]);
                //logger.warn('IeDump from' +  socketNamespace + "/" + inputSymbol);
                //newData.inputs[inputSymbol].pipe(process.stdout)
            }
            ss(socket).emit(socketNamespace + "/script", remoteData.script);
           
            //logger.error(`TOTOT2\n${util.format(newData)}`);
           /* for (let k in data) {
                if (k !== 'inputs' && k !== 'script')
                    newData[k] = data[k];
            }
            newData.socket = socket;
            */
            socket.emit('granted', jobID); // to client TO DO type cahnge and need hinting
            resolve(remoteData);
        }, 250);
    });
}

export function openBar() {
}