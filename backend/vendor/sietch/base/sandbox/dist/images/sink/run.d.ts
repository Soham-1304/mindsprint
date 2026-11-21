import type { CaDeps } from "../../ca.js";
import { type Recorder } from "./recorder.js";
import { type SinkServers, type SinkServersOptions } from "./servers.js";
/**
 * The sink's start-up and shutdown with everything outside injected, so a test can run it on loopback ports.
 * `main.ts` wires the real process around it.
 *
 * Exit codes: 64 for a bad start-up input, 70 if a port cannot be bound (gVisor ignores the low-port sysctl, so
 * a bind failure must stop the sink: design decision 2). Both happen before any record is written.
 */
export declare const EXIT_BAD_INPUT = 64;
export declare const EXIT_BIND_FAILED = 70;
export declare const EXIT_INTERNAL = 1;
export interface RunDeps {
    readonly stdin: AsyncIterable<Uint8Array>;
    /** Receives each JSON line of the record stream. */
    readonly write: (line: string) => void;
    readonly now: () => number;
    readonly caDeps: CaDeps;
    readonly bindAddress: string;
    readonly ports: SinkServersOptions["ports"];
    /** Optional limits, for tests. */
    readonly limits?: Pick<SinkServersOptions, "maxConnections" | "idleMs" | "totalMs" | "handshakeMs" | "settleMs">;
    readonly recorderLimits?: {
        readonly maxRecords?: number;
        readonly maxBytes?: number;
    };
}
export type RunResult = {
    readonly ok: true;
    readonly servers: SinkServers;
    readonly recorder: Recorder;
    /** Ends the open connections, closes the sockets, and writes the end record unless the run overflowed. */
    stop(): Promise<void>;
} | {
    readonly ok: false;
    readonly exitCode: number;
    readonly message: string;
};
export declare function runSink(deps: RunDeps): Promise<RunResult>;
//# sourceMappingURL=run.d.ts.map