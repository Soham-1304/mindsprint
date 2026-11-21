// A fake OpenSSH Ed25519 private key file (the `openssh-key-v1` format, unencrypted). Pure on the rng.
//
// Layout (https://github.com/openssh/openssh-portable/blob/master/PROTOCOL.key):
//   "openssh-key-v1\0", string cipher "none", string kdf "none", string kdf options "",
//   uint32 key count (1), string public key blob, string private section.
// The private section is: two equal random uint32 check values, string key type, string public key,
// string (seed || public key), string comment, then padding bytes 1, 2, 3... up to a multiple of 8.
import { createPrivateKey, createPublicKey } from "node:crypto";
import { FakeEnvironmentError } from "../errors.js";
import { drawBytes } from "../rng.js";
import { concat } from "./der.js";
import { pickLine, wrapLines } from "./registration.js";
const ARMOR_BEGIN = "-----BEGIN OPENSSH PRIVATE KEY-----";
const ARMOR_END = "-----END OPENSSH PRIVATE KEY-----";
const MAGIC = "openssh-key-v1\0";
const KEY_TYPE = "ssh-ed25519";
const LINE_WIDTH = 70;
const SEED_LENGTH = 32;
const PUBLIC_LENGTH = 32;
const BLOCK = 8;
const MAX_COMMENT = 64;
/** A line must hold at least this many bytes of the seed to be worth registering (192 bits). */
const MIN_SEED_BYTES_IN_LINE = 24;
/** PKCS#8 prefix of an Ed25519 private key; the 32-byte seed follows. */
const ED25519_PKCS8_PREFIX = Uint8Array.of(0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20);
const encoder = new TextEncoder();
const u32 = (value) => Uint8Array.of((value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff);
const sshString = (bytes) => concat([u32(bytes.length), bytes]);
function publicKeyOf(seed) {
    const key = createPrivateKey({
        key: Buffer.from(concat([ED25519_PKCS8_PREFIX, seed])),
        format: "der",
        type: "pkcs8",
    });
    const jwk = createPublicKey(key).export({ format: "jwk" });
    if (jwk.x === undefined)
        throw new FakeEnvironmentError("could not derive the Ed25519 public key");
    return new Uint8Array(Buffer.from(jwk.x, "base64url"));
}
/** A fake Ed25519 key file. `comment` is printable ASCII without a newline (for example `runner@host`). */
export function generate(rng, comment) {
    if (comment.length > MAX_COMMENT || !/^[ -~]*$/.test(comment)) {
        throw new FakeEnvironmentError("invalid SSH key comment");
    }
    const seed = drawBytes(rng, SEED_LENGTH);
    const publicKey = publicKeyOf(seed);
    const check = drawBytes(rng, 4);
    const type = encoder.encode(KEY_TYPE);
    const publicBlob = concat([sshString(type), sshString(publicKey)]);
    const prefix = concat([
        encoder.encode(MAGIC),
        sshString(encoder.encode("none")),
        sshString(encoder.encode("none")),
        sshString(new Uint8Array(0)),
        u32(1),
        sshString(publicBlob),
    ]);
    const beforeSeed = concat([
        check,
        check,
        sshString(type),
        sshString(publicKey),
        u32(SEED_LENGTH + PUBLIC_LENGTH),
    ]);
    const unpadded = concat([beforeSeed, seed, publicKey, sshString(encoder.encode(comment))]);
    const padding = new Uint8Array((BLOCK - (unpadded.length % BLOCK)) % BLOCK).map((_, i) => i + 1);
    const section = concat([unpadded, padding]);
    const binary = concat([prefix, u32(section.length), section]);
    const seedStart = prefix.length + 4 + beforeSeed.length;
    const lines = wrapLines(Buffer.from(binary).toString("base64"), LINE_WIDTH);
    const minChars = Math.ceil((MIN_SEED_BYTES_IN_LINE * 4) / 3);
    const seedFirstChar = Math.floor((seedStart * 4) / 3);
    const seedEndChar = Math.ceil(((seedStart + SEED_LENGTH) * 4) / 3);
    const eligible = [];
    for (let i = 0; i < lines.length; i++) {
        const from = i * LINE_WIDTH;
        const to = from + (lines[i]?.length ?? 0);
        const overlap = Math.min(to, seedEndChar) - Math.max(from, seedFirstChar);
        if (lines[i]?.length === LINE_WIDTH && overlap >= minChars)
            eligible.push(i);
    }
    if (eligible.length === 0)
        throw new FakeEnvironmentError("no eligible key line");
    return {
        file: `${ARMOR_BEGIN}\n${lines.join("\n")}\n${ARMOR_END}\n`,
        keyLine: pickLine(rng, lines, eligible),
    };
}
class Reader {
    bytes;
    offset = 0;
    constructor(bytes) {
        this.bytes = bytes;
    }
    get remaining() {
        return this.bytes.length - this.offset;
    }
    take(length) {
        if (length < 0 || length > this.remaining)
            throw new RangeError("short read");
        const out = this.bytes.subarray(this.offset, this.offset + length);
        this.offset += length;
        return out;
    }
    u32() {
        const b = this.take(4);
        return ((b[0] ?? 0) * 2 ** 24 + (b[1] ?? 0) * 2 ** 16 + (b[2] ?? 0) * 2 ** 8 + (b[3] ?? 0)) >>> 0;
    }
    string() {
        return this.take(this.u32());
    }
}
const sameBytes = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
/** True if `file` is a well-formed unencrypted Ed25519 key file whose public key matches its seed. */
export function validate(file) {
    try {
        const lines = file.split("\n");
        if (lines.pop() !== "")
            return false; // ends with a newline
        if (lines[0] !== ARMOR_BEGIN || lines[lines.length - 1] !== ARMOR_END)
            return false;
        const body = lines.slice(1, -1);
        if (body.length === 0)
            return false;
        if (body.some((l, i) => !/^[A-Za-z0-9+/=]+$/.test(l) || (i < body.length - 1 && l.length !== LINE_WIDTH))) {
            return false;
        }
        const binary = new Uint8Array(Buffer.from(body.join(""), "base64"));
        const reader = new Reader(binary);
        if (!sameBytes(reader.take(MAGIC.length), encoder.encode(MAGIC)))
            return false;
        if (!sameBytes(reader.string(), encoder.encode("none")))
            return false;
        if (!sameBytes(reader.string(), encoder.encode("none")))
            return false;
        if (reader.string().length !== 0)
            return false;
        if (reader.u32() !== 1)
            return false;
        const blob = new Reader(reader.string());
        if (!sameBytes(blob.string(), encoder.encode(KEY_TYPE)))
            return false;
        const publicKey = blob.string();
        if (blob.remaining !== 0 || publicKey.length !== PUBLIC_LENGTH)
            return false;
        const sectionBytes = reader.string();
        if (reader.remaining !== 0 || sectionBytes.length % BLOCK !== 0)
            return false;
        const section = new Reader(sectionBytes);
        if (!sameBytes(section.take(4), section.take(4)))
            return false;
        if (!sameBytes(section.string(), encoder.encode(KEY_TYPE)))
            return false;
        if (!sameBytes(section.string(), publicKey))
            return false;
        const secret = section.string();
        if (secret.length !== SEED_LENGTH + PUBLIC_LENGTH)
            return false;
        const seed = secret.subarray(0, SEED_LENGTH);
        if (!sameBytes(secret.subarray(SEED_LENGTH), publicKey))
            return false;
        section.string(); // comment
        const padding = section.take(section.remaining);
        if (padding.length >= BLOCK || !padding.every((v, i) => v === i + 1))
            return false;
        return sameBytes(publicKeyOf(seed), publicKey);
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=ssh.js.map