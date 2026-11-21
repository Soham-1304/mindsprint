import type { Server as HttpServer } from 'node:http';
import type { Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';

class WebSocketBroadcaster {
  private wss?: WebSocketServer;
  private clients: Set<WebSocket> = new Set();
  private sseClients: Set<Response> = new Set();
  private sseKeepaliveTimers: Map<Response, NodeJS.Timeout> = new Map();

  public init(server: HttpServer): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });

    this.wss.on('connection', (ws: WebSocket) => {
      this.clients.add(ws);

      // Welcome handshake
      ws.send(
        JSON.stringify({
          type: 'CONNECTED',
          message: 'Connected to SRE Agent Real-Time Stream',
          timestamp: new Date().toISOString(),
        }),
      );

      ws.on('close', () => {
        this.clients.delete(ws);
      });

      ws.on('error', () => {
        this.clients.delete(ws);
      });
    });

    // 25s WebSocket heartbeat ping so Render Free never drops idle live dashboard connections
    const wsHeartbeat = setInterval(() => {
      for (const client of this.clients) {
        if (client.readyState === WebSocket.OPEN) {
          try {
            client.ping();
          } catch {
            this.clients.delete(client);
          }
        }
      }
    }, 25000);
    wsHeartbeat.unref?.();
  }

  public addSseClient(res: Response): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    this.sseClients.add(res);

    const welcomePayload = JSON.stringify({
      type: 'CONNECTED',
      message: 'Connected to SRE Agent SSE Stream',
      timestamp: new Date().toISOString(),
    });
    res.write(`event: CONNECTED\ndata: ${welcomePayload}\n\n`);

    const keepalive = setInterval(() => {
      try {
        res.write(': keepalive\n\n');
      } catch {
        this.removeSseClient(res);
      }
    }, 25000);
    this.sseKeepaliveTimers.set(res, keepalive);

    res.on('close', () => {
      this.removeSseClient(res);
    });

    res.on('error', () => {
      this.removeSseClient(res);
    });
  }

  private removeSseClient(res: Response): void {
    this.sseClients.delete(res);
    const timer = this.sseKeepaliveTimers.get(res);
    if (timer) {
      clearInterval(timer);
      this.sseKeepaliveTimers.delete(res);
    }
  }

  public broadcastSse(event: string, data: unknown): void {
    const serialized = JSON.stringify({
      type: event,
      payload: data,
      timestamp: new Date().toISOString(),
    });
    const frame = `event: ${event}\ndata: ${serialized}\n\n`;

    for (const res of this.sseClients) {
      try {
        res.write(frame);
      } catch {
        this.removeSseClient(res);
      }
    }
  }

  public broadcast(type: string, payload: unknown): void {
    const data = JSON.stringify({
      type,
      payload,
      timestamp: new Date().toISOString(),
    });

    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    }

    this.broadcastSse(type, payload);
  }

  public close(): void {
    for (const client of this.clients) {
      try {
        client.terminate();
      } catch {
        // ignore close errors
      }
    }
    this.clients.clear();

    for (const res of this.sseClients) {
      const timer = this.sseKeepaliveTimers.get(res);
      if (timer) clearInterval(timer);
      try {
        res.end();
      } catch {
        // ignore close errors
      }
    }
    this.sseClients.clear();
    this.sseKeepaliveTimers.clear();

    if (this.wss) {
      try {
        this.wss.close();
      } catch {
        // ignore close errors
      }
    }
  }
}

export const wsBroadcaster = new WebSocketBroadcaster();

export function addSseClient(res: Response): void {
  wsBroadcaster.addSseClient(res);
}

export function broadcastSse(event: string, data: unknown): void {
  wsBroadcaster.broadcastSse(event, data);
}
