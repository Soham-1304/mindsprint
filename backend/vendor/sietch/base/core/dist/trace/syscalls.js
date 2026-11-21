// Stage 3: per-syscall argument parsers. Attacker strings (paths, link targets, directory names)
// are printed unquoted, so every split on a fixed separator must be the only possible one.
import { MAX_ARG, MAX_ARGV } from "../limits.js";
import { joinPath, segments } from "../paths.js";
import { TraceFailure } from "./errors.js";
const AT_FDCWD_HEX = "0xffffffffffffff9c";
const fail = (code, line) => {
    throw new TraceFailure(code, line);
};
const isHex = (s) => /^0x[0-9a-f]{1,16}$/.test(s);
/** Start indices of every ", 0x<hex> " in text (the separator gVisor puts before a string argument). */
function stringSeparators(text) {
    const out = [];
    let at = text.indexOf(", 0x");
    while (at >= 0) {
        let i = at + 4;
        while (i < text.length && /[0-9a-f]/.test(text[i] ?? ""))
            i++;
        if (i > at + 4 && text[i] === " ")
            out.push({ start: at, end: i + 1 });
        at = text.indexOf(", 0x", at + 1);
    }
    return out;
}
/** Remove a trailing ", <token>" where token matches `ok`. */
function stripTail(text, ok, line) {
    const at = text.lastIndexOf(", ");
    if (at < 0)
        return fail("MALFORMED_RECORD", line);
    const token = text.slice(at + 2);
    if (!ok(token))
        return fail("MALFORMED_RECORD", line);
    return { head: text.slice(0, at), token };
}
/** "<DIRFD> <CWD>" before the first string separator, resolved to a directory or null. */
function dirOf(prefix) {
    if (prefix.startsWith("AT_FDCWD ")) {
        const cwd = prefix.slice(9);
        return cwd.startsWith("/") ? cwd : null;
    }
    return null; // another dirfd: only absolute paths can be used
}
function absolute(path, dir, line) {
    if (path.startsWith("/"))
        return path;
    if (dir === null)
        return fail("UNRESOLVED_PATH", line);
    return `${dir.replace(/\/+$/, "")}/${path}`;
}
/** "<DIRFD> <CWD>, 0x<a> <PATH>" with exactly one separator. */
function dirAndPath(text, line) {
    const seps = stringSeparators(text);
    if (seps.length !== 1)
        return fail("AMBIGUOUS_RECORD", line);
    const sep = seps[0];
    return absolute(text.slice(sep.end), dirOf(text.slice(0, sep.start)), line);
}
/** Two paths: "<DIRFD> <CWD>, 0x<a> OLD, 0x<newdirfd>, 0x<a> NEW". */
function twoPaths(text, line) {
    const seps = stringSeparators(text);
    if (seps.length !== 2)
        return fail("AMBIGUOUS_RECORD", line);
    const [s1, s2] = seps;
    const middle = text.slice(s1.end, s2.start); // "OLD, 0x<newdirfd>"
    const nd = middle.lastIndexOf(", 0x");
    if (nd < 0 || !isHex(middle.slice(nd + 2)))
        return fail("MALFORMED_RECORD", line);
    const dir = dirOf(text.slice(0, s1.start));
    const from = absolute(middle.slice(0, nd), dir, line);
    const newDirFd = middle.slice(nd + 2);
    const to = absolute(text.slice(s2.end), newDirFd === AT_FDCWD_HEX ? dir : null, line);
    return { from, to };
}
const OCTAL_MODE = /^0o[0-7]{1,7}$/;
const HEX_REMAINDER = /^0x[0-9a-f]{1,8}$/;
/**
 * The mode names gVisor prints in front of the octal permission bits (pkg/abi/linux/file.go: `fileType` and
 * `modeExtraBits`). Its spelling of the symlink type is `S_IFLINK`, not Linux's `S_IFLNK`.
 */
const MODE_NAMES = new Set([
    "S_IFREG",
    "S_IFCHR",
    "S_IFDIR",
    "S_IFBLK",
    "S_IFIFO",
    "S_IFLINK",
    "S_IFSOCK",
    "S_ISUID",
    "S_ISGID",
    "S_ISVTX",
]);
/**
 * The last argument of openat. With O_CREAT it is the real mode (`0o644`). Without it the argument is
 * whatever was left in the register, and gVisor decodes it anyway: `S_IFREG|S_ISUID|0o400`, or
 * `0x5000|S_ISUID|0o400` when the type bits are not a known type. So the token is a `|`-joined list of
 * known mode names (each at most once), at most one hex remainder (at most 8 digits), and then the octal
 * permissions. Anything else, including spaces and commas, stays malformed. The token never decides read
 * versus write: only the O_ flags do.
 */
const isMode = (t) => {
    const parts = t.split("|");
    if (parts.length > MODE_NAMES.size + 2)
        return false;
    const last = parts.pop();
    if (!OCTAL_MODE.test(last))
        return false;
    const seen = new Set();
    let hex = 0;
    for (const part of parts) {
        if (HEX_REMAINDER.test(part)) {
            hex += 1;
            if (hex > 1)
                return false;
        }
        else if (MODE_NAMES.has(part) && !seen.has(part))
            seen.add(part);
        else
            return false;
    }
    return true;
};
const isFlagToken = (t) => t.length <= 256 && /^[A-Z0-9_|x]+$/.test(t);
function openFlags(token) {
    let bits = 0;
    const names = new Set();
    for (const part of token.split("|")) {
        if (isHex(part))
            bits |= Number.parseInt(part.slice(2), 16);
        else
            names.add(part);
    }
    const write = names.has("O_WRONLY") || names.has("O_RDWR") || (bits & 3) !== 0;
    return {
        write,
        creat: names.has("O_CREAT") || (bits & 0x40) !== 0,
        trunc: names.has("O_TRUNC") || (bits & 0x200) !== 0,
    };
}
const ESCAPES = {
    n: "\n",
    t: "\t",
    r: "\r",
    a: "\x07",
    b: "\b",
    f: "\f",
    v: "\v",
    "\\": "\\",
    '"': '"',
    "'": "'",
};
/** Parse a Go-quoted string starting at text[i] === '"'. Returns the value and the index after it. */
function quoted(text, i) {
    if (text[i] !== '"')
        return null;
    let out = "";
    let j = i + 1;
    while (j < text.length) {
        const c = text[j];
        if (c === '"')
            return { value: out, end: j + 1 };
        if (c !== "\\") {
            out += c;
            j++;
            continue;
        }
        const e = text[j + 1];
        if (e === undefined)
            return null;
        if (e in ESCAPES) {
            out += ESCAPES[e];
            j += 2;
        }
        else if (e === "x" && /^[0-9a-fA-F]{2}$/.test(text.slice(j + 2, j + 4))) {
            out += String.fromCharCode(Number.parseInt(text.slice(j + 2, j + 4), 16));
            j += 4;
        }
        else if (/^[0-7]{3}$/.test(text.slice(j + 1, j + 4))) {
            out += String.fromCharCode(Number.parseInt(text.slice(j + 1, j + 4), 8) & 0xff);
            j += 4;
        }
        else if ((e === "u" || e === "U") &&
            /^[0-9a-fA-F]+$/.test(text.slice(j + 2, j + (e === "u" ? 6 : 10)))) {
            const n = e === "u" ? 4 : 8;
            const cp = Number.parseInt(text.slice(j + 2, j + 2 + n), 16);
            if (cp > 0x10ffff)
                return null;
            out += String.fromCodePoint(cp);
            j += 2 + n;
        }
        else
            return null;
    }
    return null;
}
/** Parse `[` "a", "b" `]` starting at text[i] === '['. Returns the strings and the index after "]". */
function quotedList(text, i) {
    if (text[i] !== "[")
        return null;
    const values = [];
    let j = i + 1;
    if (text[j] === "]")
        return { values, end: j + 1 };
    for (;;) {
        const q = quoted(text, j);
        if (q === null)
            return null;
        values.push(q.value);
        j = q.end;
        if (text[j] === "]")
            return { values, end: j + 1 };
        if (text.slice(j, j + 2) !== ", ")
            return null;
        j += 2;
    }
}
/** "0x<a> PATH, 0x<a> [ARGV], 0x<a> [ENVP]" (envp discarded: it holds honeytokens). */
function execArgs(text, line) {
    const m = /^0x[0-9a-f]+ /.exec(text);
    if (m === null)
        return fail("MALFORMED_RECORD", line);
    const candidates = stringSeparators(text).filter((s) => text[s.end] === "[");
    if (candidates.length > 4)
        return fail("AMBIGUOUS_RECORD", line);
    const valid = [];
    for (const c of candidates) {
        const argv = quotedList(text, c.end);
        if (argv === null)
            continue;
        const rest = text.slice(argv.end);
        const envSep = /^, 0x[0-9a-f]+ /.exec(rest);
        if (envSep === null)
            continue;
        const env = quotedList(rest, envSep[0].length);
        if (env === null || env.end !== rest.length)
            continue;
        valid.push({ path: text.slice(m[0].length, c.start), argv: argv.values });
    }
    if (valid.length !== 1)
        return fail("AMBIGUOUS_RECORD", line);
    return valid[0];
}
function capArgv(argv) {
    let truncated = argv.length > MAX_ARGV;
    const out = argv.slice(0, MAX_ARGV).map((a) => {
        if (a.length <= MAX_ARG)
            return a;
        truncated = true;
        return a.slice(0, MAX_ARG);
    });
    return { argv: out, truncated };
}
const FAMILY = /^\{Family: (AF_INET6?), Addr: ([0-9a-fA-F:.]{1,64}), Port: (\d{1,5})\}/;
/** Turn one parsed record into an action. Unsuccessful calls produce nothing, except connect. */
/** Syscalls whose FIRST argument is a dirfd that gVisor prints as "AT_FDCWD <cwd>". */
const DIRFD_FIRST = new Set([
    "openat",
    "mkdirat",
    "unlinkat",
    "renameat",
    "renameat2",
    "linkat",
    "fchmodat",
    "execveat",
]);
/**
 * The working directory gVisor printed for this record, or null. Only read from the leading dirfd
 * of a syscall that has one: never from other arguments, which can hold attacker text such as an
 * execve path "/opt/AT_FDCWD /evil" (review TN-1). Call this only after actionOf succeeded, so
 * the split was already proved unambiguous.
 */
export function cwdOf(r) {
    if (r.kind !== "X" || r.ret === null || r.ret < 0 || !DIRFD_FIRST.has(r.syscall))
        return null;
    if (!r.args.startsWith("AT_FDCWD "))
        return null;
    const first = stringSeparators(r.args)[0];
    if (first === undefined)
        return null;
    const cwd = r.args.slice(9, first.start);
    return cwd.startsWith("/") ? cwd : null;
}
/**
 * Syscalls the sandbox traces (so a record exists) that this stage has no parser for yet. Each one opens,
 * creates, or makes a file, so ignoring the record would hide a file operation from every rule. A record
 * of one of them fails the trace instead (fail closed) until a parser is written. Keep this in step with
 * the names in `base/sandbox/src/syscalls-*.ts` that `actionOf` has no case for.
 */
export const UNPARSED_TRACED_SYSCALLS = new Set(["openat2", "mknodat", "mknod"]);
export function actionOf(r, line) {
    if (UNPARSED_TRACED_SYSCALLS.has(r.syscall))
        throw new TraceFailure("UNEXPECTED_SYSCALL", line);
    const ok = r.ret !== null && r.ret >= 0;
    const a = r.args;
    switch (r.syscall) {
        case "exit_group": {
            if (r.kind !== "E" || !isHex(a))
                return { kind: "none" };
            return { kind: "exit", pid: r.tgid, code: Number.parseInt(a.slice(2), 16) & 0xff };
        }
        case "wait4": {
            if (r.kind !== "X" || r.ret === null || r.ret <= 0)
                return { kind: "none" };
            return { kind: "exit", pid: r.ret, code: null };
        }
        case "clone":
        case "clone3": {
            if (r.kind !== "X" || r.ret === null || r.ret <= 0)
                return { kind: "none" };
            const flags = r.syscall === "clone" ? (a.split(", ")[0] ?? "") : a;
            const thread = flags.includes("CLONE_THREAD") ||
                (isHex(flags) && (Number.parseInt(flags.slice(2), 16) & 0x10000) !== 0);
            return { kind: "clone", child: r.ret, thread };
        }
        case "waitid":
        case "kill":
        case "tgkill":
            return { kind: "none" };
    }
    if (r.kind !== "X")
        return { kind: "none" };
    switch (r.syscall) {
        case "connect": {
            const brace = a.indexOf("{Family: ");
            if (brace < 0)
                return fail("MALFORMED_RECORD", line);
            if (a.startsWith("{Family: AF_UNIX", brace) || !a.startsWith("{Family: AF_INET", brace))
                return { kind: "none" };
            const m = FAMILY.exec(a.slice(brace));
            if (m === null)
                return fail("MALFORMED_RECORD", line);
            return { kind: "connect", address: m[2] ?? null, port: Number(m[3]), protocol: "tcp" };
        }
        case "sendmsg": {
            const m = /\{name=0x[0-9a-f]+, namelen=(\d{1,5}),/.exec(a.slice(0, 200));
            if (m === null)
                return fail("MALFORMED_RECORD", line);
            return Number(m[1]) > 0
                ? { kind: "connect", address: null, port: 0, protocol: "udp" }
                : { kind: "none" };
        }
        case "sendto": {
            const { token } = stripTail(a, isHex, line); // addrlen
            return Number.parseInt(token.slice(2), 16) > 0
                ? { kind: "connect", address: null, port: 0, protocol: "udp" }
                : { kind: "none" };
        }
    }
    if (!ok)
        return { kind: "none" };
    switch (r.syscall) {
        case "execve": {
            const { path, argv } = execArgs(a, line);
            const capped = capArgv(argv);
            return {
                kind: "exec",
                path,
                relative: !path.startsWith("/"),
                argv: capped.argv,
                argvTruncated: capped.truncated,
            };
        }
        case "execveat": {
            const flags = stripTail(a, isHex, line);
            const first = stringSeparators(flags.head)[0];
            if (first === undefined)
                return fail("MALFORMED_RECORD", line);
            const inner = execArgs(flags.head.slice(first.start + 2), line);
            const capped = capArgv(inner.argv);
            const dir = dirOf(flags.head.slice(0, first.start));
            return {
                kind: "exec",
                path: absolute(inner.path, dir, line),
                relative: false,
                argv: capped.argv,
                argvTruncated: capped.truncated,
            };
        }
        case "openat": {
            const mode = stripTail(a, isMode, line);
            const flags = stripTail(mode.head, isFlagToken, line);
            const path = dirAndPath(flags.head, line);
            const f = openFlags(flags.token);
            if (!f.write)
                return { kind: "read", path };
            return { kind: "write", op: f.trunc ? "truncate" : f.creat ? "create" : "write", path };
        }
        case "chdir": {
            const m = /^0x[0-9a-f]+ /.exec(a);
            if (m === null)
                return fail("MALFORMED_RECORD", line);
            return { kind: "chdir", path: a.slice(m[0].length) };
        }
        case "fchdir":
            return { kind: "chdir", path: null };
        case "mkdirat":
            return { kind: "write", op: "mkdir", path: dirAndPath(stripTail(a, isHex, line).head, line) };
        case "unlinkat":
            return { kind: "write", op: "delete", path: dirAndPath(stripTail(a, isHex, line).head, line) };
        case "fchmodat":
            return {
                kind: "write",
                op: "chmod",
                path: dirAndPath(stripTail(a, (t) => OCTAL_MODE.test(t), line).head, line),
            };
        case "renameat": {
            const p = twoPaths(a, line);
            return { kind: "write", op: "rename", path: p.from, target: p.to };
        }
        case "renameat2": {
            const p = twoPaths(stripTail(a, isHex, line).head, line);
            return { kind: "write", op: "rename", path: p.from, target: p.to };
        }
        case "linkat": {
            const p = twoPaths(stripTail(a, isHex, line).head, line);
            return { kind: "write", op: "hardlink", path: p.to, target: p.from };
        }
        case "symlinkat": {
            // "0x<a> TARGET, AT_FDCWD <CWD>, 0x<a> LINKPATH"
            const lead = /^0x[0-9a-f]+ /.exec(a);
            const markers = countOf(a, ", AT_FDCWD ");
            if (lead === null || markers !== 1)
                return fail("AMBIGUOUS_RECORD", line);
            const mk = a.indexOf(", AT_FDCWD ");
            const target = a.slice(lead[0].length, mk);
            const rest = a.slice(mk + 2);
            const link = dirAndPath(rest, line);
            const linkDir = `/${segments(link).slice(0, -1).join("/")}`;
            const resolved = target.startsWith("/") ? target : joinPath(linkDir, target);
            return { kind: "write", op: "symlink", path: link, target: resolved };
        }
    }
    return { kind: "none" };
}
function countOf(text, needle) {
    let n = 0;
    let at = text.indexOf(needle);
    while (at >= 0) {
        n++;
        at = text.indexOf(needle, at + 1);
    }
    return n;
}
//# sourceMappingURL=syscalls.js.map