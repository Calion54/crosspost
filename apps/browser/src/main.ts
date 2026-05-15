import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { connect as netConnect } from 'net';
import { AppModule } from './app.module.js';
import { VncSessionService } from './vnc/vnc-session.service.js';

const logger = new Logger('VncProxy');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();

  const vncSessionService = app.get(VncSessionService);

  const server = await app.listen(process.env.PORT ?? 5175);
  const httpServer =
    typeof server === 'object' && 'on' in server ? server : app.getHttpServer();

  httpServer.on('upgrade', (req: any, socket: any, head: any) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    const match = url.pathname.match(/^\/api\/vnc\/([^/]+)$/);
    if (!match) return;

    const sessionId = match[1];
    const token = url.searchParams.get('token') ?? '';

    if (!vncSessionService.validateToken(sessionId, token)) {
      logger.warn(`VNC auth failed for ${sessionId}`);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    const session = vncSessionService.get(sessionId)!;
    const targetPort = session.wsPort;

    logger.log(`Proxying VNC ${sessionId} → 127.0.0.1:${targetPort}`);

    const lines: string[] = ['GET / HTTP/1.1', `Host: 127.0.0.1:${targetPort}`];
    for (let i = 0; i < req.rawHeaders.length; i += 2) {
      const key = req.rawHeaders[i];
      const val = req.rawHeaders[i + 1];
      if (key.toLowerCase() === 'host') continue;
      lines.push(`${key}: ${val}`);
    }
    const rawReq = lines.join('\r\n') + '\r\n\r\n';

    const upstream = netConnect({ host: '127.0.0.1', port: targetPort, family: 4 });

    let upgraded = false;
    let respBuf = Buffer.alloc(0);

    upstream.once('connect', () => {
      upstream.write(rawReq);
      if (head.length > 0) upstream.write(head);
    });

    upstream.on('data', (chunk: Buffer) => {
      if (upgraded) return;
      respBuf = Buffer.concat([respBuf, chunk]);

      const headEnd = respBuf.indexOf('\r\n\r\n');
      if (headEnd < 0) return;
      upgraded = true;

      const headerSection = respBuf.slice(0, headEnd);
      const rest = respBuf.slice(headEnd + 4);

      socket.write(headerSection);
      socket.write('\r\n\r\n');
      if (rest.length > 0) socket.write(rest);

      socket.pipe(upstream);
      upstream.pipe(socket);

      upstream.on('error', () => socket.destroy());
      socket.on('error', () => upstream.destroy());
      socket.on('close', () => upstream.destroy());
      upstream.on('close', () => socket.destroy());
    });

    upstream.on('error', (err: Error) => {
      logger.error(`VNC upstream error: ${err.message}`);
      if (!upgraded) socket.destroy();
    });
  });
}
bootstrap();
