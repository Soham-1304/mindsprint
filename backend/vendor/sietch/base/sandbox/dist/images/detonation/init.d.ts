import { type Control } from "./control.js";
import { type InitExitCode } from "./exit-codes.js";
import { type ExtractFs } from "./extract.js";
/**
 * The detonation entrypoint, as a function of injected parts (stdin, file system, process spawning, timer).
 * `main.ts` wires the real ones. The container starts it with no environment and no arguments, so the
 * delivery stream is its only input:
 *
 *   [u64 length][fake-home tar][u64 length][npm cache tar]
 *
 * Order, and what a failure at each step does. Every step before "install" ends the run with its own exit
 * code and starts neither marker (a scan whose environment could not be built must not run package code):
 *
 *   1. read the stream; a short stream, trailing bytes or a part over its cap is `delivery`
 *   2. extract the home part into /home/runner and the cache part into the npm cache directory; either
 *      one failing is `extract`
 *   3. read `.init/control.json` and `.init/ca.pem`, then delete `.init/` so the package never sees them
 *   4. validate the control file (`control`) and compose the CA bundle (`caBundle`), write the bundle
 *   5. make the project, cache and temp directories (`setup`)
 *   6. start the DNS relay and wait for its `ready` line (`relay`)
 *   7. install: spawn the install marker; then load: spawn the load marker; then the observer
 *      (`/bin/sleep <observeSeconds>`); a marker that can't be spawned is `spawn`
 *
 * Every spawn is an absolute path with an argument array, never a shell. The children get exactly the
 * control file's environment plus `PATH` (read-only directories only) and `NODE_EXTRA_CA_CERTS`; init's
 * own environment is never forwarded. Install and load are spawned directly by init, so the trace
 * normaliser sees each marker as the first exec of a direct child of init. The relay and the observer are
 * direct children too, but they exec neither marker, so their events are dropped.
 *
 * Init logs a fixed line to stderr and never a path, name or value from the delivery.
 */
export interface InitFs {
    readFile(path: string): Promise<Uint8Array>;
    /** Creates parents as needed. Used only for paths init validated or fixed itself. */
    mkdirp(path: string): Promise<void>;
    /** A new file that must not exist. */
    writeNewFile(path: string, data: Uint8Array, mode: number): Promise<void>;
    /** Removes a directory tree. Missing is not an error. */
    removeTree(path: string): Promise<void>;
}
export type ChildExit = {
    readonly kind: "exit";
    readonly code: number | null;
    readonly signal: string | null;
}
/** The program could not be started (not found, not executable). */
 | {
    readonly kind: "error";
};
export interface Child {
    /** The child's stdout when `captureStdout` was asked for, else null. */
    readonly stdout: AsyncIterable<Uint8Array> | null;
    /** Never rejects. */
    readonly exited: Promise<ChildExit>;
    kill(): void;
}
export interface SpawnRequest {
    /** An absolute path. */
    readonly file: string;
    readonly args: readonly string[];
    readonly cwd: string;
    /** The child's whole environment. */
    readonly env: Readonly<Record<string, string>>;
    readonly captureStdout: boolean;
}
export interface InitDeps {
    readonly stdin: AsyncIterable<Uint8Array>;
    readonly fs: InitFs;
    /** Used for both delivery parts. Defaults to the real file system. */
    readonly extractFs?: ExtractFs;
    readonly spawn: (request: SpawnRequest) => Child;
    readonly timeout: (ms: number) => {
        readonly promise: Promise<void>;
        cancel(): void;
    };
    /** One fixed line to stderr. */
    readonly log: (line: string) => void;
}
/** The environment of install and load: the control file's variables, `PATH` and the CA bundle. Nothing else. */
export declare function childEnvironment(control: Control): Record<string, string>;
/** Runs the whole entrypoint and returns its exit code. Never throws. */
export declare function runInit(deps: InitDeps): Promise<InitExitCode>;
//# sourceMappingURL=init.d.ts.map