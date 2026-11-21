import { NPM_SCRIPT_SHELL_FLAG } from "../../script-report.js";
import { CACHE_DIR, HARNESS_PATH, NODE_PATH, NPM_PATH } from "./layout.js";
/**
 * The two marker scripts the detonation image runs (design D13). The trace normaliser tells the install
 * role from the load role by the first `execve` of a direct child of init: `/opt/runner/install` and
 * `/opt/runner/load`. Each script `exec`s its real program, so the shell is replaced and the marker is
 * one exec in the trace, followed by npm or node.
 *
 * Both are rendered from constants, not written by hand: the shell flag is the one `script-report.ts`
 * checks the trace against, and the paths are the layout's, so the script and the check can't drift.
 *
 * Host side only. The build driver calls it while staging the image context; it is not in the image.
 *
 * `--dangerously-allow-all-scripts`: from npm 12 install scripts are opt-in, and a scan that silently
 * skipped them would look clean. The flag keeps the behaviour the scan is about independent of the npm
 * version in the base image (spike 5). `--offline` plus `--cache` means npm reads only the delivered cache.
 */
export const INSTALL_ARGS = [
    "ci",
    "--offline",
    "--cache",
    CACHE_DIR,
    NPM_SCRIPT_SHELL_FLAG,
    "--dangerously-allow-all-scripts",
    "--no-audit",
    "--no-fund",
];
const SAFE_ARG = /^[A-Za-z0-9._/=:@+-]+$/;
function script(program, args) {
    // Every word is checked, so no quoting is ever needed and nothing can end up as shell syntax.
    for (const word of [program, ...args]) {
        if (!SAFE_ARG.test(word))
            throw new TypeError("a marker word has a character that needs quoting");
    }
    return `#!/bin/sh\nexec ${[program, ...args].join(" ")}\n`;
}
export const renderMarkers = () => ({
    install: script(NPM_PATH, INSTALL_ARGS),
    load: script(NODE_PATH, [HARNESS_PATH]),
});
//# sourceMappingURL=markers.js.map