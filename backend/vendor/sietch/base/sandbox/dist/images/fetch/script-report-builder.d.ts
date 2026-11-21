/**
 * Builds the script report the download stage prints (the input of `parseScriptReport` on the host).
 * Pure, with the file reads injected.
 *
 * There is exactly one report entry for each non-root key of the lockfile's `packages`, in file order,
 * because the host refuses a report that misses a package or names an extra one. For each package the
 * builder reads the real `package.json` that `npm ci` extracted and records the `preinstall`, `install`
 * and `postinstall` script texts (an empty or non-string script is not run by npm and is left out; a
 * longer text is cut at `MAX_REPORT_SCRIPT_BYTES` UTF-8 bytes on a character boundary) and whether the
 * package directory has a `binding.gyp`.
 *
 * A package that npm skipped on this platform (fsevents is the usual case) has no `package.json` on
 * disk. It gets an entry with no scripts, but only when the lockfile marks it `optional` or restricts it
 * with `os`, `cpu` or `libc`. Any other missing `package.json` fails the build: it would hide a script.
 *
 * Package keys come from the host-checked lockfile but are validated again before they become a path.
 */
export type PackageJsonRead = {
    readonly kind: "absent";
} | {
    readonly kind: "present";
    readonly json: unknown;
};
export interface PackageFiles {
    /** Reads and parses `<project>/<key>/package.json`. Throws when it exists but is unreadable or too large. */
    readPackageJson(key: string): Promise<PackageJsonRead>;
    /** The names in the package directory (top level only), or null when the directory is absent. */
    listPackageDir(key: string): Promise<readonly string[] | null>;
}
export type ReportBuild = {
    readonly ok: true;
    readonly bytes: Uint8Array;
} | {
    readonly ok: false;
    readonly reason: string;
};
/** A key that can safely become `<project>/<key>`: under `node_modules`, no empty, `.` or `..` segment. */
export declare function isSafePackageKey(key: string): boolean;
/** The longest prefix of `text` that is at most `maxBytes` UTF-8 bytes and ends on a character boundary. */
export declare function cutUtf8(text: string, maxBytes: number): string;
export declare function buildScriptReport(lockfile: Uint8Array, files: PackageFiles): Promise<ReportBuild>;
//# sourceMappingURL=script-report-builder.d.ts.map