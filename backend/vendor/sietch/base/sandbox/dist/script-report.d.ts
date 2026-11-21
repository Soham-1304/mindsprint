import type { Event } from "@sietch/core";
import { z } from "zod";
/**
 * The script report and the "scripts actually ran" check (Requirement 7.6, design D9). Pure.
 *
 * The download stage reads the real `package.json` of every extracted package and reports, for each
 * lifecycle script it declares, the script text (at most `MAX_SCRIPT_TEXT` characters; a longer script is
 * reported as its first 512 bytes), and whether the package has a `binding.gyp`. npm runs
 * `node-gyp rebuild` as the install script when a package has a `binding.gyp` and declares neither an
 * `install` nor a `preinstall` script (arborist's rebuild step), so that case adds an expected script.
 *
 * The check needs one install-phase exec of `/bin/sh -c <that script>` per expected script, each exec
 * satisfying at most one script. An exec for a different script does not count, so a pipeline that skips
 * one package's script cannot hide behind another package's. A missing script is ERROR
 * `SCRIPTS_NOT_RUN`, because a trace without the install behaviour would look clean.
 *
 * Messages carry counts and fixed text only, never package names, paths, or script text from the report.
 */
/** The lifecycle scripts npm runs when it installs a dependency. */
export declare const INSTALL_LIFECYCLE_SCRIPTS: readonly ["preinstall", "install", "postinstall"];
/**
 * The shell npm runs lifecycle scripts with. The install step passes it to npm as
 * `NPM_SCRIPT_SHELL_FLAG`, so a script run is one exact `execve` of this path with argv
 * `[<name>, "-c", <script>]` (design D9; confirmed by spike 5, question 2, on the detonation image under
 * gVisor). Without the flag npm tries one exec per PATH entry, which is not a usable record.
 *
 * The flag and `LIFECYCLE_SCRIPT_BINARY` are both derived from this one constant. A test fails if they
 * ever differ, because a drift would end every scan with SCRIPTS_NOT_RUN.
 */
export declare const NPM_SCRIPT_SHELL = "/bin/sh";
/** The npm option the install marker passes. */
export declare const NPM_SCRIPT_SHELL_FLAG = "--script-shell=/bin/sh";
/** The binary the trace shows for a lifecycle script: the same path as `NPM_SCRIPT_SHELL`. */
export declare const LIFECYCLE_SCRIPT_BINARY: string;
/** The argument that makes the script binary run a command string. */
export declare const LIFECYCLE_SCRIPT_FLAG = "-c";
/** The install script npm runs for a package with a `binding.gyp` and no `install` or `preinstall`. */
export declare const DEFAULT_GYP_SCRIPT = "node-gyp rebuild";
/** The longest script text a report entry may carry (the reporter cuts a longer script at 512 bytes). */
export declare const MAX_SCRIPT_TEXT = 512;
declare const reportSchema: z.ZodObject<{
    packages: z.ZodArray<z.ZodObject<{
        path: z.ZodString;
        scripts: z.ZodArray<z.ZodObject<{
            name: z.ZodEnum<{
                install: "install";
                postinstall: "postinstall";
                preinstall: "preinstall";
            }>;
            text: z.ZodString;
        }, z.core.$strict>>;
        bindingGyp: z.ZodBoolean;
    }, z.core.$strict>>;
}, z.core.$strict>;
export type ScriptReport = z.infer<typeof reportSchema>;
export type ScriptReportParse = {
    readonly ok: true;
    readonly report: ScriptReport;
} | {
    readonly ok: false;
    readonly code: "FETCH_OUTPUT_INVALID";
    readonly reason: string;
};
/**
 * Parse and validate the report. `lockfilePackagePaths` are the lockfile's non-root keys: the report
 * must have exactly one entry for each, and none for anything else.
 */
export declare function parseScriptReport(bytes: Uint8Array, lockfilePackagePaths: readonly string[]): ScriptReportParse;
/** Every script text npm is expected to run for the whole report, one entry per script. */
export declare function expectedScriptTexts(report: ScriptReport): string[];
/** How many packages declare an install script or have a `binding.gyp` that npm builds. */
export declare function countPackagesWithScripts(report: ScriptReport): number;
export type ScriptsCheck = {
    readonly ok: true;
    readonly packagesWithScripts: number;
    readonly scriptExecs: number;
} | {
    readonly ok: false;
    readonly code: "SCRIPTS_NOT_RUN";
    readonly reason: string;
};
/**
 * Check that npm ran every expected lifecycle script. `packageManagerPid` is the install role's pid (npm's
 * pid). A script run is an install-phase `exec` of `LIFECYCLE_SCRIPT_BINARY` with argv
 * `[_, "-c", <script>]`, by a process descended from npm. Each exec satisfies at most one expected
 * script, so two packages with the same script need two execs. Any other exec proves nothing: a failed
 * exec also prints `= 0` in the trace.
 */
export declare function checkScriptsRan(report: ScriptReport, events: readonly Event[], packageManagerPid: number): ScriptsCheck;
export {};
//# sourceMappingURL=script-report.d.ts.map