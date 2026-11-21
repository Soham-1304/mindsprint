import { chmod, lstat, mkdir, readdir, readFile, realpath, writeFile } from "node:fs/promises";
import { isAbsolute, join, posix, relative, sep } from "node:path";
import { SietchError } from "@sietch/core";
import { lintDockerfile } from "./dockerfile-lint.js";
import { IMAGE_FILES, isImageName, LIB_SANDBOX_DIR } from "./image-spec.js";
/**
 * Builds the Docker build context for one image in a fresh directory:
 *
 * ```
 * Dockerfile                      from base/sandbox/images/<image>/ (linted first)
 * lib/package.json                {"type":"module"}
 * lib/sandbox/<file>.js           only the files IMAGE_FILES lists for the image
 * lib/node_modules/@sietch/core   package.json and the .js files of core's dist
 * lib/node_modules/zod            package.json files and .js files, read through the pnpm link
 * runner/install, runner/load     detonation image only, from the `renderMarkers` hook
 * ```
 *
 * Only files this function names are copied, never a directory tree of ours. It refuses a listed file that
 * is a declaration, a source map or a test, that resolves outside `base/sandbox/dist`, or that is a link.
 * It also checks the built files: every relative import must be another listed file, and every other
 * import must be `node:*`, `@sietch/core` or `zod`, so an image can't start and then fail on a missing
 * module. Nothing is installed and no network is used.
 *
 * Every check that doesn't need the output directory runs before the first byte is written. A failure
 * during the copy itself (a link in core's dist, an oversize tree) can leave a partial directory, so the
 * caller owns `outDir` and removes it (`buildImage` does).
 */
export class StageError extends SietchError {
    constructor(message) {
        super("IMAGE_STAGE_FAILED", message);
    }
}
const MAX_STAGED_FILES = 2000;
const MAX_STAGED_BYTES = 32 * 1024 * 1024;
const MAX_DOCKERFILE_BYTES = 64 * 1024;
const MAX_MARKER_BYTES = 4096;
const ALLOWED_FILE = /^[a-z0-9][a-z0-9._/-]*\.js$/;
const FORBIDDEN_FILE = /\.test\.js$|\/__fixtures__\/|\.\.|\/\//;
const SKIPPED_DIRECTORIES = new Set(["src", "node_modules"]);
const FILE_MODE = 0o644;
const DIRECTORY_MODE = 0o755;
const SCRIPT_MODE = 0o755;
// --- Import scanning ------------------------------------------------------------------------------
// Line-anchored patterns over our own compiled output and source, not a JavaScript parser. A type-only
// statement is skipped because it leaves no import behind after compilation.
const STATIC_IMPORT = /^[ \t]*(import|export)\b([^;'"`]*?)\bfrom\s*(["'])([^"'\n]+)\3/gm;
const SIDE_EFFECT_IMPORT = /^[ \t]*import\s*(["'])([^"'\n]+)\1/gm;
const DYNAMIC_IMPORT = /\bimport\s*\(\s*(["'])([^"'\n]+)\1\s*\)/g;
/** The module specifiers a source or compiled file loads at run time. */
export function moduleSpecifiers(text) {
    const found = [];
    for (const match of text.matchAll(STATIC_IMPORT)) {
        if (/^\s*type\b/.test(match[2] ?? ""))
            continue;
        found.push(match[4] ?? "");
    }
    for (const match of text.matchAll(SIDE_EFFECT_IMPORT))
        found.push(match[2] ?? "");
    for (const match of text.matchAll(DYNAMIC_IMPORT))
        found.push(match[2] ?? "");
    return found;
}
/** True for the modules an image has besides its own files: Node's, core, and zod. */
export function isImageProvidedModule(specifier) {
    return (specifier.startsWith("node:") ||
        specifier === "@sietch/core" ||
        specifier === "zod" ||
        specifier.startsWith("zod/"));
}
/** Resolves a relative specifier against a dist-relative file path. Returns null when it leaves dist. */
export function resolveRelativeImport(fromFile, specifier) {
    const resolved = posix.normalize(posix.join(posix.dirname(fromFile), specifier));
    return resolved.startsWith("../") || resolved === ".." || posix.isAbsolute(resolved) ? null : resolved;
}
// --- Checks ---------------------------------------------------------------------------------------
function checkAllowEntry(entry) {
    if (typeof entry !== "string" || !ALLOWED_FILE.test(entry) || FORBIDDEN_FILE.test(entry)) {
        throw new StageError("an image file list holds an entry that is not a plain compiled .js file");
    }
    return entry;
}
function isInside(root, path) {
    const rel = relative(root, path);
    return rel !== "" && rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel);
}
async function readRegularFile(path, what, maxBytes) {
    let info;
    try {
        info = await lstat(path);
    }
    catch {
        throw new StageError(`${what} is missing`);
    }
    if (!info.isFile())
        throw new StageError(`${what} is not a regular file`);
    if (info.size > maxBytes)
        throw new StageError(`${what} is too large`);
    return new Uint8Array(await readFile(path));
}
function checkClosure(files) {
    const decoder = new TextDecoder();
    for (const [file, bytes] of files) {
        for (const specifier of moduleSpecifiers(decoder.decode(bytes))) {
            if (specifier.startsWith("./") || specifier.startsWith("../")) {
                const target = resolveRelativeImport(file, specifier);
                if (target === null || !files.has(target)) {
                    throw new StageError(`${file} imports a file that is not in the image file list`);
                }
            }
            else if (!isImageProvidedModule(specifier)) {
                throw new StageError(`${file} imports a module the image does not contain`);
            }
        }
    }
}
function checkMarkers(markers) {
    for (const text of [markers.install, markers.load]) {
        if (typeof text !== "string" ||
            !text.startsWith("#!/bin/sh\n") ||
            text.includes("\0") ||
            new TextEncoder().encode(text).length > MAX_MARKER_BYTES) {
            throw new StageError("a marker script is not a short /bin/sh script");
        }
    }
}
// --- Writer ---------------------------------------------------------------------------------------
class Writer {
    outDir;
    written = [];
    #directories = new Set();
    #bytes = 0;
    constructor(outDir) {
        this.outDir = outDir;
    }
    async #ensureDirectory(rel) {
        let current = "";
        for (const segment of rel.split("/")) {
            if (segment === "")
                continue;
            current = current === "" ? segment : `${current}/${segment}`;
            if (this.#directories.has(current))
                continue;
            const path = join(this.outDir, current);
            await mkdir(path);
            await chmod(path, DIRECTORY_MODE);
            this.#directories.add(current);
        }
    }
    async put(rel, bytes, mode) {
        if (this.written.length >= MAX_STAGED_FILES)
            throw new StageError("the image context has too many files");
        this.#bytes += bytes.length;
        if (this.#bytes > MAX_STAGED_BYTES)
            throw new StageError("the image context is too large");
        await this.#ensureDirectory(posix.dirname(rel) === "." ? "" : posix.dirname(rel));
        const path = join(this.outDir, rel);
        await writeFile(path, bytes, { flag: "wx", mode });
        await chmod(path, mode);
        this.written.push(rel);
    }
}
/**
 * Copies the files of `source` that `accept` allows. A link anywhere is refused. `src` and `node_modules`
 * directories are skipped. Every other file is left behind.
 */
async function copyTree(writer, source, destination, accept) {
    let copied = 0;
    const walk = async (directory, rel) => {
        const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
        for (const entry of entries) {
            const path = join(directory, entry.name);
            const next = rel === "" ? entry.name : `${rel}/${entry.name}`;
            if (entry.isSymbolicLink())
                throw new StageError("a link was found where only plain files may be");
            if (entry.isDirectory()) {
                if (!SKIPPED_DIRECTORIES.has(entry.name))
                    await walk(path, next);
            }
            else if (entry.isFile()) {
                if (!accept(entry.name))
                    continue;
                const bytes = await readRegularFile(path, "a copied file", MAX_STAGED_BYTES);
                await writer.put(`${destination}/${next}`, bytes, FILE_MODE);
                copied += 1;
            }
        }
    };
    await walk(source, "");
    return copied;
}
const acceptDistFile = (name) => name.endsWith(".js") && !name.endsWith(".test.js");
const acceptPackageFile = (name) => name === "package.json" || acceptDistFile(name);
async function resolveInside(root, path, what) {
    let real;
    try {
        real = await realpath(path);
    }
    catch {
        throw new StageError(`${what} is missing`);
    }
    if (!isInside(root, real))
        throw new StageError(`${what} resolves outside the repository`);
    return real;
}
export async function stageImageContext(options) {
    const { image, repoRoot, outDir } = options;
    if (!isImageName(image))
        throw new StageError("unknown image name");
    if (typeof repoRoot !== "string" || !isAbsolute(repoRoot)) {
        throw new StageError("the repository root must be an absolute path");
    }
    if (typeof outDir !== "string" || !isAbsolute(outDir)) {
        throw new StageError("the output directory must be an absolute path");
    }
    if (image === "detonation" && options.renderMarkers === undefined) {
        throw new StageError("the detonation image needs its marker scripts");
    }
    if (image !== "detonation" && options.renderMarkers !== undefined) {
        throw new StageError("only the detonation image has marker scripts");
    }
    const allowed = (options.allowlist ?? IMAGE_FILES)[image].map(checkAllowEntry);
    if (new Set(allowed).size !== allowed.length)
        throw new StageError("an image file list repeats an entry");
    const root = await realpath(repoRoot).catch(() => {
        throw new StageError("the repository root is missing");
    });
    const sandboxDir = join(root, "base", "sandbox");
    const distDir = await resolveInside(root, join(sandboxDir, "dist"), "the sandbox dist directory");
    // Read and check everything before the first byte is written.
    const dockerfile = await readRegularFile(join(sandboxDir, "images", image, "Dockerfile"), "the Dockerfile", MAX_DOCKERFILE_BYTES);
    if (lintDockerfile(new TextDecoder().decode(dockerfile)).length > 0) {
        throw new StageError("the Dockerfile does not pass the linter");
    }
    const dist = new Map();
    for (const entry of allowed) {
        const real = await resolveInside(distDir, join(distDir, entry), `the compiled file ${entry}`);
        dist.set(entry, await readRegularFile(real, `the compiled file ${entry}`, MAX_STAGED_BYTES));
    }
    checkClosure(dist);
    const markers = options.renderMarkers?.();
    if (markers !== undefined)
        checkMarkers(markers);
    const corePackage = await readRegularFile(join(root, "base", "core", "package.json"), "the core package.json", MAX_DOCKERFILE_BYTES);
    const coreDist = await resolveInside(root, join(root, "base", "core", "dist"), "the core dist directory");
    const zodDir = await resolveInside(root, join(sandboxDir, "node_modules", "zod"), "the zod package");
    await mkdir(outDir, { recursive: true });
    if ((await readdir(outDir)).length > 0)
        throw new StageError("the output directory is not empty");
    const writer = new Writer(await realpath(outDir));
    await writer.put("Dockerfile", dockerfile, FILE_MODE);
    await writer.put("lib/package.json", new TextEncoder().encode('{"type":"module"}\n'), FILE_MODE);
    for (const [entry, bytes] of dist)
        await writer.put(`lib/${LIB_SANDBOX_DIR}/${entry}`, bytes, FILE_MODE);
    const coreRoot = "lib/node_modules/@sietch/core";
    await writer.put(`${coreRoot}/package.json`, corePackage, FILE_MODE);
    if ((await copyTree(writer, coreDist, `${coreRoot}/dist`, acceptDistFile)) === 0) {
        throw new StageError("the core dist directory holds no compiled files; build @sietch/core first");
    }
    if ((await copyTree(writer, zodDir, "lib/node_modules/zod", acceptPackageFile)) === 0) {
        throw new StageError("the zod package holds no files");
    }
    if (markers !== undefined) {
        const encoder = new TextEncoder();
        await writer.put("runner/install", encoder.encode(markers.install), SCRIPT_MODE);
        await writer.put("runner/load", encoder.encode(markers.load), SCRIPT_MODE);
    }
    return { files: [...writer.written].sort() };
}
//# sourceMappingURL=stage.js.map