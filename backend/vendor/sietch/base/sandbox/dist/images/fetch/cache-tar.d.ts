/**
 * Archives npm's cache for delivery to the detonation container. Impure only through the injected
 * `run` (a spawn with an argument array, never a shell) and `fileSize`.
 *
 * Only `_cacache`, the content-addressed store, goes in: not `_logs` (which may name the proxy) or the
 * update-notifier file (spike 5). The archive is written with busybox `tar` to a file first, because the
 * frame length must be sent before the bytes. Busybox emits only directory, regular-file and GNU
 * long-name (`L`) headers, which the detonation image's extractor accepts (verified in the VM). The
 * archive is refused when it is over `maxBytes`.
 */
export interface CacheTarDeps {
    /** Runs `file args...` to completion and returns its exit code (null when killed). */
    run(file: string, args: readonly string[]): Promise<number | null>;
    fileSize(path: string): Promise<number>;
}
export type CacheTarResult = {
    readonly ok: true;
    readonly size: number;
} | {
    readonly ok: false;
    readonly reason: string;
};
/** The `tar` argument vector. Every value is a constant of this image. */
export declare function cacheTarArgv(cacheDir: string, outFile: string): readonly string[];
export declare function createCacheTar(deps: CacheTarDeps, options: {
    readonly cacheDir: string;
    readonly outFile: string;
    readonly maxBytes: number;
}): Promise<CacheTarResult>;
//# sourceMappingURL=cache-tar.d.ts.map