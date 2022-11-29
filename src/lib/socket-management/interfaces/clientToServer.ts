import { JobOptProxy } from '../../../shared/types/client';
import { uuid, Path } from '../../../shared/types/base'
import { responseFS } from './index';
export interface ClientToServerEvents {
    read: (fileName:string) => void;
    newJobSocket: (jobID:uuid, jobOpt:JobOptProxy) => void;
    withAck: (d: string, callback: (e: number) => void) => void;
    isReadable: (fileName:Path, callback:(response:responseFS) => void) => void;
    list: (path:Path, callback:(file_list:string[])=>void) => void;    
    //wrapAsZip: (callback:(response:responseFS)=>void)=>void;
}