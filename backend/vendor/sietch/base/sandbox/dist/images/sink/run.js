import { readSinkConfig, readSinkStdin, SinkStartError } from "./config.js";
import { createRecorder } from "./recorder.js";
import { SinkBindError, startSinkServers } from "./servers.js";
/**
 * The sink's start-up and shutdown with everything outside injected, so a test can run it on loopback ports.
 * `main.ts` wires the real process around it.
 *
 * Exit codes: 64 for a bad start-up input, 70 if a port cannot be bound (gVisor ignores the low-port sysctl, so
 * a bind failure must stop the sink: design decision 2). Both happen before any record is written.
 */
export const EXIT_BAD_INPUT = 64;
export const EXIT_BIND_FAILED = 70;
export const EXIT_INTERNAL = 1;
export async function runSink(deps) {
    const recorder = createRecorder({
        write: deps.write,
        now: deps.now,
        ...(deps.recorderLimits ?? {}),
    });
    try {
        const config = readSinkConfig(await readSinkStdin(deps.stdin), deps.caDeps);
        const servers = await startSinkServers({
            recorder,
            issuer: config.issuer,
            address: config.address,
            bindAddress: deps.bindAddress,
            ports: deps.ports,
            ...(deps.limits ?? {}),
        });
        return {
            ok: true,
            servers,
            recorder,
            async stop() {
                await servers.close();
                recorder.end();
            },
        };
    }
    catch (error) {
        // Fixed text only: nothing from the input, and nothing about the key.
        if (error instanceof SinkBindError) {
            return { ok: false, exitCode: EXIT_BIND_FAILED, message: "sink: a port could not be bound" };
        }
        if (error instanceof SinkStartError) {
            return { ok: false, exitCode: EXIT_BAD_INPUT, message: "sink: the start-up input is not valid" };
        }
        return { ok: false, exitCode: EXIT_BAD_INPUT, message: "sink: could not start" };
    }
}
//# sourceMappingURL=run.js.map