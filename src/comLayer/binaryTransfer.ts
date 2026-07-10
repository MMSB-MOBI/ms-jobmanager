/*
 * Native socket.io binary transport.
 *
 * A minimal, symmetric chunked-transfer primitive built directly on socket.io
 * binary events (Buffer arguments are sent as binary attachments, which the
 * python-socketio client decodes to `bytes`). It replaces `socket.io-stream`
 * for clients that negotiate `transport: 'binary'` at connection time.
 *
 * Wire protocol (all events scoped to a single per-job namespaced socket):
 *   bin:req   (reqId, channel, args)    client -> server : request a download
 *   bin:open  (id, channel)             producer          : announce an upload
 *   bin:data  (id, chunk)  [+ack]       producer          : one chunk (ack = backpressure)
 *   bin:end   (id)                      producer          : transfer complete
 *   bin:error (id, message)             producer          : transfer aborted
 *
 * Downloads reuse the client-provided `reqId` as the transfer `id`, so no
 * `bin:open` is needed for them. Uploads generate an `id` and bind it to a
 * pre-registered channel sink via `bin:open`.
 */
import { Readable, PassThrough, Writable } from 'stream';
import { Socket } from 'socket.io';

const my_logger = require('../logger.js');
const logger = my_logger.logger;

const CHUNK_SIZE = 512 * 1024; // 512 KB, well under maxHttpBufferSize (1e8)

let _counter = 0;
function nextId(jobHint: string): string {
    _counter += 1;
    return `bt-${jobHint}-${_counter}`;
}

export type RequestHandler = (channel: string, args: any) => Readable | Promise<Readable>;

export class BinaryTransport {
    private socket: Socket;
    private jobHint: string;
    // channel -> sink waiting for an upload
    private sinks: Record<string, Writable> = {};
    // transfer id -> resolved sink (once bin:open bound it to a channel)
    private incoming: Record<string, Writable> = {};
    private requestHandler?: RequestHandler;
    private bound = false;

    constructor(socket: Socket, jobHint = 'job') {
        this.socket = socket;
        this.jobHint = jobHint;
    }

    /* Register upload sinks (bin:open/data/end/error) and download requests. */
    bind(): void {
        if (this.bound) return;
        this.bound = true;

        this.socket.on('bin:open', (id: string, channel: string) => {
            const sink = this.sinks[channel];
            if (!sink) {
                logger.error(`[binaryTransfer] no sink registered for channel ${channel}`);
                this.socket.emit('bin:error', id, `no sink for channel ${channel}`);
                return;
            }
            logger.debug(`[binaryTransfer] upload ${id} bound to channel ${channel}`);
            this.incoming[id] = sink;
            // A channel is single-use per grant; drop it so a duplicate open fails loudly.
            delete this.sinks[channel];
        });

        this.socket.on('bin:data', (id: string, chunk: any, ack?: (err?: string) => void) => {
            const sink = this.incoming[id];
            if (!sink) {
                if (ack) ack(`unknown transfer ${id}`);
                return;
            }
            // Backpressure: only ack once the chunk has been accepted by the sink.
            sink.write(Buffer.from(chunk), () => { if (ack) ack(); });
        });

        this.socket.on('bin:end', (id: string) => {
            const sink = this.incoming[id];
            if (sink) sink.end();
            delete this.incoming[id];
            logger.debug(`[binaryTransfer] upload ${id} ended`);
        });

        this.socket.on('bin:error', (id: string, message: string) => {
            const sink = this.incoming[id];
            if (sink) sink.destroy(new Error(message));
            delete this.incoming[id];
            logger.error(`[binaryTransfer] upload ${id} errored: ${message}`);
        });

        this.socket.on('bin:req', async (reqId: string, channel: string, args: any) => {
            if (!this.requestHandler) {
                this.socket.emit('bin:error', reqId, 'no request handler');
                return;
            }
            try {
                const readable = await this.requestHandler(channel, args);
                this.send(reqId, readable);
            } catch (e: any) {
                logger.error(`[binaryTransfer] request ${channel} failed: ${e}`);
                this.socket.emit('bin:error', reqId, String(e?.message ?? e));
            }
        });
    }

    /* Pre-register a PassThrough that will receive the upload for `channel`.
       Returned Readable can be handed straight to downstream consumers. */
    expect(channel: string): Readable {
        const pt = new PassThrough({ highWaterMark: CHUNK_SIZE });
        this.sinks[channel] = pt;
        return pt;
    }

    /* Register the producer for download requests (bin:req). */
    onRequest(handler: RequestHandler): void {
        this.requestHandler = handler;
    }

    /* Stream a Readable to the peer under transfer id `id`, chunk by chunk,
       waiting for the peer's ack between chunks (backpressure). */
    send(id: string, readable: Readable): Promise<void> {
        return new Promise((resolve, reject) => {
            const socket = this.socket;
            readable.on('data', (chunk: Buffer | string) => {
                readable.pause();
                // Force a Buffer so socket.io ships it as a binary attachment
                // (a string Readable would otherwise arrive decoded on the peer).
                const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                socket.emit('bin:data', id, buf, () => readable.resume());
            });
            readable.on('end', () => {
                socket.emit('bin:end', id);
                logger.debug(`[binaryTransfer] download ${id} complete`);
                resolve();
            });
            readable.on('error', (e: Error) => {
                socket.emit('bin:error', id, e.message);
                reject(e);
            });
        });
    }

    /* Convenience: fresh transfer id scoped to this transport's job. */
    freshId(): string {
        return nextId(this.jobHint);
    }
}

const _transports = new WeakMap<Socket, BinaryTransport>();

/* One bound BinaryTransport per socket, reused across granted()/socketPull(). */
export function getBinaryTransport(socket: Socket, jobHint = 'job'): BinaryTransport {
    let bt = _transports.get(socket);
    if (!bt) {
        bt = new BinaryTransport(socket, jobHint);
        bt.bind();
        _transports.set(socket, bt);
    }
    return bt;
}

/* True when the client negotiated the native-binary transport at connection. */
export function isBinaryTransport(socket: Socket): boolean {
    return (socket.handshake?.auth as any)?.transport === 'binary';
}
