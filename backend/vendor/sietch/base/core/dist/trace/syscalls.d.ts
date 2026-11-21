import type { FILE_WRITE_OPS } from "../schema.js";
import type { ParsedRecord } from "./record.js";
export type Action = {
    kind: "exec";
    path: string;
    relative: boolean;
    argv: string[];
    argvTruncated: boolean;
} | {
    kind: "chdir";
    path: string | null;
} | {
    kind: "read";
    path: string;
} | {
    kind: "write";
    op: (typeof FILE_WRITE_OPS)[number];
    path: string;
    target?: string;
} | {
    kind: "connect";
    address: string | null;
    port: number;
    protocol: "tcp" | "udp";
} | {
    kind: "clone";
    child: number;
    thread: boolean;
} | {
    kind: "exit";
    pid: number;
    code: number | null;
} | {
    kind: "none";
};
/**
 * The working directory gVisor printed for this record, or null. Only read from the leading dirfd
 * of a syscall that has one: never from other arguments, which can hold attacker text such as an
 * execve path "/opt/AT_FDCWD /evil" (review TN-1). Call this only after actionOf succeeded, so
 * the split was already proved unambiguous.
 */
export declare function cwdOf(r: ParsedRecord): string | null;
/**
 * Syscalls the sandbox traces (so a record exists) that this stage has no parser for yet. Each one opens,
 * creates, or makes a file, so ignoring the record would hide a file operation from every rule. A record
 * of one of them fails the trace instead (fail closed) until a parser is written. Keep this in step with
 * the names in `base/sandbox/src/syscalls-*.ts` that `actionOf` has no case for.
 */
export declare const UNPARSED_TRACED_SYSCALLS: ReadonlySet<string>;
export declare function actionOf(r: ParsedRecord, line: number): Action;
//# sourceMappingURL=syscalls.d.ts.map