/**
 * The entrypoint's exit codes. Each failure before install has its own code, so the runner (and a test)
 * can tell which step failed from the exit status alone; init writes only the fixed label to stderr, never
 * a name, path or value from the delivery. Everything here is below 128, so none looks like a signal.
 */
export declare const INIT_EXIT: {
    readonly ok: 0;
    /** The delivery stream is short, has trailing bytes, or a part is over its cap. */
    readonly delivery: 64;
    /** A tar part is malformed or holds an entry the extractor refuses. */
    readonly extract: 65;
    /** `control.json` is missing or invalid. */
    readonly control: 66;
    /** `ca.pem` is missing or is not exactly one CA certificate. */
    readonly caBundle: 67;
    /** The DNS relay did not start or did not report ready in time. */
    readonly relay: 68;
    /** A directory or file init has to make could not be made. */
    readonly setup: 69;
    /** A marker or the observer could not be started. */
    readonly spawn: 70;
    /** A bug: an error init did not expect. */
    readonly internal: 71;
};
export type InitExitCode = (typeof INIT_EXIT)[keyof typeof INIT_EXIT];
/** The stderr line for each code. Fixed text. */
export declare const INIT_EXIT_LABELS: Readonly<Record<InitExitCode, string>>;
//# sourceMappingURL=exit-codes.d.ts.map