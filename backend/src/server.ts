import { createServer } from 'http';
import app from './app';
import { env } from './config/env';
import prisma from './db/prisma';
import { initializeSocket } from './socket';

async function start() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('Database connection successful');
  } catch (err) {
    console.error('Database connection failed:', err);
    process.exit(1);
  }

  // Create HTTP server from Express app
  const httpServer = createServer(app);

  // Initialize Socket.IO and attach to HTTP server
  const io = initializeSocket(httpServer);

  // Store io instance on app for access in routes
  app.set('io', io);

  const port = env.PORT;
  const host = process.env.HOST || '0.0.0.0';

  httpServer.listen(port, host, () => {
    console.log(`API running on http://localhost:${port}`);
    if (host === '0.0.0.0') {
      console.log(`LAN access enabled on port ${port}`);
    }
    console.log(`Socket.IO ready for connections`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
