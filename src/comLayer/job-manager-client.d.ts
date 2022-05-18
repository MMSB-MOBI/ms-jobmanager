// Layout is taken from : https://stackoverflow.com/questions/39040108/import-class-in-definition-file-d-ts
// https://stackoverflow.com/questions/53811426/how-to-write-d-ts-file-for-js-file-which-export-a-pure-object
// Cannot figure how to use external types in custom declaration file

declare module 'ms-jobmanager';

interface connectionSettings {
    port  : number,
    TCPip : string 
} 

// Unfortunate local redifination of import(../job).jobOptProxyInterface
export interface jobOptProxyClient {     
    id?:string;
    script? : any,//import("stream").Readable|string,
    jobProfile?: string;
    cmd? : string,
    exportVar? : Record<string, string|number>
    inputs? : any//inputDataSocket|string[]|jobInputs,
    tagTask? : string,
    namespace? :string,
    modules? : string [],
    socket?:any,
    sysSettingsKey?:string
}

export function start(settings:connectionSettings):Promise<any>;

export function push(jobOpt:jobOptProxyClient):any;

export function get_socket():any;

export declare class JobFileSystemInterface {
   constructor(jobID: string);
   list(path?:string):string[];
   read(filename:string): any;// to do
}