import { EventEmitter } from "events"; 
import { Readable } from 'stream'
import { isStreamOrStringMap } from '../shared/types/base';
import { format as uFormat} from 'util';
import { logger } from '../logger';
const isStream = require('is-stream');
import { stat as fsStat, lstatSync, createReadStream, createWriteStream } from 'fs';
import { basename } from  'path';
import { createHash } from 'crypto';
import { JobOptInputs, ClientInputBaseMap } from '../shared/types/common/jobopt_model';
import { JobInputBuildError } from "../errors/client";

import { client_debugger } from "../comLayer/clientShell/debugLogger";



export class JobInputs extends EventEmitter {
    streams:Record<string, Readable> = {}
    paths:Record<string, string>     = {}
    hashes:Record<string, string>    = {}

    hashable:boolean = false;
    onError:boolean  = false;

    /** 
     *  Build the Map of file basename and stream
     * @param data - Array of filepath, or file symbol keys and values as filepath or Readable
     *               Or an array mixing the three types
     * Following input spec is valide:
     *  [ "/path/to/file.txt", 
     *   {"a.txt": "/path/to/u.log", "g.txt": <Readable>}, 
     *   "/data/log.txt", 
     *   {"n.txt": "/path/to/j.zip"}
     * ]
     * @returns inputMap - A litteral where keys are symbol used to define target files and values are Readable 
    */
    constructor(data?:JobOptInputs|JobOptInputs[] /*Record<string, string|Readable>|string[]*//*, skip?:boolean*/){
        super();
 
       
        if(!data) {
            logger.debug("Passed data to JobInput constructor is empty");
            return;
        }
        
        let buffer:Record<string, string|Readable> = {}
        
        // it is a list, which elemnts can be
        if (data.constructor === Array){
            if(data.length == 0)
                return;        
            data.forEach( (item:any) => { // type this
                //1) A string, we assume these are the path to actual files
                if (typeof item === 'string') {
                    const k   = basename(item);
                    if(k in buffer)
                        throw new JobInputBuildError(`Multiple occurence of key \"${k}\"in jobInput`)
                    buffer[k] = item;
                    return;
                }
                //2) A map, which can host many key(filename for tgt) value(src file path or Readable)
                else if ( isStreamOrStringMap(item) ) // It can be a map
                    for (let symbol in item)
                        if(symbol in buffer)
                            throw new JobInputBuildError(`Multiple occurence of key \"${symbol}\"in jobInput`)
                        else
                            buffer[symbol] = item[symbol];
                
            });
        } else // It is a map
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
                logger.error("stream error at " + key)
                client_debugger("STREAM ERROR AT " + key);
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