import { EventEmitter } from "events"; 
import { Readable } from 'stream'
import { isStreamOrStringMap } from '../shared/types/base';
import { format as uFormat} from 'util';
import { logger } from '../logger';
const isStream = require('is-stream');
import { stat as fsStat, lstatSync, createReadStream, createWriteStream } from 'fs';
const path = require("path");
import {createHash} from 'crypto';

export class JobInputs extends EventEmitter {
    streams:Record<string, Readable> = {}
    paths:Record<string, string> = {}
    hashes:Record<string, string> = {}

    hashable:boolean=false;


    /* Constructor can receive a map w/ two types of value
        Should be SYNC-like
    */
    constructor(data?:{}|any[]/*, skip?:boolean*/){
        super();
        
        let safeNameInput:boolean = true;
        
        if(!data)
            return;
        
        
        let buffer:any = {};
        // Coherce array in litteral, autogenerate keys
        if (data.constructor === Array) {
            safeNameInput = false;
            let a = <Array<any>>data;
            for (let e of a.entries())
                buffer[`file${e[0]}`] = e[1];
        } else {
            buffer = data;
        }
        if (!isStreamOrStringMap(buffer))
            throw(`Wrong format for ${uFormat(buffer)}`);
        let nTotal = Object.keys(buffer).length;
        logger.debug(`jobInput constructed w/ ${nTotal} items:\n${uFormat(buffer)}`);

        let self = this;
        for (let key in data) {
            if( isStream(buffer[key]) )
                this.streams[key] = <Readable>buffer[key];
            else {
                try{
                    //if (!safeNameInput) throw('file naming is unsafe');
                    let datum:string = <string>buffer[key];
                    lstatSync(datum).isFile();
                    let k = path.basename(datum).replace(/\.[^/.]+$/, ""); 
                    k = key; // GL Aug2018, HOTFIX from taskobject, maybe will break JM -- MS side let'see
                    this.streams[k] = createReadStream(datum);
                    logger.debug(`${buffer[key]} is a file, stream assigned to ${k}`);

                } catch(e) {
                    logger.warn(`Provided input named ${key} is not a file, assuming a string`);                    
                  // Handle error
                    if(e.code == 'ENOENT'){
                    //no such file or directory
                    //do something
                    } else {
                    //do something else
                    }
                    this.streams[key] = new Readable();
                  
                    this.streams[key].push(<string>buffer[key]);
                    this.streams[key].push(null);
                    
                   // this.streams[key].on('data',(e)=>{ logger.error(`${e.toString()}`); });
                    
                    // Following block works as intended
                  /*  let toto:any = new streamLib.Readable();
                    toto.push(<string>buffer[key]);
                    toto.push(null);
                    toto.on('data',(e)=>{ logger.error(`${e.toString()}`); });*/
                    //
               }
            }
            this.streams[key].on('error', (e:string) => {
                self.emit('streamReadError', e);
            });
        }      
    }
    // Access from client side to wrap in socketIO
    getStreamsMap():Record<string, Readable>|undefined {
        if (this.hashable) {
            logger.warn('All streams were consumed');
            return undefined;
        }  
        return this.streams;
    }
    hash():Record<string, string>|undefined {
        if (!this.hashable) {
            logger.warn('Trying to get hash of inputs before write it to files');
            return undefined;
        }
        return this.hashes;
    }
    write(location:string):jobInputs{

        let self = this;
        let inputs:any[] = [];
        Object.keys(this.streams).forEach((k) => {
            let tuple: [string, Readable] = [k, self.streams[k]];
            inputs.push(tuple);
        });

        let promises = inputs.map(function(tuple) {
            return new Promise(function(resolve,reject){
               
                fsStat(location,(err, stats)=>{
                    if(err) {
                        logger.error("Wrong filr path :: " + err);
                        reject('path error');
                        return;
                    }
                    let path = `${location}/${tuple[0]}.inp`;
                    let target = createWriteStream(path);
                    target.on('error', (msg:string) => {
                        logger.error(`Failed to open write stream ${msg}`);
                        reject('createWriteStreamError');
                    })
                    //logger.info(`opening ${path} success`);

              
                    tuple[1].pipe(target);
                    target
                    .on('data',(d:any)=>{console.log(d);})
                    .on('close', () => {                    
                        // the file you want to get the hash    
                        let fd = createReadStream(path);
                        fd.on('error', ()=>{
                            logger.error(`Can't open for reading ${path}`);
                        })
                        let hash = createHash('sha1');
                        hash.setEncoding('hex');
                   // fd.on('error',()=>{logger.error('KIN')});
                        fd.on('end', function() {
                            hash.end();
                            let sum = hash.read().toString();
                            self.hashes[tuple[0]] = sum; // the desired sha1sum                        
                            self.paths[tuple[0]] = path; // the path to file   
                            resolve([tuple[0], path, sum]);//.
                        });
// read all file and pipe it (write it) to the hash object
                        fd.pipe(hash);
                    });
                })
            });
        });
       // WE SHOULD HANDLE STREAM WRITE ERROR REJECTION AND PROPAGATE IT FOR 
       // owner JOB to be set in error status
       // BUT FIFO mess seems fixed so we'll see later, sorry
        Promise.all(promises).then(values => {           
            self.hashable = true;
            //logger.error(`${values}`);
            self.emit('OK', values)
          }, reason => {
            console.log(reason)
          });

        return this;
    }
    /* Returns a dictionary of inpuSymbols:pathToFile to be dumped by batchDumper */
    
}