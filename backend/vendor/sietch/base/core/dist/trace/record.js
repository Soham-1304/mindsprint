// Stage 2: split one strace message into its fixed parts. The process name and the arguments can
// hold attacker text, so the fixed parts are found from the start (pid prefix) and from the end
// (result suffix), and anything that could be read two ways fails (AMBIGUOUS_RECORD).
import { TraceFailure } from "./errors.js";
import { isDigits } from "./frame.js";
const MAX_PID = 2 ** 31 - 1;
const COMM_WINDOW = 16;
const isSyscallChar = (c) => (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 95;
export function parseRecord(body, line) {
    // "[  13:  13] "
    if (!body.startsWith("["))
        throw new TraceFailure("MALFORMED_RECORD", line);
    const close = body.indexOf("] ");
    if (close < 0 || close > 32)
        throw new TraceFailure("MALFORMED_RECORD", line);
    const ids = body.slice(1, close).split(":");
    if (ids.length !== 2)
        throw new TraceFailure("MALFORMED_RECORD", line);
    const tgidText = (ids[0] ?? "").trim();
    const tidText = (ids[1] ?? "").trim();
    if (!isDigits(tgidText) || !isDigits(tidText) || tgidText.length > 10)
        throw new TraceFailure("MALFORMED_RECORD", line);
    const tgid = Number(tgidText);
    if (tgid > MAX_PID)
        throw new TraceFailure("MALFORMED_RECORD", line);
    // "<comm> X name(" : the marker must be at exactly one offset in the comm window.
    const start = close + 2;
    const hits = [];
    for (let o = 1; o <= COMM_WINDOW; o++) {
        const at = start + o;
        if (body[at] !== " " || (body[at + 1] !== "E" && body[at + 1] !== "X") || body[at + 2] !== " ")
            continue;
        let end = at + 3;
        while (end < body.length && isSyscallChar(body.charCodeAt(end)))
            end++;
        if (end > at + 3 && body[end] === "(")
            hits.push({ kind: body[at + 1], nameStart: at + 3, nameEnd: end });
    }
    if (hits.length !== 1)
        throw new TraceFailure(hits.length === 0 ? "MALFORMED_RECORD" : "AMBIGUOUS_RECORD", line);
    const hit = hits[0];
    const syscall = body.slice(hit.nameStart, hit.nameEnd);
    const rest = body.slice(hit.nameEnd + 1);
    if (hit.kind === "E") {
        if (!rest.endsWith(")"))
            throw new TraceFailure("MALFORMED_RECORD", line);
        return { tgid, kind: "E", syscall, args: rest.slice(0, -1), ret: null };
    }
    const suffix = parseResultSuffix(rest);
    if (suffix === null)
        throw new TraceFailure("MALFORMED_RECORD", line);
    return { tgid, kind: "X", syscall, args: rest.slice(0, suffix.argsEnd), ret: suffix.ret };
}
/**
 * Parse ") = <ret> (0x<hex>) (<duration>)" or ") = -1 errno=<n> (<text>) (<duration>)" from the end.
 * Returns where the arguments end and the return value, or null.
 */
function parseResultSuffix(rest) {
    if (!rest.endsWith(")"))
        return null;
    const durOpen = rest.lastIndexOf(" (");
    if (durOpen < 0 || !isDuration(rest.slice(durOpen + 2, -1)))
        return null;
    let head = rest.slice(0, durOpen); // "...) = 3 (0x3)" or "...) = -1 errno=2 (no such file)"
    if (!head.endsWith(")"))
        return null;
    const detailOpen = head.lastIndexOf(" (");
    if (detailOpen < 0)
        return null;
    const detail = head.slice(detailOpen + 2, -1);
    head = head.slice(0, detailOpen);
    let isError = false;
    if (head.endsWith(")") === false && /^0x[0-9a-f]+$/.test(detail)) {
        // success form: head ends with ") = <ret>"
    }
    else {
        // error form: head ends with ") = -1 errno=<n>"; detail is free text without parentheses
        if (detail.includes("(") || detail.includes(")"))
            return null;
        const errAt = head.lastIndexOf(" errno=");
        if (errAt < 0 || !isDigits(head.slice(errAt + 7)))
            return null;
        head = head.slice(0, errAt);
        isError = true;
    }
    const eq = head.lastIndexOf(") = ");
    if (eq < 0)
        return null;
    const retText = head.slice(eq + 4);
    const negative = retText.startsWith("-");
    if (!isDigits(negative ? retText.slice(1) : retText) || retText.length > 20)
        return null;
    const ret = Number(retText);
    if (isError && ret >= 0)
        return null;
    return { argsEnd: eq, ret };
}
function isDuration(s) {
    if (s.length === 0 || s.length > 32)
        return false;
    for (const ch of s)
        if (!"0123456789.hmsnµu".includes(ch))
            return false;
    return true;
}
//# sourceMappingURL=record.js.map