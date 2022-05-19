import { JobOptProxy } from "../../../shared/types/client";

export interface ServerToClientEvents {
    noArg: () => void;
    newJobSocket: (jobOpt:JobOptProxy) => void;
    withAck: (d: string, callback: (e: number) => void) => void;
}