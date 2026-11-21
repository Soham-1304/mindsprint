/** Thrown inside the normaliser only, and always caught by normaliseTrace. Never carries record text. */
export class TraceFailure extends Error {
    code;
    record;
    constructor(code, record) {
        super(`record ${record}: ${code}`);
        this.code = code;
        this.record = record;
        this.name = "TraceFailure";
    }
}
//# sourceMappingURL=errors.js.map