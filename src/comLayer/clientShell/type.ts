import { Readable } from 'stream'
import { JobProxy, JobOptProxy } from '../../shared/types/client'


export type JobWrapStatus = 'idle' | 'sent' | 'bounced' | 'granted' | 'completed';

export interface JobWrap {
    job: JobProxy,
    //data: Object,
    jobOpt : JobOptProxy,
    status: JobWrapStatus
}
export interface SourcesMap  {
    script: Readable,
    inputs:Record<string,Readable>| undefined
}
