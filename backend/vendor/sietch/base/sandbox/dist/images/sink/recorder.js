import { MAX_SINK_TOTAL_BYTES } from "../../limits.js";
import { encodeSinkRecord, MAX_SINK_RECORDS, MAX_SINK_TS_MS, SinkRecordError } from "../../sink/records.js";
/**
 * Turns record drafts into JSON lines on the sink's stdout, with the caps the runner enforces (design D6).
 * Time and output are injected.
 *
 * The runner refuses a stream that is over `MAX_SINK_TOTAL_BYTES` or `MAX_SINK_RECORDS`, or that has no
 * end record. So when a record would not fit, the recorder enters `overflow` and writes nothing more,
 * not even the end record: the runner then reports `SINK_LOST` and the scan fails closed, which is
 * honest. A record the schema refuses (it should not happen, the parsers keep inside the caps) does the same.
 * Room for the end record is always kept back.
 */
/** A generous upper bound for the end record's line: `{"type":"end","count":50000}` plus a newline. */
const END_RECORD_RESERVE_BYTES = 40;
export function createRecorder(options) {
    const maxRecords = Math.min(options.maxRecords ?? MAX_SINK_RECORDS, MAX_SINK_RECORDS);
    const maxBytes = Math.min(options.maxBytes ?? MAX_SINK_TOTAL_BYTES, MAX_SINK_TOTAL_BYTES);
    let count = 0;
    let bytes = 0;
    let overflowed = false;
    let ended = false;
    const timestamp = () => {
        const now = options.now();
        return Number.isFinite(now) ? Math.min(Math.max(0, Math.floor(now)), MAX_SINK_TS_MS) : 0;
    };
    return {
        record(draft) {
            if (overflowed || ended)
                return false;
            if (count >= maxRecords) {
                overflowed = true;
                return false;
            }
            let line;
            try {
                line = encodeSinkRecord({ ...draft, ts: timestamp() });
            }
            catch (error) {
                if (!(error instanceof SinkRecordError))
                    throw error;
                overflowed = true;
                return false;
            }
            const size = Buffer.byteLength(line, "utf8");
            if (bytes + size + END_RECORD_RESERVE_BYTES > maxBytes) {
                overflowed = true;
                return false;
            }
            options.write(line);
            count++;
            bytes += size;
            return true;
        },
        end() {
            if (overflowed || ended)
                return false;
            ended = true;
            options.write(encodeSinkRecord({ type: "end", count }));
            return true;
        },
        fail() {
            overflowed = true;
        },
        get overflowed() {
            return overflowed;
        },
        get count() {
            return count;
        },
        get bytes() {
            return bytes;
        },
    };
}
//# sourceMappingURL=recorder.js.map