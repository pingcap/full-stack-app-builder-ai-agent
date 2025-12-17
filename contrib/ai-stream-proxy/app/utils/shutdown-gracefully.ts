import type { Server } from 'node:http';
import type { Socket } from 'node:net';
import { promisify } from 'node:util';

export function enableShutdownGracefully (server: Server) {

  const liveConnections = new Set<Socket>();

  server.on('connection', (socket) => {
    liveConnections.add(socket);
    socket.on('close', () => {
      liveConnections.delete(socket);
    });
  });

  let sigintReceived = false;

  process.on('SIGINT', async (signal) => {
    // npm issue
    if (!sigintReceived) {
      sigintReceived = true;
    } else {
      return;
    }
    console.log(`[shutdown] ${signal} received, shutdown gracefully...`);
    void server.close();
    const getConnections = promisify(server.getConnections).bind(server);

    const connections = await getConnections();
    if (connections > 0) {
      console.log(`[shutdown] waiting for ${connections} connections...`);
      liveConnections.forEach((socket) => {
        socket.on('close', async () => {
          const connections = await getConnections();
          if (connections === 0) {
            console.log('[shutdown] all connections closed.');
            process.exit(0);
          } else {
            console.log(`[shutdown] waiting for ${connections} connections...`);
          }
        });
      });
    } else {
      console.log(`[shutdown] no connections, exit.`);
      process.exit(0);
    }
  });

}