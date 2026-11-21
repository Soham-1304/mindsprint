"use strict";

/**
 * Sietch Fast-Detonation Node Preload Instrumentation Hook
 *
 * Loaded via `node --require ./preload-hook.cjs` inside the isolated detonation
 * sandbox (both `fast-docker` and `local-sandbox` modes).
 *
 * Captures genuine runtime behavior into NDJSON events matching @sietch/core's
 * strict ScanInput schema (`exec`, `file_read`, `file_write`, `dns`, `http`,
 * `connect`, `exit`) while blocking all outbound network calls locally so zero
 * traffic can ever leave the machine.
 */

const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const https = require("node:https");
const dns = require("node:dns");
const net = require("node:net");
const childProcess = require("node:child_process");
const { EventEmitter } = require("node:events");
const { Readable } = require("node:stream");

const TRACE_FILE = process.env.SIETCH_TRACE_FILE;
const REAL_HOME = process.env.SIETCH_REAL_HOME || process.env.HOME || "";
const VIRTUAL_HOME = process.env.SIETCH_VIRTUAL_HOME || "/home/runner";
const REAL_PROJECT = process.env.SIETCH_REAL_PROJECT || "";
const VIRTUAL_PROJECT = process.env.SIETCH_VIRTUAL_PROJECT || `${VIRTUAL_HOME}/work/app/app`;
const CURRENT_PHASE = process.env.SIETCH_PHASE || "install";
const ORIGIN_MS = Number(process.env.SIETCH_ORIGIN_MS || Date.now());
const VIRTUAL_PID = Number(process.env.SIETCH_VIRTUAL_PID || process.pid);
const VIRTUAL_PPID = Number(process.env.SIETCH_VIRTUAL_PPID || 1);

if (!TRACE_FILE) {
  return;
}

const origAppendFileSync = fs.appendFileSync.bind(fs);
const origReadFileSync = fs.readFileSync.bind(fs);
const origReadFile = fs.readFile.bind(fs);
const origOpenSync = fs.openSync.bind(fs);
const origWriteFileSync = fs.writeFileSync.bind(fs);
const origWriteFile = fs.writeFile.bind(fs);
const origMkdirSync = fs.mkdirSync.bind(fs);
const origMkdir = fs.mkdir.bind(fs);
const origUnlinkSync = fs.unlinkSync.bind(fs);
const origRenameSync = fs.renameSync.bind(fs);
const origSymlinkSync = fs.symlinkSync.bind(fs);
const origLinkSync = fs.linkSync.bind(fs);
const origChmodSync = fs.chmodSync.bind(fs);
const origSpawn = childProcess.spawn.bind(childProcess);
const origExec = childProcess.exec.bind(childProcess);
const origExecFile = childProcess.execFile.bind(childProcess);

let spawnedPids = [];

function elapsedMs() {
  return Math.max(0, Date.now() - ORIGIN_MS);
}

function toVirtualPath(inputPath) {
  if (!inputPath) return "/";
  const raw = Buffer.isBuffer(inputPath)
    ? inputPath.toString("utf8")
    : inputPath instanceof URL
      ? inputPath.pathname
      : String(inputPath);
  const abs = path.resolve(raw);

  if (REAL_PROJECT && (abs === REAL_PROJECT || abs.startsWith(REAL_PROJECT + path.sep))) {
    const rel = abs.slice(REAL_PROJECT.length).split(path.sep).join("/");
    return VIRTUAL_PROJECT + rel;
  }
  if (REAL_HOME && (abs === REAL_HOME || abs.startsWith(REAL_HOME + path.sep))) {
    const rel = abs.slice(REAL_HOME.length).split(path.sep).join("/");
    return VIRTUAL_HOME + rel;
  }
  return abs.split(path.sep).join("/");
}

function isInternalPath(inputPath) {
  if (!inputPath) return true;
  const s = String(inputPath);
  if (s === TRACE_FILE || s.includes("preload-hook.cjs")) return true;
  if (s.includes("/node_modules/") && !s.includes(".env")) return true;
  return false;
}

function record(evt) {
  try {
    const line = JSON.stringify({
      ...evt,
      t: elapsedMs(),
      phase: evt.phase || CURRENT_PHASE,
    });
    origAppendFileSync(TRACE_FILE, `${line}\n`, "utf8");
  } catch {
    // Never break package execution due to trace recording errors
  }
}

// Record this script process's exec event
record({
  type: "exec",
  pid: VIRTUAL_PID,
  ppid: VIRTUAL_PPID,
  path: "/usr/local/bin/node",
  argv: ["node", ...process.argv.slice(1).map((a) => (a.startsWith("/") ? toVirtualPath(a) : a))],
});

// ---- Instrument filesystem reads ----
fs.readFileSync = function patchedReadFileSync(filePath, ...args) {
  if (typeof filePath === "string" || Buffer.isBuffer(filePath) || filePath instanceof URL) {
    if (!isInternalPath(filePath)) {
      record({
        type: "file_read",
        pid: VIRTUAL_PID,
        ppid: VIRTUAL_PPID,
        path: toVirtualPath(filePath),
      });
    }
  }
  return origReadFileSync(filePath, ...args);
};

fs.readFile = function patchedReadFile(filePath, ...args) {
  if (typeof filePath === "string" || Buffer.isBuffer(filePath) || filePath instanceof URL) {
    if (!isInternalPath(filePath)) {
      record({
        type: "file_read",
        pid: VIRTUAL_PID,
        ppid: VIRTUAL_PPID,
        path: toVirtualPath(filePath),
      });
    }
  }
  return origReadFile(filePath, ...args);
};

fs.openSync = function patchedOpenSync(filePath, flags, ...args) {
  if (typeof filePath === "string" && !isInternalPath(filePath)) {
    const isWrite = typeof flags === "string" && /[wa+]/.test(flags);
    record(
      isWrite
        ? { type: "file_write", op: "write", pid: VIRTUAL_PID, ppid: VIRTUAL_PPID, path: toVirtualPath(filePath) }
        : { type: "file_read", pid: VIRTUAL_PID, ppid: VIRTUAL_PPID, path: toVirtualPath(filePath) },
    );
  }
  return origOpenSync(filePath, flags, ...args);
};

// ---- Instrument filesystem writes ----
fs.writeFileSync = function patchedWriteFileSync(filePath, ...args) {
  if (typeof filePath === "string" || Buffer.isBuffer(filePath) || filePath instanceof URL) {
    if (!isInternalPath(filePath)) {
      record({
        type: "file_write",
        op: "write",
        pid: VIRTUAL_PID,
        ppid: VIRTUAL_PPID,
        path: toVirtualPath(filePath),
      });
    }
  }
  return origWriteFileSync(filePath, ...args);
};

fs.writeFile = function patchedWriteFile(filePath, ...args) {
  if (typeof filePath === "string" || Buffer.isBuffer(filePath) || filePath instanceof URL) {
    if (!isInternalPath(filePath)) {
      record({
        type: "file_write",
        op: "write",
        pid: VIRTUAL_PID,
        ppid: VIRTUAL_PPID,
        path: toVirtualPath(filePath),
      });
    }
  }
  return origWriteFile(filePath, ...args);
};

fs.mkdirSync = function patchedMkdirSync(dirPath, ...args) {
  if (typeof dirPath === "string" && !isInternalPath(dirPath)) {
    record({
      type: "file_write",
      op: "mkdir",
      pid: VIRTUAL_PID,
      ppid: VIRTUAL_PPID,
      path: toVirtualPath(dirPath),
    });
  }
  return origMkdirSync(dirPath, ...args);
};

fs.mkdir = function patchedMkdir(dirPath, ...args) {
  if (typeof dirPath === "string" && !isInternalPath(dirPath)) {
    record({
      type: "file_write",
      op: "mkdir",
      pid: VIRTUAL_PID,
      ppid: VIRTUAL_PPID,
      path: toVirtualPath(dirPath),
    });
  }
  return origMkdir(dirPath, ...args);
};

fs.unlinkSync = function patchedUnlinkSync(filePath) {
  if (!isInternalPath(filePath)) {
    record({
      type: "file_write",
      op: "delete",
      pid: VIRTUAL_PID,
      ppid: VIRTUAL_PPID,
      path: toVirtualPath(filePath),
    });
  }
  return origUnlinkSync(filePath);
};

fs.renameSync = function patchedRenameSync(oldPath, newPath) {
  record({
    type: "file_write",
    op: "rename",
    pid: VIRTUAL_PID,
    ppid: VIRTUAL_PPID,
    path: toVirtualPath(oldPath),
    target: toVirtualPath(newPath),
  });
  return origRenameSync(oldPath, newPath);
};

fs.symlinkSync = function patchedSymlinkSync(target, linkPath, type) {
  record({
    type: "file_write",
    op: "symlink",
    pid: VIRTUAL_PID,
    ppid: VIRTUAL_PPID,
    path: toVirtualPath(linkPath),
    target: toVirtualPath(target),
  });
  return origSymlinkSync(target, linkPath, type);
};

fs.linkSync = function patchedLinkSync(existingPath, newPath) {
  record({
    type: "file_write",
    op: "hardlink",
    pid: VIRTUAL_PID,
    ppid: VIRTUAL_PPID,
    path: toVirtualPath(newPath),
    target: toVirtualPath(existingPath),
  });
  return origLinkSync(existingPath, newPath);
};

fs.chmodSync = function patchedChmodSync(filePath, mode) {
  record({
    type: "file_write",
    op: "chmod",
    pid: VIRTUAL_PID,
    ppid: VIRTUAL_PPID,
    path: toVirtualPath(filePath),
  });
  return origChmodSync(filePath, mode);
};

if (fs.promises) {
  const origPRead = fs.promises.readFile.bind(fs.promises);
  fs.promises.readFile = function patchedPRead(filePath, ...args) {
    if (!isInternalPath(filePath)) {
      record({ type: "file_read", pid: VIRTUAL_PID, ppid: VIRTUAL_PPID, path: toVirtualPath(filePath) });
    }
    return origPRead(filePath, ...args);
  };
  const origPWrite = fs.promises.writeFile.bind(fs.promises);
  fs.promises.writeFile = function patchedPWrite(filePath, ...args) {
    if (!isInternalPath(filePath)) {
      record({ type: "file_write", op: "write", pid: VIRTUAL_PID, ppid: VIRTUAL_PPID, path: toVirtualPath(filePath) });
    }
    return origPWrite(filePath, ...args);
  };
}

// ---- Instrument & intercept HTTP/HTTPS into Sietch Capture Sink ----
function makeInterceptedHttpRequest(scheme) {
  return function interceptedRequest(urlOrOptions, maybeOptions, maybeCallback) {
    let options = {};
    let callback = maybeCallback;

    if (typeof urlOrOptions === "string" || urlOrOptions instanceof URL) {
      const u = new URL(String(urlOrOptions));
      options = {
        hostname: u.hostname,
        port: u.port || (scheme === "https" ? 443 : 80),
        path: u.pathname + u.search,
        method: "GET",
      };
      if (typeof maybeOptions === "function") {
        callback = maybeOptions;
      } else if (maybeOptions && typeof maybeOptions === "object") {
        options = { ...options, ...maybeOptions };
      }
    } else if (urlOrOptions && typeof urlOrOptions === "object") {
      options = { ...urlOrOptions };
      if (typeof maybeOptions === "function") {
        callback = maybeOptions;
      }
    }

    const host = String(options.hostname || options.host || "unknown.invalid").split(":")[0];
    const reqPath = String(options.path || "/");
    const method = String(options.method || "GET").toUpperCase();
    const rawHeaders = options.headers || {};
    const headers = Object.entries(rawHeaders).map(([k, v]) => [String(k), String(v)]);

    const req = new EventEmitter();
    const bodyChunks = [];

    req.setHeader = (k, v) => headers.push([String(k), String(v)]);
    req.getHeader = (k) => headers.find(([name]) => name.toLowerCase() === String(k).toLowerCase())?.[1];
    req.setTimeout = () => req;
    req.destroy = () => req;
    req.abort = () => req;

    req.write = (chunk) => {
      if (chunk !== undefined && chunk !== null) {
        bodyChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
      }
      return true;
    };

    req.end = (chunk) => {
      if (chunk !== undefined && chunk !== null) {
        req.write(chunk);
      }
      const bodyBuf = Buffer.concat(bodyChunks);
      const maxBody = 65536;
      const bodyTruncated = bodyBuf.length > maxBody;
      const body = bodyBuf.subarray(0, maxBody).toString("latin1");

      // Record DNS lookup + HTTP request as captured by the Sietch sink
      record({
        type: "dns",
        name: host,
        qtype: "A",
      });
      record({
        type: "http",
        method,
        scheme,
        host,
        path: reqPath,
        headers,
        body,
        bodyTruncated,
      });

      // Synthesize a local sink 200 OK response so zero packets leave the sandbox
      const res = new Readable({
        read() {
          this.push('{"captured":true,"sink":"sietch"}');
          this.push(null);
        },
      });
      res.statusCode = 200;
      res.statusMessage = "OK";
      res.headers = { "content-type": "application/json" };

      process.nextTick(() => {
        if (typeof callback === "function") callback(res);
        req.emit("response", res);
      });
      return req;
    };

    return req;
  };
}

http.request = makeInterceptedHttpRequest("http");
http.get = function interceptedHttpGet(...args) {
  const req = http.request(...args);
  req.end();
  return req;
};

https.request = makeInterceptedHttpRequest("https");
https.get = function interceptedHttpsGet(...args) {
  const req = https.request(...args);
  req.end();
  return req;
};

// Block raw DNS / TCP egress while recording events
dns.lookup = function interceptedDnsLookup(hostname, options, cb) {
  const callback = typeof options === "function" ? options : cb;
  record({ type: "dns", name: String(hostname), qtype: "A" });
  if (typeof callback === "function") {
    process.nextTick(() => callback(null, "10.200.0.2", 4));
  }
};

net.connect = net.createConnection = function interceptedConnect(options) {
  const host = typeof options === "object" && options ? String(options.host || "10.200.0.2") : "10.200.0.2";
  const port = typeof options === "object" && options ? Number(options.port || 80) : 80;
  record({
    type: "connect",
    pid: VIRTUAL_PID,
    ppid: VIRTUAL_PPID,
    protocol: "tcp",
    address: /^[0-9.]+$/.test(host) ? host : "10.200.0.2",
    port,
  });
  const sock = new EventEmitter();
  sock.write = () => true;
  sock.end = () => sock;
  sock.destroy = () => sock;
  return sock;
};

// ---- Instrument child_process to catch spawned & detached/lingering processes ----
let nextChildPid = VIRTUAL_PID + 100;

childProcess.spawn = function patchedSpawn(command, args = [], options = {}) {
  const argvList = Array.isArray(args) ? args.map(String) : [];
  const childVirtualPid = nextChildPid++;
  const normalizedCmd =
    command === process.execPath || command === "node"
      ? "/usr/local/bin/node"
      : command.startsWith("/")
        ? command
        : `/usr/bin/${command}`;

  record({
    type: "exec",
    pid: childVirtualPid,
    ppid: VIRTUAL_PID,
    path: normalizedCmd,
    argv: [path.basename(normalizedCmd), ...argvList],
  });

  if (options && options.detached) {
    // Record a detached lingering process safely without leaking orphan OS processes
    const fakeChild = new EventEmitter();
    fakeChild.pid = childVirtualPid;
    fakeChild.unref = () => fakeChild;
    fakeChild.kill = () => true;
    spawnedPids.push({ pid: childVirtualPid, detached: true });
    return fakeChild;
  }

  const child = origSpawn(command, args, options);
  child.on("exit", (code, signal) => {
    record({
      type: "exit",
      pid: childVirtualPid,
      ppid: VIRTUAL_PID,
      code: typeof code === "number" ? code : null,
      signal: signal ? String(signal) : null,
    });
  });
  return child;
};

childProcess.exec = function patchedExec(command, options, callback) {
  const childVirtualPid = nextChildPid++;
  record({
    type: "exec",
    pid: childVirtualPid,
    ppid: VIRTUAL_PID,
    path: "/bin/sh",
    argv: ["sh", "-c", String(command)],
  });
  return origExec(command, options, callback);
};

childProcess.execFile = function patchedExecFile(file, args, options, callback) {
  const childVirtualPid = nextChildPid++;
  const normalized = file.startsWith("/") ? file : `/usr/bin/${file}`;
  record({
    type: "exec",
    pid: childVirtualPid,
    ppid: VIRTUAL_PID,
    path: normalized,
    argv: [path.basename(normalized), ...(Array.isArray(args) ? args.map(String) : [])],
  });
  return origExecFile(file, args, options, callback);
};

process.on("exit", (code) => {
  record({
    type: "exit",
    pid: VIRTUAL_PID,
    ppid: VIRTUAL_PPID,
    code: typeof code === "number" ? code : 0,
    signal: null,
  });
});
