import { type Rng } from "./rng.js";
/**
 * The one fake person and project behind every file and variable in a scan, so a stealer that
 * cross-checks the git config, the npm and GitHub files, and the CI variables sees one consistent
 * story. Every value comes from the rng. Nothing here names a real person or a real account.
 */
export interface Identity {
    /** GitHub login, also the CI actor. Lowercase letters and digits with at most one hyphen. */
    readonly login: string;
    readonly displayName: string;
    /** GitHub numeric user id. */
    readonly userId: string;
    /** GitHub's no-reply address form (`<id>+<login>@users.noreply.github.com`), so it points at no real mailbox. */
    readonly email: string;
    /** GitHub organisation. */
    readonly org: string;
    readonly orgId: string;
    readonly repo: string;
    readonly repoId: string;
    /** Hosted-runner style host name. */
    readonly hostname: string;
    /** The `RUNNER_NAME` value. */
    readonly runnerName: string;
}
/** Draw a fresh fake identity. */
export declare function generateIdentity(rng: Rng): Identity;
/** True if every field of `identity` has the shape `generateIdentity` produces. */
export declare function isValidIdentity(identity: Identity): boolean;
//# sourceMappingURL=identity.d.ts.map