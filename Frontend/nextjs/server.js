import next from 'next';
import { startServer } from '../nodejs/server.js';

const app = next({ dev: process.argv.includes('--dev') });
await app.prepare();
startServer(app.getRequestHandler());
