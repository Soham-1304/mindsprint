import { SietchError } from "@sietch/core";
import { MAX_HOME_BYTES } from "./limits.js";
import { SAFE_SEGMENT } from "./safe-path.js";
/**
 * A tar stream (ustar) built from an in-memory tree. Pure. The runner builds the fake-home part of the
 * delivery stream with it. The detonation entrypoint extracts it through the tar-path validator.
 *
 * The builder refuses to write an entry that the validator would reject (an absolute name, a `..` or
 * `.` segment, a name with characters outside a safe set), so the two sides agree by construction. It
 * writes only regular files and directories: no links, devices, or FIFOs.
 */
export class TarBuildError extends SietchError {
    constructor(message) {
        super("TAR_BUILD_FAILED", message);
    }
}
const BLOCK = 512;
const NAME_MAX = 100;
const PREFIX_MAX = 155;
const OWNER_NAME = /^[a-z_][a-z0-9_-]{0,30}$/;
const encoder = new TextEncoder();
function octal(value, width) {
    if (!Number.isSafeInteger(value) || value < 0)
        throw new TarBuildError("number out of range");
    const text = value.toString(8);
    if (text.length > width - 1)
        throw new TarBuildError("number does not fit its tar field");
    return `${text.padStart(width - 1, "0")}\0`;
}
function put(header, offset, text) {
    header.set(encoder.encode(text), offset);
}
/** Split a name into ustar `prefix` and `name` fields when it is longer than 100 bytes. */
function splitName(name) {
    if (name.length <= NAME_MAX)
        return { prefix: "", base: name };
    for (let i = name.length - 1; i > 0; i--) {
        if (name[i] !== "/")
            continue;
        const prefix = name.slice(0, i);
        const base = name.slice(i + 1);
        if (prefix.length <= PREFIX_MAX && base.length <= NAME_MAX && base.length > 0)
            return { prefix, base };
    }
    throw new TarBuildError("a path is too long for a ustar header");
}
function checkName(name) {
    if (name === "" || name.startsWith("/") || name.endsWith("/"))
        throw new TarBuildError("bad entry name");
    if (name.split("/").some((s) => !SAFE_SEGMENT.test(s))) {
        throw new TarBuildError("unsafe entry name");
    }
}
function header(entry, size, options) {
    const isDirectory = entry.type === "directory";
    const name = isDirectory ? `${entry.name}/` : entry.name;
    const { prefix, base } = splitName(name);
    const out = new Uint8Array(BLOCK);
    put(out, 0, base);
    put(out, 100, octal(entry.mode, 8));
    put(out, 108, octal(options.uid ?? 1000, 8));
    put(out, 116, octal(options.gid ?? 1000, 8));
    put(out, 124, octal(size, 12));
    put(out, 136, octal(options.mtimeSeconds, 12));
    put(out, 148, "        "); // checksum placeholder: eight spaces
    put(out, 156, isDirectory ? "5" : "0");
    put(out, 257, "ustar\0");
    put(out, 263, "00");
    put(out, 265, options.uname ?? "runner");
    put(out, 297, options.gname ?? "runner");
    put(out, 345, prefix);
    let sum = 0;
    for (const byte of out)
        sum += byte;
    put(out, 148, `${sum.toString(8).padStart(6, "0")}\0 `);
    return out;
}
/** Build the tar stream: each entry's header and padded data, then two zero blocks. */
export function buildTar(entries, options) {
    const maxBytes = options.maxBytes ?? MAX_HOME_BYTES;
    for (const field of [options.uname ?? "runner", options.gname ?? "runner"]) {
        if (!OWNER_NAME.test(field))
            throw new TarBuildError("bad owner name");
    }
    const chunks = [];
    let total = 2 * BLOCK;
    for (const entry of entries) {
        checkName(entry.name);
        if (!Number.isInteger(entry.mode) || entry.mode < 0 || entry.mode > 0o777) {
            throw new TarBuildError("mode out of range");
        }
        const data = entry.type === "file" ? (entry.data ?? new Uint8Array(0)) : new Uint8Array(0);
        if (entry.type === "directory" && entry.data !== undefined)
            throw new TarBuildError("a directory has no data");
        const padded = Math.ceil(data.length / BLOCK) * BLOCK;
        total += BLOCK + padded;
        if (total > maxBytes)
            throw new TarBuildError("the tar is larger than its limit");
        chunks.push(header(entry, data.length, options));
        if (data.length > 0) {
            const body = new Uint8Array(padded);
            body.set(data);
            chunks.push(body);
        }
    }
    const out = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        out.set(chunk, offset);
        offset += chunk.length;
    }
    return out; // the last 1024 bytes are already zero
}
/** The fake-home part of the delivery stream: directories first, then files, named relative to the home. */
export function fakeHomeTar(home, options) {
    const relative = (path) => path.slice(home.home.length + 1);
    return buildTar([
        ...home.directories.map((d) => ({ name: relative(d.path), type: "directory", mode: d.mode })),
        ...home.files.map((f) => ({ name: relative(f.path), type: "file", mode: f.mode, data: f.bytes })),
    ], options);
}
//# sourceMappingURL=tar.js.map