import { tarEntryTypeFromFlag } from "../../tar-path.js";
const BLOCK = 512;
const REASONS = {
    TAR_BAD_HEADER: "a tar header has no ustar magic",
    TAR_BAD_CHECKSUM: "a tar header checksum does not match",
    TAR_BAD_FIELD: "a tar header field is malformed",
    TAR_TRUNCATED: "the tar ends inside an entry or before its end marker",
    TAR_TRAILING_BYTES: "the tar has data after its end marker",
};
const FATAL_UTF8 = new TextDecoder("utf-8", { fatal: true });
class Stop extends Error {
    code;
    constructor(code) {
        super(code);
        this.code = code;
    }
}
function isZeroBlock(bytes, offset) {
    for (let i = offset; i < offset + BLOCK; i++)
        if (bytes[i] !== 0)
            return false;
    return true;
}
/** An octal field: optional leading spaces, at least one octal digit, then NULs or spaces. Never base-256. */
function octal(field) {
    let i = 0;
    while (i < field.length && field[i] === 0x20)
        i += 1;
    let value = 0;
    let digits = 0;
    while (i < field.length) {
        const byte = field[i] ?? 0;
        if (byte < 0x30 || byte > 0x37)
            break;
        value = value * 8 + (byte - 0x30);
        digits += 1;
        i += 1;
    }
    if (digits === 0 || digits > 11)
        throw new Stop("TAR_BAD_FIELD");
    for (; i < field.length; i++) {
        const byte = field[i] ?? 1;
        if (byte !== 0 && byte !== 0x20)
            throw new Stop("TAR_BAD_FIELD");
    }
    return value;
}
/** A NUL-terminated text field. Everything after the first NUL is ignored. */
function text(field) {
    const end = field.indexOf(0);
    try {
        return FATAL_UTF8.decode(end === -1 ? field : field.subarray(0, end));
    }
    catch {
        throw new Stop("TAR_BAD_FIELD");
    }
}
function checksumOk(header) {
    let sum = 0;
    for (let i = 0; i < BLOCK; i++)
        sum += i >= 148 && i < 156 ? 0x20 : (header[i] ?? 0);
    return sum === octal(header.subarray(148, 156));
}
function parseHeader(header) {
    // "ustar" at 257. The next byte is NUL (POSIX, version "00") or a space (GNU, "ustar  \0").
    const magic = header.subarray(257, 263);
    const posix = magic[5] === 0 && header[263] === 0x30 && header[264] === 0x30;
    const gnu = magic[5] === 0x20 && header[263] === 0x20 && header[264] === 0;
    if (text(magic.subarray(0, 5)) !== "ustar" || (!posix && !gnu))
        throw new Stop("TAR_BAD_HEADER");
    if (!checksumOk(header))
        throw new Stop("TAR_BAD_CHECKSUM");
    const base = text(header.subarray(0, 100));
    // Only the POSIX layout has a prefix field. In the GNU layout those bytes hold other fields.
    const prefix = posix ? text(header.subarray(345, 500)) : "";
    const name = prefix === "" ? base : `${prefix}/${base}`;
    const flag = String.fromCharCode(header[156] ?? 0);
    return {
        name,
        type: tarEntryTypeFromFlag(flag),
        size: octal(header.subarray(124, 136)),
        mode: octal(header.subarray(100, 108)),
    };
}
/**
 * Walks the archive one header at a time. The generator ends after the end marker, or after the first
 * error step. It never throws.
 */
export function* readTar(bytes) {
    let offset = 0;
    try {
        for (;;) {
            if (bytes.length - offset < BLOCK)
                throw new Stop("TAR_TRUNCATED");
            if (isZeroBlock(bytes, offset)) {
                // End marker: a second zero block, then only zero padding to the end of the input.
                if (bytes.length - offset < 2 * BLOCK || !isZeroBlock(bytes, offset + BLOCK)) {
                    throw new Stop(bytes.length - offset < 2 * BLOCK ? "TAR_TRUNCATED" : "TAR_BAD_HEADER");
                }
                for (let i = offset + 2 * BLOCK; i < bytes.length; i++) {
                    if (bytes[i] !== 0)
                        throw new Stop("TAR_TRAILING_BYTES");
                }
                return;
            }
            const header = parseHeader(bytes.subarray(offset, offset + BLOCK));
            offset += BLOCK;
            const padded = Math.ceil(header.size / BLOCK) * BLOCK;
            if (bytes.length - offset < padded)
                throw new Stop("TAR_TRUNCATED");
            yield { ok: true, item: { ...header, data: bytes.subarray(offset, offset + header.size) } };
            offset += padded;
        }
    }
    catch (error) {
        const code = error instanceof Stop ? error.code : "TAR_BAD_HEADER";
        yield { ok: false, error: { code, reason: REASONS[code] } };
    }
}
//# sourceMappingURL=tar-reader.js.map