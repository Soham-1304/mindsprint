/**
 * The entrypoint's exit codes. Each failure before install has its own code, so the runner (and a test)
 * can tell which step failed from the exit status alone; init writes only the fixed label to stderr, never
 * a name, path or value from the delivery. Everything here is below 128, so none looks like a signal.
 */
export const INIT_EXIT = {
    ok: 0,
    /** The delivery stream is short, has trailing bytes, or a part is over its cap. */
    delivery: 64,
    /** A tar part is malformed or holds an entry the extractor refuses. */
    extract: 65,
    /** `control.json` is missing or invalid. */
    control: 66,
    /** `ca.pem` is missing or is not exactly one CA certificate. */
    caBundle: 67,
    /** The DNS relay did not start or did not report ready in time. */
    relay: 68,
    /** A directory or file init has to make could not be made. */
    setup: 69,
    /** A marker or the observer could not be started. */
    spawn: 70,
    /** A bug: an error init did not expect. */
    internal: 71,
};
/** The stderr line for each code. Fixed text. */
export const INIT_EXIT_LABELS = {
    [INIT_EXIT.ok]: "init: done",
    [INIT_EXIT.delivery]: "init: the delivery stream is invalid",
    [INIT_EXIT.extract]: "init: a delivery part could not be extracted",
    [INIT_EXIT.control]: "init: the control file is invalid",
    [INIT_EXIT.caBundle]: "init: the CA certificate is invalid",
    [INIT_EXIT.relay]: "init: the DNS relay did not start",
    [INIT_EXIT.setup]: "init: setup failed",
    [INIT_EXIT.spawn]: "init: a child could not be started",
    [INIT_EXIT.internal]: "init: internal error",
};
//# sourceMappingURL=exit-codes.js.map