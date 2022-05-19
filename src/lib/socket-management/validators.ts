//https://socket.io/get-started/basic-crud-application/
//https://joi.dev/api

const isStream = require('is-stream');

import { JobOptProxy } from '../../shared/types/client'

/*
    type guard for data container send from the consumer microservice to the JM.
    aka "newJobSocket" event
*/
export function isJobOptFromClientToServer(data: any): data is JobOptProxy {

    if (!data.hasOwnProperty('script') && !data.hasOwnProperty('inputs')) return false;
    if (!isStream(data.script)){    
        return false;
    }
    for (let k in data.inputs){
        if ( !isStream(data.inputs[k]) ){
            
            return false;
        }
    }

    return true;
}