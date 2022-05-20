import { JobOptProxy } from "../../../shared/types/client";
import { uuid } from '../../../shared/types/base';

export interface ServerToClientEvents {
    noArg: () => void;
    newJobSocket: (jobOpt:JobOptProxy) => void;
    bounced:(jobID:uuid) => void;
    withAck: (d: string, callback: (e: number) => void) => void;
}