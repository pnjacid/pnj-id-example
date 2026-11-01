import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { codeChallenge, endSessionUrl, loadProvider, randomUrlSafe } from './oidc.js';

const port = Number(process.env.PORT ?? 5173);
const issuer = process.env.OIDC_ISSUER ?? 'https://dev-id.pnj.ac.id/cas/oidc';
const clientId = process.env.OIDC_CLIENT_ID ?? 'al-localhost5173testread-1012';
const clientSecret = process.env.OIDC_CLIENT_SECRET;
const redirectUri = process.env.OIDC_REDIRECT_URI ?? 'http://localhost:5173/auth/callback';
const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:90';
const testReadUrl = 'https://dev-api.pnj.ac.id/testread';
const scopes = 'openid profile email test.read';
const sessions = new Map();
const indexHtml = await readFile(new URL('./public/index.html', import.meta.url));
const styles = await readFile(new URL('./public/styles.css', import.meta.url));
const appJs = await readFile(new URL('./public/app.js', import.meta.url));
let provider;

function cookies(request) {
  return Object.fromEntries((request.headers.cookie ?? '').split('; ').filter(Boolean).map(value => {
    const separator = value.indexOf('=');
    return [value.slice(0, separator), decodeURIComponent(value.slice(separator + 1))];
  }));
}

function session(request, response) {
  let id = cookies(request).pnj_session;
  if (!id || !sessions.has(id)) {
    id = randomUrlSafe();
    sessions.set(id, {});
    response.setHeader('set-cookie', `pnj_session=${id}; HttpOnly; SameSite=Lax; Path=/`);
  }
  return sessions.get(id);
}

function redirect(response, location) {
  response.writeHead(302, { location, 'cache-control': 'no-store' });
  response.end();
}

function json(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store'
  });
  response.end(JSON.stringify(body));
}

async function oidcProvider() {
  provider ??= await loadProvider(issuer);
  return provider;
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (request.method === 'GET' && url.pathname === '/') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      return response.end(indexHtml);
    }
    if (request.method === 'GET' && url.pathname === '/styles.css') {
      response.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
      return response.end(styles);
    }
    if (request.method === 'GET' && url.pathname === '/app.js') {
      response.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      return response.end(appJs);
    }

    const currentSession = session(request, response);

    if (request.method === 'GET' && url.pathname === '/auth/login') {
      if (!clientSecret) throw new Error('OIDC_CLIENT_SECRET belum dikonfigurasi');
      const metadata = await oidcProvider();
      currentSession.state = randomUrlSafe();
      currentSession.nonce = randomUrlSafe();
      currentSession.codeVerifier = randomUrlSafe(64);

      const authorizationUrl = new URL(metadata.authorization_endpoint);
      authorizationUrl.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: scopes,
        state: currentSession.state,
        nonce: currentSession.nonce,
        code_challenge: codeChallenge(currentSession.codeVerifier),
        code_challenge_method: 'S256'
      });
      return redirect(response, authorizationUrl);
    }

    if (request.method === 'GET' && url.pathname === '/auth/callback') {
      if (url.searchParams.get('error')) {
        throw new Error(url.searchParams.get('error_description') ?? url.searchParams.get('error'));
      }
      if (!currentSession.state || url.searchParams.get('state') !== currentSession.state) {
        return json(response, 400, { error: 'State OIDC tidak valid' });
      }

      const metadata = await oidcProvider();
      const tokenResponse = await fetch(metadata.token_endpoint, {
        method: 'POST',
        headers: {
          authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
          'content-type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: url.searchParams.get('code') ?? '',
          redirect_uri: redirectUri,
          code_verifier: currentSession.codeVerifier
        })
      });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokens.error_description ?? tokens.error ?? 'Token exchange gagal');

      const userResponse = await fetch(metadata.userinfo_endpoint, {
        headers: { authorization: `Bearer ${tokens.access_token}` }
      });
      if (!userResponse.ok) throw new Error(`UserInfo gagal (${userResponse.status})`);

      currentSession.user = await userResponse.json();
      currentSession.accessToken = tokens.access_token;
      currentSession.idToken = tokens.id_token;
      delete currentSession.state;
      delete currentSession.nonce;
      delete currentSession.codeVerifier;
      return redirect(response, '/');
    }

    if (request.method === 'GET' && url.pathname === '/api/session') {
      if (!currentSession.user) return json(response, 200, { authenticated: false });
      return json(response, 200, { authenticated: true, user: currentSession.user });
    }

    if (request.method === 'GET' && ['/api/backend-profile', '/api/test-read'].includes(url.pathname)) {
      if (!currentSession.accessToken) return json(response, 401, { error: 'Silakan masuk terlebih dahulu' });
      const apiUrl = url.pathname === '/api/test-read' ? testReadUrl : `${backendUrl}/api/profile`;
      const apiResponse = await fetch(apiUrl, {
        headers: { authorization: `Bearer ${currentSession.accessToken}` }
      });
      return json(response, apiResponse.status, await apiResponse.json());
    }

    if (request.method === 'POST' && url.pathname === '/auth/logout') {
      const id = cookies(request).pnj_session;
      const idToken = id ? sessions.get(id)?.idToken : undefined;
      if (id) sessions.delete(id);
      response.setHeader('set-cookie', 'pnj_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
      return json(response, 200, { logoutUrl: endSessionUrl(await oidcProvider(), idToken) });
    }

    return json(response, 404, { error: 'Endpoint tidak ditemukan' });
  } catch (error) {
    return json(response, 500, { error: error.message });
  }
});

server.listen(port, () => {
  console.log(`Frontend berjalan di http://localhost:${port}`);
});
