import { z } from "zod";
/**
 * `.init/control.json`: what the runner tells init, carried in the fake-home part because the detonation
 * container is started with no environment and no arguments. Init is the only reader and removes the file
 * before it starts install.
 *
 *   env           the environment of install and load (the profile's variables, honeytokens included)
 *   projectDir    the working directory of both, under /home/runner/work/
 *   sinkAddress   where the DNS relay forwards to
 *   observeSeconds how long init watches after install and load have both exited
 *
 * Strict at every level. Names are plain identifiers, values are printable ASCII, there are at most 128
 * variables, and `PATH` and `NODE_EXTRA_CA_CERTS` are init's alone to set. A value that holds `PRIVATE KEY`
 * is refused: nothing in the environment is meant to be a key, and the CA private key must never reach
 * this container by this route.
 */
export declare const MAX_CONTROL_BYTES: number;
export declare const MAX_ENV_ENTRIES = 128;
export declare const MAX_ENV_VALUE_CHARS = 4096;
export declare const MIN_OBSERVE_SECONDS = 1;
export declare const MAX_OBSERVE_SECONDS = 60;
/** True for an absolute path under the work root with plain segments and no `.` or `..` segment. */
export declare function isProjectPath(value: string): boolean;
declare const controlSchema: z.ZodObject<{
    env: z.ZodRecord<z.ZodString, z.ZodString>;
    projectDir: z.ZodString;
    sinkAddress: z.ZodString;
    observeSeconds: z.ZodNumber;
}, z.core.$strict>;
export type Control = z.infer<typeof controlSchema>;
export type ControlParse = {
    readonly ok: true;
    readonly control: Control;
}
/** Fixed text. Never the input, and never a zod message (a message can carry a value). */
 | {
    readonly ok: false;
    readonly reason: string;
};
/** Parses `control.json`. Never throws. */
export declare function parseControl(bytes: Uint8Array): ControlParse;
export {};
//# sourceMappingURL=control.d.ts.map