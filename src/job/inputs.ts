import { EventEmitter } from "events"; 
import { Readable } from 'stream'
import { isStreamOrStringMap, isArrayOfString } from '../shared/types/base';
import { format as uFormat} from 'util';
import { logger } from '../logger';
const isStream = require('is-stream');
import { stat as fsStat, lstatSync, createReadStream, createWriteStream } from 'fs';
import { basename } from  'path';
import { createHash } from 'crypto';
import { JobOptInputs } from '../shared/types/common/jobopt_model';

export class JobInputs extends EventEmitter {
    streams:Record<string, Readable> = {}
    paths:Record<string, string>     = {}
    hashes:Record<string, string>    = {}

    hashable:boolean = false;
    onError:boolean  = false;

    /* Constructor can receive a map w/ two types of value
        Should be SYNC-like
    */
    constructor(data?:JobOptInputs/*Record<string, string|Readable>|string[]*//*, skip?:boolean*/){
        super();
        
        //let safeNameInput:boolean = true;
        
        if(!data) {
            logger.debug("Passed data to JobInput constructor is empty");
            return;
        }
        
        let buffer:Record<string, string|Readable> = {}
        

        if (data.constructor === Array){
            if(data.length == 0)
                return;
            if(!isArrayOfString(data) ) {
                logger.error(`Array of inputs must be strings (plain or filepath)`);
                this.onError = true;
                return;
            }
            const _:Record<string, string> = {};
            data.forEach( (item) => {
                const k   = basename(item);
                buffer[k] = item;
            });
        } else
            buffer = { ...data as Record<string, string|Readable> } 
      
        const nInputs = Object.keys(buffer).length;
        logger.debug(`jobInput constructed w/ ${nInputs} items:\n${uFormat(buffer)}`);

        let self = this;
        for (let key in buffer) {
            logger.debug(`Browing JobInput key ${key}`);
            if( isStream(buffer[key]) )
                this.streams[key] = <Readable>buffer[key];
            else {
                try{                   
                    const datum:string = <string>buffer[key];
                    lstatSync(datum).isFile();                   
                    this.streams[key] = createReadStream(datum);
                } catch(e) {
                    logger.error(`Provided input named ${key} is not a file:\n${e}`);        
                    this.onError = true;
                    return;
               }
            }            
            this.streams[key].on('error', (e:string) => {
                self.emit('streamReadError', e);
            });
        }
        logger.debug("JobInputs constructed");
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
    write(location:string):JobInputs{

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
                    //let path = `${location}/${tuple[0]}.inp`;
                    const path = `${location}/${tuple[0]}`;
                    
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