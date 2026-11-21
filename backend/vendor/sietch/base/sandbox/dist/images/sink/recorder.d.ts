import type { SinkRecordDraft } from "./dns-responder.js";
export interface RecorderOptions {
    /** Receives one complete JSON line (with its newline). */
    readonly write: (line: string) => void;
    /** Wall-clock milliseconds. */
    readonly now: () => number;
    readonly maxRecords?: number;
    readonly maxBytes?: number;
}
export interface Recorder {
    /** Timestamps and writes a record. Returns false (and enters overflow) if it was not written. */
    record(draft: SinkRecordDraft): boolean;
    /** Writes the end record. Returns false, and writes nothing, if the recorder overflowed. */
    end(): boolean;
    /** Marks the recording as lost without writing: the end record will not be written. */
    fail(): void;
    readonly overflowed: boolean;
    readonly count: number;
    readonly bytes: number;
}
export declare function createRecorder(options: RecorderOptions): Recorder;
//# sourceMappingURL=recorder.d.ts.map