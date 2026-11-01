import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./app/page.js', import.meta.url), 'utf8');
const handlers = source.split('export default function Home() {')[1].split('\n  return (')[0];

function page(fetch) {
  const state = [];
  const location = { assign(url) { this.url = url; } };
  const context = {
    fetch, window: { location }, useEffect: () => {}, useRef: () => ({ current: null }),
    useState(value) {
      const index = state.length;
      state.push(value);
      return [value, next => { state[index] = next; }];
    }
  };
  const actions = runInNewContext(`${handlers}\n({loadSession, showApiResult, logout})`, context);
  return { state, actions, context, location };
}

test('session loads a profile and clears it when unauthenticated', async () => {
  const view = page(async () => ({ ok: true, json: async () => ({ authenticated: true, user: { email: 'test@example.com' } }) }));
  await view.actions.loadSession();
  assert.equal(view.state[0], false);
  assert.equal(view.state[1].email, 'test@example.com');
  view.context.fetch = async () => ({ ok: true, json: async () => ({ authenticated: false }) });
  await view.actions.loadSession();
  assert.equal(view.state[1], null);
  view.context.fetch = async () => ({ ok: false });
  await view.actions.loadSession();
  assert.match(view.state[2], /Sesi tidak dapat dimuat/);
  assert.equal(view.state[0], false);
});

test('API buttons preserve JSON error responses and restore controls', async () => {
  for (const url of ['/api/test-read', '/api/backend-profile']) {
    const view = page(async path => {
      assert.equal(path, url);
      return { status: 403, json: async () => ({ error: 'Scope ditolak' }) };
    });
    await view.actions.showApiResult(url);
    assert.match(view.state[4], /Scope ditolak/);
    assert.equal(view.state[3], '');
  }
});

test('logout uses POST and navigates to provider, with retry on failure', async () => {
  const view = page(async (url, options) => {
    assert.equal(url, '/auth/logout');
    assert.equal(options.method, 'POST');
    return { ok: true, json: async () => ({ logoutUrl: 'https://provider.example/logout' }) };
  });
  await view.actions.logout();
  assert.equal(view.location.url, 'https://provider.example/logout');
  view.context.fetch = async () => ({ ok: false });
  await view.actions.logout();
  assert.equal(view.state[3], '');
  assert.match(view.state[2], /Sesi gagal/);
});
