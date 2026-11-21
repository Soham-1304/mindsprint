import { z } from "zod";
export declare const FILE_WRITE_OPS: readonly ["create", "write", "truncate", "delete", "rename", "chmod", "mkdir", "symlink", "hardlink"];
export declare const eventSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    seq: z.ZodInt;
    t: z.ZodNumber;
    phase: z.ZodEnum<{
        install: "install";
        linger: "linger";
        load: "load";
    }>;
    pid: z.ZodInt;
    ppid: z.ZodInt;
    type: z.ZodLiteral<"exec">;
    path: z.ZodString;
    argv: z.ZodArray<z.ZodString>;
    argvTruncated: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strict>, z.ZodObject<{
    seq: z.ZodInt;
    t: z.ZodNumber;
    phase: z.ZodEnum<{
        install: "install";
        linger: "linger";
        load: "load";
    }>;
    pid: z.ZodInt;
    ppid: z.ZodInt;
    type: z.ZodLiteral<"file_read">;
    path: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    seq: z.ZodInt;
    t: z.ZodNumber;
    phase: z.ZodEnum<{
        install: "install";
        linger: "linger";
        load: "load";
    }>;
    pid: z.ZodInt;
    ppid: z.ZodInt;
    type: z.ZodLiteral<"file_write">;
    op: z.ZodEnum<{
        chmod: "chmod";
        create: "create";
        delete: "delete";
        hardlink: "hardlink";
        mkdir: "mkdir";
        rename: "rename";
        symlink: "symlink";
        truncate: "truncate";
        write: "write";
    }>;
    path: z.ZodString;
    target: z.ZodOptional<z.ZodString>;
}, z.core.$strict>, z.ZodObject<{
    seq: z.ZodInt;
    t: z.ZodNumber;
    phase: z.ZodEnum<{
        install: "install";
        linger: "linger";
        load: "load";
    }>;
    pid: z.ZodInt;
    ppid: z.ZodInt;
    type: z.ZodLiteral<"connect">;
    protocol: z.ZodEnum<{
        tcp: "tcp";
        udp: "udp";
    }>;
    address: z.ZodNullable<z.ZodString>;
    port: z.ZodInt;
}, z.core.$strict>, z.ZodObject<{
    seq: z.ZodInt;
    t: z.ZodNumber;
    phase: z.ZodEnum<{
        install: "install";
        linger: "linger";
        load: "load";
    }>;
    pid: z.ZodInt;
    ppid: z.ZodInt;
    type: z.ZodLiteral<"exit">;
    code: z.ZodNullable<z.ZodInt>;
    signal: z.ZodNullable<z.ZodString>;
}, z.core.$strict>, z.ZodObject<{
    seq: z.ZodInt;
    t: z.ZodNumber;
    phase: z.ZodEnum<{
        install: "install";
        linger: "linger";
        load: "load";
    }>;
    type: z.ZodLiteral<"dns">;
    name: z.ZodString;
    qtype: z.ZodString;
}, z.core.$strict>, z.ZodObject<{
    seq: z.ZodInt;
    t: z.ZodNumber;
    phase: z.ZodEnum<{
        install: "install";
        linger: "linger";
        load: "load";
    }>;
    type: z.ZodLiteral<"http">;
    method: z.ZodString;
    scheme: z.ZodEnum<{
        http: "http";
        https: "https";
    }>;
    host: z.ZodString;
    path: z.ZodString;
    headers: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>>;
    body: z.ZodString;
    bodyTruncated: z.ZodBoolean;
}, z.core.$strict>], "type">;
export declare const HONEYTOKEN_KINDS: readonly ["npm", "github", "aws-access-key", "aws-secret-key", "gcp", "ssh-key", "env", "generic"];
export declare const scanInputSchema: z.ZodObject<{
    package: z.ZodObject<{
        name: z.ZodString;
        version: z.ZodString;
        integrity: z.ZodString;
    }, z.core.$strict>;
    environment: z.ZodObject<{
        home: z.ZodString;
        projectDir: z.ZodString;
        nodeModulesDir: z.ZodString;
        tmpDirs: z.ZodArray<z.ZodString>;
        packageManagerPid: z.ZodInt;
        sinkAddresses: z.ZodArray<z.ZodString>;
        extraCredentialPaths: z.ZodArray<z.ZodString>;
    }, z.core.$strict>;
    allowlist: z.ZodArray<z.ZodString>;
    honeytokens: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        kind: z.ZodEnum<{
            "aws-access-key": "aws-access-key";
            "aws-secret-key": "aws-secret-key";
            env: "env";
            gcp: "gcp";
            generic: "generic";
            github: "github";
            npm: "npm";
            "ssh-key": "ssh-key";
        }>;
        value: z.ZodString;
    }, z.core.$strict>>;
    events: z.ZodArray<z.ZodDiscriminatedUnion<[z.ZodObject<{
        seq: z.ZodInt;
        t: z.ZodNumber;
        phase: z.ZodEnum<{
            install: "install";
            linger: "linger";
            load: "load";
        }>;
        pid: z.ZodInt;
        ppid: z.ZodInt;
        type: z.ZodLiteral<"exec">;
        path: z.ZodString;
        argv: z.ZodArray<z.ZodString>;
        argvTruncated: z.ZodOptional<z.ZodBoolean>;
    }, z.core.$strict>, z.ZodObject<{
        seq: z.ZodInt;
        t: z.ZodNumber;
        phase: z.ZodEnum<{
            install: "install";
            linger: "linger";
            load: "load";
        }>;
        pid: z.ZodInt;
        ppid: z.ZodInt;
        type: z.ZodLiteral<"file_read">;
        path: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        seq: z.ZodInt;
        t: z.ZodNumber;
        phase: z.ZodEnum<{
            install: "install";
            linger: "linger";
            load: "load";
        }>;
        pid: z.ZodInt;
        ppid: z.ZodInt;
        type: z.ZodLiteral<"file_write">;
        op: z.ZodEnum<{
            chmod: "chmod";
            create: "create";
            delete: "delete";
            hardlink: "hardlink";
            mkdir: "mkdir";
            rename: "rename";
            symlink: "symlink";
            truncate: "truncate";
            write: "write";
        }>;
        path: z.ZodString;
        target: z.ZodOptional<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        seq: z.ZodInt;
        t: z.ZodNumber;
        phase: z.ZodEnum<{
            install: "install";
            linger: "linger";
            load: "load";
        }>;
        pid: z.ZodInt;
        ppid: z.ZodInt;
        type: z.ZodLiteral<"connect">;
        protocol: z.ZodEnum<{
            tcp: "tcp";
            udp: "udp";
        }>;
        address: z.ZodNullable<z.ZodString>;
        port: z.ZodInt;
    }, z.core.$strict>, z.ZodObject<{
        seq: z.ZodInt;
        t: z.ZodNumber;
        phase: z.ZodEnum<{
            install: "install";
            linger: "linger";
            load: "load";
        }>;
        pid: z.ZodInt;
        ppid: z.ZodInt;
        type: z.ZodLiteral<"exit">;
        code: z.ZodNullable<z.ZodInt>;
        signal: z.ZodNullable<z.ZodString>;
    }, z.core.$strict>, z.ZodObject<{
        seq: z.ZodInt;
        t: z.ZodNumber;
        phase: z.ZodEnum<{
            install: "install";
            linger: "linger";
            load: "load";
        }>;
        type: z.ZodLiteral<"dns">;
        name: z.ZodString;
        qtype: z.ZodString;
    }, z.core.$strict>, z.ZodObject<{
        seq: z.ZodInt;
        t: z.ZodNumber;
        phase: z.ZodEnum<{
            install: "install";
            linger: "linger";
            load: "load";
        }>;
        type: z.ZodLiteral<"http">;
        method: z.ZodString;
        scheme: z.ZodEnum<{
            http: "http";
            https: "https";
        }>;
        host: z.ZodString;
        path: z.ZodString;
        headers: z.ZodArray<z.ZodTuple<[z.ZodString, z.ZodString], null>>;
        body: z.ZodString;
        bodyTruncated: z.ZodBoolean;
    }, z.core.$strict>], "type">>;
    eventsTruncated: z.ZodBoolean;
}, z.core.$strict>;
export type Event = z.infer<typeof eventSchema>;
export type EventType = Event["type"];
export type ExecEvent = Extract<Event, {
    type: "exec";
}>;
export type FileWriteEvent = Extract<Event, {
    type: "file_write";
}>;
export type HttpEvent = Extract<Event, {
    type: "http";
}>;
export type DnsEvent = Extract<Event, {
    type: "dns";
}>;
export type ConnectEvent = Extract<Event, {
    type: "connect";
}>;
export type ProcessEvent = Extract<Event, {
    pid: number;
}>;
export type ScanInput = z.infer<typeof scanInputSchema>;
export type HoneytokenKind = (typeof HONEYTOKEN_KINDS)[number];
export type ValidationResult = {
    ok: true;
    value: ScanInput;
} | {
    ok: false;
    reason: string;
};
/**
 * Validate an untrusted value as a ScanInput. The failure reason is built only from field paths
 * and issue codes, never from the rejected values or zod's messages, which can contain
 * attacker-chosen text.
 */
export declare function validateScanInput(input: unknown): ValidationResult;
//# sourceMappingURL=schema.d.ts.map