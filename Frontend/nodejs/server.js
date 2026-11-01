import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createClient } from 'redis';
import { loadProvider, completeLogin, oidc } from './oidc.js';
import { sessionStore } from './session.js';

const production = process.env.NODE_ENV === 'production';
const port = Number(process.env.PORT ?? 5173);
const redirectUri = new URL(process.env.OIDC_REDIRECT_URI ?? 'http://localhost:5173/auth/callback');
const secure = redirectUri.protocol === 'https:';
if (production && (!secure || !(process.env.REDIS_URL || process.env.REDIS_HOST) || !process.env.OIDC_CLIENT_SECRET)) {
  throw new Error('Production memerlukan HTTPS redirect URI, REDIS_URL atau REDIS_HOST, dan OIDC_CLIENT_SECRET');
}
if (!['https:', 'http:'].includes(redirectUri.protocol) || (!secure && !['localhost', '127.0.0.1'].includes(redirectUri.hostname))) {
  throw new Error('HTTP hanya diizinkan untuk development lokal');
}
const redis = createClient({
  url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || '127.0.0.1'}:${process.env.REDIS_PORT || '6379'}`,
  username: process.env.REDIS_USERNAME || undefined,
  password: process.env.REDIS_PASSWORD || undefined,
  disableOfflineQueue: true,
  socket: { connectTimeout: 5000 }
});
redis.on('error', error => console.error('Redis connection error', { name: error.name, code: error.code }));
await redis.connect();
const sessions = sessionStore(redis, secure);
const provider = await loadProvider(
  process.env.OIDC_ISSUER ?? 'https://dev-id.pnj.ac.id/cas/oidc',
  process.env.OIDC_CLIENT_ID ?? 'al-localhost5173testread-1012',
  process.env.OIDC_CLIENT_SECRET
);
const files = new Map();
for (const [path, name, type] of [['/', 'index.html', 'text/html'], ['/styles.css', 'styles.css', 'text/css'], ['/app.js', 'app.js', 'text/javascript']]) {
  files.set(path, { body: await readFile(new URL(`./public/${name}`, import.meta.url)), type });
}

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(body));
}

function redirect(response, location) {
  response.writeHead(302, { location: location.toString() });
  response.end();
}

const server = createServer(async (request, response) => {
  let stage = 'request';
  response.setHeader('cache-control', 'no-store');
  response.setHeader('content-security-policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('referrer-policy', 'no-referrer');
  if (secure) response.setHeader('strict-transport-security', 'max-age=31536000');
  try {
    const url = new URL(request.url, redirectUri.origin);
    const file = files.get(url.pathname);
    if (request.method === 'GET' && file) {
      response.writeHead(200, { 'content-type': `${file.type}; charset=utf-8` });
      return response.end(file.body);
    }
    if (request.method === 'GET' && url.pathname === '/auth/login') {
      stage = 'login.authorization-url';
      const transaction = { state: oidc.randomState(), nonce: oidc.randomNonce(), codeVerifier: oidc.randomPKCECodeVerifier() };
      const authorizationUrl = oidc.buildAuthorizationUrl(provider, {
        redirect_uri: redirectUri.href, response_type: 'code', scope: 'openid profile email test.read',
        state: transaction.state, nonce: transaction.nonce,
        code_challenge: await oidc.calculatePKCECodeChallenge(transaction.codeVerifier), code_challenge_method: 'S256'
      });
      stage = 'login.delete-session';
      await sessions.destroy(request, response);
      stage = 'login.save-transaction';
      await sessions.create(response, { transaction }, 600);
      stage = 'login.redirect';
      return redirect(response, authorizationUrl);
    }
    if (request.method === 'GET' && url.pathname === '/auth/callback') {
      const pending = await sessions.read(request, true);
      if (!pending?.transaction) return json(response, 400, { error: 'Transaksi login tidak valid atau kedaluwarsa. Silakan masuk lagi.' });
      let login;
      try {
        login = await completeLogin(provider, url, pending.transaction);
      } catch (error) {
        console.error('OIDC callback failed', {
          stage: error.stage, name: error.name, code: error.code, message: error.message,
          causeCode: error.cause?.code, causeMessage: error.cause?.message
        });
        return json(response, 400, {
          error: 'Validasi login gagal. Silakan masuk lagi.',
          ...(!production && {
            diagnostic: {
              stage: error.stage,
              code: error.code,
              status: error.status,
              challenges: Array.isArray(error.cause) ? error.cause.map(challenge => ({
                scheme: challenge.scheme,
                error: challenge.parameters?.error
              })) : undefined,
              causeCode: error.cause?.code,
              claim: error.cause?.claim
            }
          })
        });
      }
      const ttl = Math.floor(Math.min(3600, login.expiresIn ?? 3600));
      if (ttl <= 0) return json(response, 401, { error: 'Token kedaluwarsa. Silakan masuk lagi.' });
      stage = 'callback.save-session';
      await sessions.create(response, { user: login.user, accessToken: login.accessToken, idToken: login.idToken }, ttl);
      return redirect(response, '/');
    }
    const currentSession = await sessions.read(request);
    if (request.method === 'GET' && url.pathname === '/api/session') {
      return json(response, 200, currentSession?.user ? { authenticated: true, user: currentSession.user } : { authenticated: false });
    }
    if (request.method === 'GET' && ['/api/backend-profile', '/api/test-read'].includes(url.pathname)) {
      if (!currentSession?.accessToken) return json(response, 401, { error: 'Silakan masuk terlebih dahulu' });
      const apiUrl = url.pathname === '/api/test-read' ? 'https://dev-api.pnj.ac.id/testread' : `${process.env.BACKEND_URL ?? 'http://localhost:90'}/api/profile`;
      const apiResponse = await fetch(apiUrl, { headers: { authorization: `Bearer ${currentSession.accessToken}` }, signal: AbortSignal.timeout(10000), redirect: 'error' });
      return json(response, apiResponse.status, await apiResponse.json());
    }
    if (request.method === 'POST' && url.pathname === '/auth/logout') {
      if (request.headers.origin !== redirectUri.origin) return json(response, 403, { error: 'Origin tidak valid' });
      await sessions.destroy(request, response);
      const metadata = provider.serverMetadata();
      const logoutUrl = metadata.end_session_endpoint
        ? oidc.buildEndSessionUrl(provider, currentSession?.idToken ? { id_token_hint: currentSession.idToken } : {}).href
        : '/';
      return json(response, 200, { logoutUrl });
    }
    return json(response, 404, { error: 'Endpoint tidak ditemukan' });
  } catch (error) {
    console.error('Request failed', {
      stage, name: error.name, code: error.code,
      causeCode: error.cause?.code,
      message: stage.startsWith('login.') ? error.message : undefined
    });
    return json(response, 503, { error: 'Layanan sementara tidak tersedia. Silakan coba lagi.' });
  }
});
server.requestTimeout = 15000;
server.headersTimeout = 10000;
server.listen(port, () => console.log(`Frontend berjalan pada port ${port}`));
for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => { redis.destroy(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
