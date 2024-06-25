/* For developemnt purposes on combination with an example folder file.
the MSJM_CLIENT_DEBUG is set via the client:test directive
eg:
 npm run client:test -- examples/big_stream.js
*/

const DEBUG_CL = process.env.MSJM_CLIENT_DEBUG;
if(DEBUG_CL)
    console.warn("\t\t-- CLIENT ACCUMULATOR DEBUGGER MODE --");
export const client_debugger = (msg:string) => {
    if(DEBUG_CL)
        console.warn(msg);
}

export const client_silly = (msg:string) => {
    if(DEBUG_CL)
        console.warn(msg);
}