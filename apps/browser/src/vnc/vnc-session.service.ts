import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChildProcess, execFileSync, spawn } from 'child_process';
import { createServer, createConnection } from 'net';
import { randomBytes } from 'crypto';
import { existsSync } from 'fs';

export interface VncSession {
  sessionId: string;
  display: number;
  wsPort: number;
  width: number;
  height: number;
  token: string;
  processes: ChildProcess[];
  timeout: NodeJS.Timeout;
}

const SESSION_TIMEOUT_MS = 5 * 60 * 1000;
const DEFAULT_WIDTH = 1920;
const DEFAULT_HEIGHT = 1080;

@Injectable()
export class VncSessionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VncSessionService.name);
  private sessions = new Map<string, VncSession>();
  private nextDisplay = 100;
  private _available = false;
  private readonly wsPortMin: number;
  private readonly wsPortMax: number;
  private nextWsPort: number;

  constructor(private config: ConfigService) {
    this.wsPortMin = Number(config.get('VNC_WS_PORT_MIN', 9000));
    this.wsPortMax = Number(config.get('VNC_WS_PORT_MAX', 9010));
    this.nextWsPort = this.wsPortMin;
  }

  get available(): boolean {
    return this._available;
  }

  onModuleInit() {
    this._available = ['Xvfb', 'x11vnc', 'websockify'].every((bin) => {
      try {
        execFileSync('which', [bin], { stdio: 'ignore' });
        return true;
      } catch {
        return false;
      }
    });

    if (this._available) {
      this.logger.log('VNC tools detected (Xvfb, x11vnc, websockify)');
    } else {
      this.logger.warn('VNC tools not found — VNC will not be available');
    }
  }

  async onModuleDestroy() {
    for (const [id] of this.sessions) {
      this.cleanup(id);
    }
  }

  async create(sessionId: string): Promise<VncSession> {
    const display = await this.allocateDisplay();
    const vncPort = await this.findFreePort();
    const wsPort = this.allocateWsPort();
    const token = randomBytes(16).toString('hex');
    const width = DEFAULT_WIDTH;
    const height = DEFAULT_HEIGHT;

    const processes: ChildProcess[] = [];

    // +extension RANDR enables runtime resize so noVNC's resizeSession can
    // ask the server to match the client viewport.
    const xvfb = spawn(
      'Xvfb',
      [
        `:${display}`,
        '-screen', '0', `${width}x${height}x24`,
        '+extension', 'RANDR',
        '-nolisten', 'tcp',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    processes.push(xvfb);
    this.attachProcessLogging(xvfb, `Xvfb[:${display}]`, sessionId);

    try {
      await this.waitForX11Socket(display, 5000);
    } catch (err: any) {
      for (const proc of processes) {
        try { proc.kill('SIGTERM'); } catch {}
      }
      throw new Error(
        `Xvfb failed to start on display :${display}: ${err.message}`,
      );
    }

    // -xrandr resize: lets clients (noVNC) trigger framebuffer resize via the
    // SetDesktopSize RFB extension. -ncache 0 keeps things sharp (no caching).
    const x11vnc = spawn(
      'x11vnc',
      [
        '-display', `:${display}`,
        '-rfbport', String(vncPort),
        '-nopw', '-shared', '-forever', '-noxdamage',
        '-xrandr', 'resize',
        '-ncache', '0',
      ],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    processes.push(x11vnc);
    this.attachProcessLogging(x11vnc, `x11vnc[:${display}]`, sessionId);

    await this.sleep(500);

    const websockify = spawn(
      'websockify',
      [String(wsPort), `localhost:${vncPort}`],
      { stdio: ['ignore', 'ignore', 'pipe'] },
    );
    processes.push(websockify);
    this.attachProcessLogging(websockify, `websockify[${wsPort}]`, sessionId);

    try {
      await this.waitForTcpPort(wsPort, 5000);
    } catch (err: any) {
      for (const proc of processes) {
        try { proc.kill('SIGTERM'); } catch {}
      }
      throw new Error(
        `websockify failed to bind port ${wsPort}: ${err.message}`,
      );
    }

    const timeout = setTimeout(() => {
      this.logger.warn(`VNC session ${sessionId} timed out, cleaning up`);
      this.cleanup(sessionId);
    }, SESSION_TIMEOUT_MS);

    const session: VncSession = {
      sessionId, display, wsPort, width, height, token, processes, timeout,
    };

    this.sessions.set(sessionId, session);
    this.logger.log(
      `VNC session ${sessionId} created: display=:${display}, wsPort=${wsPort}, size=${width}x${height}`,
    );

    return session;
  }

  get(sessionId: string): VncSession | undefined {
    return this.sessions.get(sessionId);
  }

  validateToken(sessionId: string, token: string): boolean {
    const session = this.sessions.get(sessionId);
    return !!session && session.token === token;
  }

  cleanup(sessionId: string) {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    clearTimeout(session.timeout);
    for (const proc of session.processes) {
      try { proc.kill('SIGTERM'); } catch {}
    }
    this.sessions.delete(sessionId);
    this.logger.log(`VNC session ${sessionId} cleaned up`);
  }

  private async allocateDisplay(): Promise<number> {
    for (let i = 0; i < 100; i++) {
      const display = this.nextDisplay++;
      if (!existsSync(`/tmp/.X11-unix/X${display}`) && !existsSync(`/tmp/.X${display}-lock`)) {
        return display;
      }
    }
    throw new Error('No free X display available');
  }

  private async waitForTcpPort(port: number, timeoutMs: number): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const ok = await new Promise<boolean>((resolve) => {
        const s = createConnection({ host: '127.0.0.1', port });
        s.once('connect', () => { s.destroy(); resolve(true); });
        s.once('error', () => { s.destroy(); resolve(false); });
      });
      if (ok) return;
      await this.sleep(50);
    }
    throw new Error(`timeout waiting for TCP port ${port}`);
  }

  private async waitForX11Socket(display: number, timeoutMs: number): Promise<void> {
    const socketPath = `/tmp/.X11-unix/X${display}`;
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (existsSync(socketPath)) return;
      await this.sleep(50);
    }
    throw new Error(`timeout waiting for X11 socket ${socketPath}`);
  }

  private attachProcessLogging(proc: ChildProcess, label: string, sessionId: string): void {
    proc.on('error', (err) =>
      this.logger.error(`${label} error for session ${sessionId}: ${err.message}`),
    );
    proc.on('exit', (code, signal) => {
      if (code !== 0 && code !== null) {
        this.logger.warn(
          `${label} exited (session ${sessionId}): code=${code} signal=${signal}`,
        );
      }
    });
    proc.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString().trim();
      if (text) this.logger.warn(`${label} stderr: ${text}`);
    });
  }

  private allocateWsPort(): number {
    const usedPorts = new Set([...this.sessions.values()].map((s) => s.wsPort));
    for (let i = 0; i < this.wsPortMax - this.wsPortMin; i++) {
      const port = this.wsPortMin + ((this.nextWsPort - this.wsPortMin + i) % (this.wsPortMax - this.wsPortMin));
      if (!usedPorts.has(port)) {
        this.nextWsPort = port + 1;
        return port;
      }
    }
    throw new Error('No free VNC WebSocket ports available');
  }

  private findFreePort(): Promise<number> {
    return new Promise((resolve, reject) => {
      const server = createServer();
      server.listen(0, () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          const port = addr.port;
          server.close(() => resolve(port));
        } else {
          server.close(() => reject(new Error('Could not find free port')));
        }
      });
      server.on('error', reject);
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
