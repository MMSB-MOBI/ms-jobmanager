/* DEPRECATED  */

/*import { JobSerial } from './server';

export interface ServerToClientEvents {
    noArg: () => void;
    basicEmit: (a: number, b: string, c: Buffer) => void;
    withAck: (d: string, callback: (e: number) => void) => void;
    completed:(job:JobSerial) => void;
  }
  
export interface ClientToServerEvents {
    hello: () => void;
    //newJobSocket:()
}
  
export interface InterServerEvents {
    ping: () => void;
  }
  
export interface SocketData {
    name: string;
    age: number;
  }
  */