export interface ParsedRecord {
    readonly tgid: number;
    readonly kind: "E" | "X";
    readonly syscall: string;
    /** Text between "name(" and the closing ")". Contains attacker data. */
    readonly args: string;
    /** Exit records only: the return value. Errors have ret < 0. */
    readonly ret: number | null;
}
export declare function parseRecord(body: string, line: number): ParsedRecord;
//# sourceMappingURL=record.d.ts.map