import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runHarness } from "./harness.js";
/**
 * The load harness process (`node harness-main.js`, started by the `load` marker with the project
 * directory as its working directory). It resolves every dependency from the project's own `node_modules`
 * and prints nothing. After the loads it waits `SETTLE_MS` for module code that starts work on a timer,
 * then exits, so the load phase ends even for a package that keeps a timer alive. Whatever the package
 * does after that is seen in the observation window that init runs next.
 *
 * Exit status: 0 when at least one dependency was attempted, `NOTHING_LOADED_EXIT` when none was (no readable
 * package.json, or no valid dependency name) and 3 on an unexpected error. A load that loaded nothing must
 * not look like a clean run, and the `exit` event of the load role carries this code into the trace.
 */
const NOTHING_LOADED_EXIT = 4;
const SETTLE_MS = 1_000;
async function main() {
    const projectRequire = createRequire(join(process.cwd(), "package.json"));
    const { attempted } = await runHarness({
        readFile: () => readFileSync(join(process.cwd(), "package.json"), "utf8"),
        requireModule: (name) => projectRequire(name),
        importModule: (name) => import(pathToFileURL(projectRequire.resolve(name)).href),
    });
    await new Promise((resolve) => setTimeout(resolve, SETTLE_MS));
    return attempted === 0 ? NOTHING_LOADED_EXIT : 0;
}
main().then((code) => process.exit(code), () => process.exit(3));
//# sourceMappingURL=harness-main.js.map