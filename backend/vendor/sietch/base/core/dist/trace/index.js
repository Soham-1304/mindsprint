// normaliseTrace: gVisor JSON strace log -> rules-engine events. Pure, never throws.
// Design: .kiro/specs/trace-normaliser/design.md.
import { MAX_EVENTS } from "../limits.js";
import { joinPath } from "../paths.js";
import { TraceFailure } from "./errors.js";
import { frameLog } from "./frame.js";
import { parseRecord } from "./record.js";
import { actionOf, cwdOf } from "./syscalls.js";
export function normaliseTrace(log, layout) {
    try {
        return run(log, layout);
    }
    catch (error) {
        if (error instanceof TraceFailure)
            return { ok: false, code: error.code, reason: error.message };
        return {
            ok: false,
            code: "INTERNAL",
            reason: `internal error (${error instanceof Error ? error.name : "unknown"})`,
        };
    }
}
function run(log, layout) {
    const traced = new Set(layout.tracedSyscalls);
    const records = frameLog(log);
    const procs = new Map();
    const proc = (pid) => {
        let p = procs.get(pid);
        if (p === undefined) {
            // Never seen created: the init process is the runner's; anything else is kept (fail closed).
            p = {
                role: pid === layout.initPid ? "runner" : "unknown",
                direct: false,
                execed: false,
                ppid: 0,
                cwd: null,
                exited: false,
            };
            procs.set(pid, p);
        }
        return p;
    };
    let installPid = null;
    let loadPid = null;
    let installDone = false;
    let loadDone = false;
    const phase = () => (!installDone ? "install" : !loadDone ? "load" : "linger");
    const events = [];
    let truncated = false;
    const firstTime = records[0]?.timeMs ?? 0;
    for (const rec of records) {
        const r = parseRecord(rec.body, rec.line);
        if (!traced.has(r.syscall))
            throw new TraceFailure("UNEXPECTED_SYSCALL", rec.line);
        const self = proc(r.tgid);
        const action = actionOf(r, rec.line); // throws on any ambiguous split, before cwd is read
        const cwd = cwdOf(r);
        if (cwd !== null)
            self.cwd = cwd; // the real working directory gVisor printed for this call
        const t = Math.max(0, rec.timeMs - firstTime); // t is informational; rules order by seq
        const emit = (pid, event) => {
            const p = proc(pid);
            if (p.role === "runner")
                return;
            if (events.length >= MAX_EVENTS) {
                truncated = true;
                return;
            }
            events.push({ ...event, seq: events.length + 1, t, phase: phase(), pid, ppid: p.ppid });
        };
        switch (action.kind) {
            case "clone": {
                if (action.thread)
                    break;
                // A direct child of init is a runner process until its first execve names a marker (D13).
                // Everything else inherits the caller's role, so CLONE_PARENT from package code stays put.
                const direct = r.tgid === layout.initPid;
                const role = direct ? "runner" : self.role;
                // A new lifetime, even if the pid was used before (PID reuse).
                procs.set(action.child, { role, direct, execed: false, ppid: r.tgid, cwd: self.cwd, exited: false });
                break;
            }
            case "exit": {
                const p = proc(action.pid);
                if (p.exited)
                    break;
                emit(action.pid, { type: "exit", code: action.code, signal: null });
                p.exited = true;
                if (action.pid === installPid)
                    installDone = true;
                if (action.pid === loadPid)
                    loadDone = true;
                break;
            }
            case "chdir":
                // fchdir and unknown starting points make the directory unknown until gVisor prints it again.
                if (action.path === null)
                    self.cwd = null;
                else if (action.path.startsWith("/"))
                    self.cwd = action.path;
                else
                    self.cwd = self.cwd === null ? null : joinPath(self.cwd, action.path);
                break;
            case "exec": {
                let path = action.path;
                if (action.relative) {
                    if (self.cwd === null)
                        throw new TraceFailure("UNRESOLVED_PATH", rec.line);
                    path = `${self.cwd.replace(/\/+$/, "")}/${path}`;
                }
                if (self.direct && !self.execed) {
                    // The first successful execve of a direct child decides its role; later ones never do.
                    self.execed = true;
                    if (path === layout.installExec) {
                        if (installPid !== null)
                            throw new TraceFailure("AMBIGUOUS_RECORD", rec.line);
                        installPid = r.tgid;
                        self.role = "install";
                    }
                    else if (path === layout.loadExec) {
                        if (loadPid !== null)
                            throw new TraceFailure("AMBIGUOUS_RECORD", rec.line);
                        loadPid = r.tgid;
                        self.role = "load";
                    }
                }
                emit(r.tgid, {
                    type: "exec",
                    path,
                    argv: action.argv,
                    ...(action.argvTruncated ? { argvTruncated: true } : {}),
                });
                break;
            }
            case "read":
                emit(r.tgid, { type: "file_read", path: action.path });
                break;
            case "write":
                emit(r.tgid, action.target === undefined
                    ? { type: "file_write", op: action.op, path: action.path }
                    : { type: "file_write", op: action.op, path: action.path, target: action.target });
                break;
            case "connect":
                emit(r.tgid, {
                    type: "connect",
                    protocol: action.protocol,
                    address: action.address,
                    port: action.port,
                });
                break;
            case "none":
                break;
            default: {
                const unreachable = action;
                throw new TraceFailure("INTERNAL", rec.line + (unreachable === undefined ? 0 : 0));
            }
        }
    }
    if (installPid === null || loadPid === null)
        throw new TraceFailure("MISSING_PHASE", 0);
    return { ok: true, events, packageManagerPid: installPid, eventsTruncated: truncated, originMs: firstTime };
}
//# sourceMappingURL=index.js.map