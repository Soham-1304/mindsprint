import { FrameDecoder } from "../../framing.js";
import { MAX_DEPS_BYTES, MAX_HOME_BYTES } from "../../limits.js";
import { DEPS_TAR_LIMITS, HOME_TAR_LIMITS } from "../../tar-path.js";
import { composeBundle } from "./ca-bundle.js";
import { parseControl } from "./control.js";
import { INIT_EXIT, INIT_EXIT_LABELS } from "./exit-codes.js";
import { extractTar } from "./extract.js";
import { CA_FILE, CACHE_DIR, CERTS_BUNDLE, CHILD_PATH, CONTROL_FILE, HOME_ROOT, INIT_DIR, INSTALL_EXEC, LOAD_EXEC, NODE_PATH, RELAY_PATH, RELAY_READY_LINE, RELAY_READY_TIMEOUT_MS, ROOTS_PATH, SLEEP_PATH, } from "./layout.js";
const decoder = new TextDecoder();
/** The environment of install and load: the control file's variables, `PATH` and the CA bundle. Nothing else. */
export function childEnvironment(control) {
    return { ...control.env, PATH: CHILD_PATH, NODE_EXTRA_CA_CERTS: CERTS_BUNDLE };
}
class Failure extends Error {
    exit;
    constructor(exit) {
        super(String(exit));
        this.exit = exit;
    }
}
async function readDelivery(stdin) {
    const frames = new FrameDecoder([MAX_HOME_BYTES, MAX_DEPS_BYTES]);
    try {
        for await (const chunk of stdin) {
            if (frames.push(chunk) !== undefined)
                break;
        }
    }
    catch {
        throw new Failure(INIT_EXIT.delivery);
    }
    const decoded = frames.finish();
    const [home, cache] = decoded.ok ? decoded.parts : [];
    if (home === undefined || cache === undefined)
        throw new Failure(INIT_EXIT.delivery);
    return [home, cache];
}
async function waitForReady(deps, relay) {
    const stdout = relay.stdout;
    if (stdout === null)
        return false;
    const limit = deps.timeout(RELAY_READY_TIMEOUT_MS);
    const line = `${RELAY_READY_LINE}\n`;
    const sawReady = (async () => {
        let seen = "";
        try {
            for await (const chunk of stdout) {
                seen += decoder.decode(chunk, { stream: true });
                if (seen.length > 64 || (seen.includes("\n") && seen !== line))
                    return false;
                if (seen === line)
                    return true;
            }
        }
        catch {
            return false;
        }
        return false;
    })();
    try {
        return await Promise.race([sawReady, relay.exited.then(() => false), limit.promise.then(() => false)]);
    }
    finally {
        limit.cancel();
    }
}
/** Runs the whole entrypoint and returns its exit code. Never throws. */
export async function runInit(deps) {
    let relay;
    let code;
    try {
        relay = await run(deps, (child) => {
            relay = child;
        });
        code = INIT_EXIT.ok;
    }
    catch (error) {
        code = error instanceof Failure ? error.exit : INIT_EXIT.internal;
    }
    relay?.kill();
    deps.log(INIT_EXIT_LABELS[code]);
    return code;
}
async function run(deps, started) {
    const { fs } = deps;
    const [home, cache] = await readDelivery(deps.stdin);
    // 2. Extract. The cache directory is made first, empty. Both extractions use the same file system.
    const homeResult = await extractTar(home, {
        root: HOME_ROOT,
        limits: HOME_TAR_LIMITS,
        ...extractFsOption(deps),
    });
    if (!homeResult.ok)
        throw new Failure(INIT_EXIT.extract);
    await step(INIT_EXIT.setup, () => fs.mkdirp(CACHE_DIR));
    const cacheResult = await extractTar(cache, {
        root: CACHE_DIR,
        limits: DEPS_TAR_LIMITS,
        allowedTopLevel: ["_cacache"],
        ...extractFsOption(deps),
    });
    if (!cacheResult.ok)
        throw new Failure(INIT_EXIT.extract);
    // 3. Init's own files, then remove them before anything the package could read.
    const controlBytes = await step(INIT_EXIT.control, () => fs.readFile(`${HOME_ROOT}/${INIT_DIR}/${CONTROL_FILE}`));
    const caBytes = await step(INIT_EXIT.caBundle, () => fs.readFile(`${HOME_ROOT}/${INIT_DIR}/${CA_FILE}`));
    await step(INIT_EXIT.setup, () => fs.removeTree(`${HOME_ROOT}/${INIT_DIR}`));
    // 4. Validate, then write the CA bundle.
    const parsed = parseControl(controlBytes);
    if (!parsed.ok)
        throw new Failure(INIT_EXIT.control);
    const { control } = parsed;
    const roots = await step(INIT_EXIT.caBundle, () => fs.readFile(ROOTS_PATH));
    const bundle = composeBundle(decoder.decode(roots), decoder.decode(caBytes));
    if (!bundle.ok)
        throw new Failure(INIT_EXIT.caBundle);
    await step(INIT_EXIT.setup, () => fs.writeNewFile(CERTS_BUNDLE, new TextEncoder().encode(bundle.pem), 0o644));
    // 5. Directories the install and the profile's variables point at.
    const directories = [control.projectDir, CACHE_DIR];
    const temp = control.env.RUNNER_TEMP;
    if (temp !== undefined)
        directories.push(temp);
    for (const directory of directories)
        await step(INIT_EXIT.setup, () => fs.mkdirp(directory));
    // 6. The DNS relay, before any package code can resolve a name.
    const relay = deps.spawn({
        file: NODE_PATH,
        args: [RELAY_PATH, control.sinkAddress],
        cwd: "/",
        env: { PATH: CHILD_PATH },
        captureStdout: true,
    });
    started(relay);
    if (!(await waitForReady(deps, relay)))
        throw new Failure(INIT_EXIT.relay);
    // 7. Install, load, observe.
    const env = childEnvironment(control);
    for (const marker of [INSTALL_EXEC, LOAD_EXEC]) {
        const child = deps.spawn({ file: marker, args: [], cwd: control.projectDir, env, captureStdout: false });
        if ((await child.exited).kind === "error")
            throw new Failure(INIT_EXIT.spawn);
    }
    const observer = deps.spawn({
        file: SLEEP_PATH,
        args: [String(control.observeSeconds)],
        cwd: "/",
        env: { PATH: CHILD_PATH },
        captureStdout: false,
    });
    if ((await observer.exited).kind === "error")
        throw new Failure(INIT_EXIT.spawn);
    return relay;
}
function extractFsOption(deps) {
    return deps.extractFs === undefined ? {} : { fs: deps.extractFs };
}
/** Runs one step and maps any thrown error to the step's exit code. */
async function step(exit, action) {
    try {
        return await action();
    }
    catch {
        throw new Failure(exit);
    }
}
//# sourceMappingURL=init.js.map