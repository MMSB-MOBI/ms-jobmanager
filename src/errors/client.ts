import {inspect} from 'util';
import { JobOptProxy, JobProxy } from '../shared/types/client';
import { Readable } from 'stream';
import { JobFileSystem } from '../comLayer/clientShell/fileSystem';

export class ConnectionError extends Error {
    TCP:string;
    port: number;
    name:string;
    constructor(message:string, TCP:string, port:number) {
        super(message);
        this.TCP  = TCP
        this.port = port
        this.name = "ConnectionError";
        //Error.captureStackTrace(this, ConnectionError);
    }
}

export class StartConnectionError extends ConnectionError {
    constructor(TCP:string, port:number) {
        super(`Unable to connect at ${TCP}:${port}`, TCP, port);
        this.name = "StartConnectionError";
        //Error.captureStackTrace(this, StartConnectionError);
    }
}

export class PushConnectionLostError extends ConnectionError {
    constructor(TCP:string, port:number) {
        super(`Connection lost before pushing job at ${TCP}:${port}`, TCP, port);
        this.name = "PushConnectionLostError";
        //Error.captureStackTrace(this, PushConnectionLostError);
    }
}

export class JobConnectionLostError extends ConnectionError {
    constructor(TCP:string, port:number, id:string) {
        super(`Connection lost before pushing job at ${TCP}:${port}`, TCP, port);
        this.name = "JobConnectionLostError";
        this.message = `${id}::${this.message}`;
        //Error.captureStackTrace(this, JobConnectionLostError);
    }
}

export class JobOptError extends Error {
    constructor(varName:string, eType:string, varValue:any) {
        super(`jobOpt property ${varName} of value ${inspect(varValue)} is not of type ${eType}`);
        this.name = 'JobOptError';
        //Error.captureStackTrace(this, JobOptError);
    }
}

export class JobError extends Error {
    id:string;
    
    constructor(message:string, id:string) {
        super();
        this.id = id;
        this.message = `${this.id}::${message}`;
        this.name = "JobError";
        //Error.captureStackTrace(this, JobError);
    }
}

export class JobStderrNotEmpty extends JobError {
    stderr:string; 
    job:JobProxy;
    constructor(stderr:string, job:JobProxy) {
        super(stderr, job.id);
        this.name = "JobStderrNotEmpty";
        this.stderr = stderr;
        this.job    = job;
        //Job//Error.captureStackTrace(this, JobStderrNotEmpty);
    }
}

export class JobStderrNotEmptyFS extends JobStderrNotEmpty {
    jobFS:JobFileSystem;
    constructor(error:JobStderrNotEmpty, jobFS:JobFileSystem) {
        super(error.stderr, error.job);
        this.name = "JobStderrNotEmptyFS";
        this.jobFS = jobFS;
        //Job//Error.captureStackTrace(this, JobStderrNotEmpty);
    }
}

export class ScriptError extends JobError {   
    constructor(message:string, id:string) {
        super(message, id);
    
        this.name = "ScriptError";
        //Error.captureStackTrace(this, ScriptError);
    }
}

export class RemoteScriptError extends JobError {   
    constructor(message:string, id:string) {
        super(message, id);
    
        this.name = "RemoteScriptError";
        //Error.captureStackTrace(this, RemoteScriptError);
    }
}

export class RemoteInputError extends JobError {   
    constructor(message:string, id:string) {
        super(message, id);
    
        this.name = "RemoteInputError";
        //Error.captureStackTrace(this, RemoteInputError);
    }
}

export class RemoteFileSystemError extends JobError {   
    constructor(message:string, error:string, id:string, data:JobOptProxy) {
        super(`${message} ${error} data:${inspect(data)}`, id);
    
        this.name = "RemoteFileSystemError";
        //Error.captureStackTrace(this, RemoteFileSystemError);
    }
}

export class LostJobError extends JobError {   
    constructor(id:string, data:JobOptProxy) {
        super(`data : ${inspect(data)}`, id);
        this.name = "LostJobError"; 
        //Error.captureStackTrace(this, LostJobError);
    }
}

/* JobFS errors */
export class JobErrorFS extends Error {
    id:string;
    constructor(message:string, id:string) {
        super();
        this.id = id;
        this.message = `${this.id}::${message}`;
        this.name = "JobErrorFS";
        //Error.captureStackTrace(this, JobError);
    }
}

export class ReadErrorFS extends JobErrorFS {   
    constructor(content:any, id:string) {
        super(`data : ${inspect(content)}`, id);
        this.name = "ReadErrorFS"; 
        Error.captureStackTrace(this, ReadErrorFS);
    }
}

export class WriteErrorFS extends JobErrorFS {   
    constructor(content:any, id:string) {
        super(content, id);
        this.name = "WriteErrorFS"; 
        Error.captureStackTrace(this, WriteErrorFS);
    }
}
