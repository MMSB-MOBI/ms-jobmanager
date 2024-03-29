import { ReadStream } from 'fs';

import libStream = require("stream");
import isStream = require('is-stream');
import { Readable } from "stream";
import { readable as isReadable } from 'is-stream';
import { JobInputs } from '../../job/inputs';
import { accessSync, constants } from 'fs';
import { JobOptInputs } from './common/jobopt_model';
/*
    Usual basic container type interface and predicates
*/

export type uuid = string;

export interface stringMap { [s: string] : string; }
export function isStringMap(obj: any): obj is stringMap {
    if(typeof(obj) != 'object') return false;

    for(let key in obj){
        if(typeof(key) != 'string') return false;

        if(typeof(obj[key]) != 'string') return false;
    }
    return true;
}

export interface stringMapOpt { [s: string] : string|undefined; }
export function isStringMapOpt(obj: any): obj is stringMapOpt {
    if(typeof(obj) != 'object') return false;
    for(let key in obj)
        if(typeof(key) != 'string') return false;
    return true;
}

export interface streamMap { [s: string] : libStream.Readable; }
export function isStreamMap(obj: any): obj is streamMap {
    if(typeof(obj) != 'object') return false;
    for(let key in obj) {
        if(typeof(key) != 'string') return false;
        if(!isStream(obj[key])) return false;
    }
    return true;
}

export interface streamOrStringMap { [s: string] : libStream.Readable|string; }
export function isStreamOrStringMap(obj: any): obj is streamOrStringMap {
    if(typeof(obj) != 'object') return false;
    for(let key in obj) {
        if(typeof(key) != 'string') return false;
        if(!isStream(obj[key]) && typeof(obj[key]) != 'string') return false;
    }
    return true;
}


export function isRecordOfStringToStringOrNumber (obj: any): obj is Record<string, string|number> {
    if(typeof(obj) != 'object') return false;
    for(const [key, value] of Object.entries(obj)) {
        if(typeof(key) != 'string') return false;
        if(typeof(value) != 'string' && typeof(value) != 'number') return false;
    }
    return true;
}

export function isStringToStringOrStreamRecord (obj: any): obj is Record<string, string|Readable> {
    if(typeof(obj) != 'object') return false;
    for(const [key, value] of Object.entries(obj)) {
        if(typeof(key) != 'string') return false;
        if(typeof(value) != 'string' && !isReadable(value) ) return false;
    }
    return true;
}



export interface InputDataSocket { [s: string] : ReadStream|Path; }
export function isInputDataSocket(obj:any): obj is InputDataSocket {
    if (! (obj instanceof Object))
        return false;
    for(const [key, value] of Object.entries(obj)) {
        if(typeof(key) != 'string') return false;
        if(!isReadableOrPath(value)) return false;
    }
    return true;
}

export function isReadableStream(obj:any): obj is Readable {
    return (
      obj !== null &&
      typeof obj === 'object' &&
      typeof obj.pipe === 'function' &&
      typeof obj.on === 'function' &&
      typeof obj.read === 'function'
    );
  }

export function isValidJobOptInputs (obj: any): obj is JobOptInputs {//InputDataSocket|string[]|JobInputs {
    if (obj instanceof JobInputs) 
        return true;
    if (isInputDataSocket(obj))
        return true;

    if (obj instanceof Array) {
        for (const _ of obj) {
            if(typeof(_) === 'string') {
                if( !isPath(_) ) {
                    console.error(`[ms-jobmanager:client::Input Check Failure] ${_} is an invalid path`);
                    return false;
                }
            } else {
                if(!isInputDataSocket(_)) {
                    console.error(`[ms-jobmanager:client::Input Check Failure] ${_} is not a valid map`);
                    return false;
                }
            }
        }
        return true;
    }

    return false;
}

export function isArrayOfString(obj: any): obj is string[] {
    if (!Array.isArray(obj))
        return false;
    if (obj.length == 0)
        return false

    return obj.reduce( (isValid: boolean, e: any) => typeof (e) === "string" && isValid, true );
}


export function isReadableOrString(obj: any): obj is Readable|string {
    return isStream(obj) || typeof(obj) == 'string';
}

export type Path = string;

export function isPath(maybePath:string): maybePath is Path {
    try {
        accessSync(maybePath, constants.R_OK);
        return true;
      } catch (err) {
        return false;
      }
}

export function isReadableOrPath(obj: any): obj is Readable|Path {
   
    return isStream(obj) || isPath(obj);
}