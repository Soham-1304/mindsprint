import type { Profile } from "./profiles/types.js";
/**
 * The fake home as an in-memory tree: every file a profile plants, as bytes, plus the directories
 * they need and the list of planted credential files. Pure: nothing touches a disk.
 *
 * Every path is inside `home`. The delivery tar names entries relative to `home`, so the entrypoint
 * extracts it into `$HOME` and nothing can land elsewhere (the project directory of the CI profile is
 * inside the home directory).
 */
export interface FakeFile {
    /** Absolute path inside the container. */
    readonly path: string;
    readonly bytes: Uint8Array;
    readonly mode: number;
}
export interface FakeDirectory {
    readonly path: string;
    readonly mode: number;
}
export interface FakeHome {
    readonly home: string;
    /** Sorted by path. */
    readonly files: readonly FakeFile[];
    /** Parents before children. Never includes `home` itself, which already exists. */
    readonly directories: readonly FakeDirectory[];
    /** Every planted file the engine must see as a credential store. */
    readonly credentialPaths: readonly string[];
    /** The subset the engine doesn't know by itself. Goes into `environment.extraCredentialPaths`. */
    readonly extraCredentialPaths: readonly string[];
}
/** Build the tree for a profile. Throws `FakeEnvironmentError` for anything out of place. */
export declare function buildFakeHome(profile: Profile): FakeHome;
//# sourceMappingURL=fake-home.d.ts.map