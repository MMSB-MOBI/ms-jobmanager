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
import { ClientToServerEvents, ServerToClientEvents, InterServerEvents/*, SocketData*/ } from '../lib/socket-management/interfaces';
import { access, constants } from 'fs';
import { responseFS } from '../lib/socket-management/interfaces';
import assert from 'assert'


/* TO DO: GL June 22
    bouncer and granted as SocketRegistry methods, in order to 
    Trigger create job namespace only once newJob attempt was granted 
*/


let socketRegistry:SocketRegistry;
// Should handle new socket/job pair
export class SocketRegistry extends EventEmitter {
    private registry:Record<string, Socket> = {};
    private server:SocketIOServer;
    private port:number;
    constructor(port:number){
        super();
        this.port   = port;
        this.server = new SocketIOServer<ClientToServerEvents, ServerToClientEvents/*, InterServerEvents, SocketData*/>(this.port);
        const self = this;
        // Job NS logic
        const uuidJobNsRegExp=/^\/job\b-[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/;
        this.server.of(uuidJobNsRegExp).on("connection", (nspJobSocket) => {
            const namespace = nspJobSocket.nsp;
            logger.debug(`job namespace connection at ${namespace.name}`);
            const guessJobID = namespace.name.replace('/job-', '');
            self.registerJob(nspJobSocket, guessJobID);
            nspJobSocket.on('newjob', (jobID:uuid, jobOptProxy:JobOptProxy) => {
                logger.debug("newJobSocket event");
                assert.equal(guessJobID, jobID);
                logger.debug(`========\n=============\nnewJobSocket received container:\n${util.format(jobOptProxy)}`);
              
                self.emit('newJobSocket', jobID, jobOptProxy, nspJobSocket);
            });
            nspJobSocket.on('disconnect', () => {
                logger.debug(`job socket ${namespace.name} disconnected`);
                self.removeJob(guessJobID)
            });

            nspJobSocket.emit('registred');

        });
        // Client main NS logic
        this.server.on('connection', (socket:Socket)=> {
            const uuid = this.registerClient(socket);
            //this.emit('connection'); // for login purposes
            this.emit('clientMainSocketConnection', socket); // concrete socket
            socket.on('newjob',()=> logger.error("OUPSS!!"));
            socket.on('disconnect', function () {
                self.removeClient(uuid);
            });

        });
    }

    registerClient(socket:Socket):string {
        const _ = uuidv4();
        this.registry[_] = socket;
        return _;
    }
    registerJob(socket:Socket, jobID:uuid):void {
        this.registry[jobID] = socket;        
    }
    removeClient(clientID:uuid) {
        logger.debug(`Removing ${clientID} client main socket`)
        delete this.registry[clientID];
    }
    removeJob(jobID:uuid) {
        logger.debug(`Removing ${jobID}  job socket`)
        delete this.registry[jobID];
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

export function socketPull(job:Job/*|JobProxy*/, stdoutStreamOverride?:Promise<Readable>, stderrStreamOverride?:Promise<Readable>):void {
    if (stdoutStreamOverride)
        logger.debug(`${job.id} Shimmering Socket job pulling`);
    else
        logger.debug(`${job.id} Genuine socket job pulling`);
    //  logger.debug(`${util.format(stdout)}`);
    const stdoutStream = stdoutStreamOverride ? stdoutStreamOverride : job.stdout();
    const stderrStream = stderrStreamOverride ? stderrStreamOverride : job.stderr();
    ss(job.socket).on(`${job.id}:stdout`, function (stream:WriteStream) {
        stdoutStream.then((_stdout) => {
            logger.info(`${job.id} Pumping stdout [${job.id}:stdout]`);
            //logger.warn(`stdoutStream expected ${util.format(_stdout)}`);
            _stdout.pipe(stream);
        });
    });
    ss(job.socket).on(`${job.id}:stderr`, function (stream:WriteStream) {
        stderrStream.then((_stderr) => {
            logger.silly(`${job.id} Pumping stderr [${job.id}:stderr]`);
            //logger.warn(`stderrStream expected ${util.format(_stderr)}`);
            _stderr.pipe(stream);
        });
    });

    if (!job.socket)
        return;
    //const jobSocket:SocketIOServer<ClientToServerEvents, ServerToClientEvents, InterServerEvents> = jobObject.socket;
    const jobSocket = job.socket;

    jobSocket.on("list", (path:string, callback) => { 
        logger.debug(`job ${job.id} is handling a list request`)
        //logger.info(`List request received for job ${jobID}`)
        job.list(path).then( (list_items)=> {
            //job.socket.emit(`${job.id}:list`, list_items /*["toto.txt", "tata.txt"]*/);
            callback(list_items);
        });
    });
    //_SOCKET.on("DoyouMind", ()=> { console.log("I dont mind")});
    jobSocket.on("DoyouMind", ()=> { console.log("I dont mind")});

    jobSocket.on("isReadable", (fileName, callback) => {
       job.access(fileName)
        .then( ()=> {
            callback({ status : 'ok', content: ''} as responseFS)
        })
        .catch( (err:NodeJS.ErrnoException) => {
            callback({
                status : err ? 'error' : 'ok',
                content : err  ?? ''
            } as  responseFS)
        });
    });
    //ss(_SOCKET).on('fsRead', function(stream, data) {
    ss(jobSocket).on('fsRead', function(stream:WriteStream, data:any) {
        logger.info(`${job.id} Trying to start pumping fsRead from ${data.name}`);
           /* const dum_stream = new Readable();
           
            dum_stream.push("AAA");
            dum_stream.push("BBB");
            dum_stream.push(null);
            dum_stream.pipe(stream);*/
        job.read(data.name).then( (readableStream)=> {
            readableStream.pipe(stream);
            logger.info(`${job.id} Pumping fsRead 2/2`);
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

    job.socket.emit('completed', job /*JSON.stringify(jobObject)*/);
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
                ss(socket).emit(`input_streams/${inputSymbol}`, remoteData.inputs[inputSymbol]);
                //logger.warn('IeDump from' +  socketNamespace + "/" + inputSymbol);
                //newData.inputs[inputSymbol].pipe(process.stdout)
            }
            ss(socket).emit("script", remoteData.script);
           
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