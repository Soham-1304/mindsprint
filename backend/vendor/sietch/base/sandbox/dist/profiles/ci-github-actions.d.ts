import { type Identity } from "../identity.js";
import type { RequestArch } from "../request.js";
import { type Rng } from "../rng.js";
import type { Profile } from "./types.js";
export declare const CI_USER = "runner";
export declare const CI_HOME = "/home/runner";
export declare const CI_TOOL_CACHE = "/opt/hostedtoolcache";
export interface CiProfileDeps {
    readonly rng: Rng;
    /** Milliseconds since the epoch. Injected so the profile is a pure function of its inputs. */
    readonly clock: () => number;
    /** Architecture of the container, for `RUNNER_ARCH`. Required, so the profile can't disagree with the host. */
    readonly arch: RequestArch;
}
/** Build the GitHub Actions CI profile, with fresh fakes. Pass a fresh identity or let it draw one. */
export declare function buildCiProfile(deps: CiProfileDeps, identity?: Identity): Profile;
//# sourceMappingURL=ci-github-actions.d.ts.map