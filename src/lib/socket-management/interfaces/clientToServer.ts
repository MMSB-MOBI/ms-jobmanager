import { JobOptProxy } from '../../../shared/types/client';
import { uuid } from '../../../shared/types/base'
export interface ClientToServerEvents {
    read: (fileName:string) => void;
    newJobSocket: (jobID:uuid, jobOpt:JobOptProxy) => void;
    withAck: (d: string, callback: (e: number) => void) => void;
}