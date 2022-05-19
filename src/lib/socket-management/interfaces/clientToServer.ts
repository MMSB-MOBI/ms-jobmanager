import { JobOptProxy } from "../../../shared/types/client";

export interface ClientToServerEvents {
    read: (fileName:string) => void;
    newJobSocket: (jobOpt:JobOptProxy) => void;
    withAck: (d: string, callback: (e: number) => void) => void;
}