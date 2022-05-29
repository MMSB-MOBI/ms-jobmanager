export { ClientToServerEvents } from './clientToServer';
export { ServerToClientEvents } from './serverToClient';

type responseStatus = "ok" | "error";

export  interface responseFS {
    status: responseStatus,
    content:string|NodeJS.ErrnoException,
}