import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const component = await readFile(new URL('./src/App.vue', import.meta.url), 'utf8');
const script = component.split('<script setup>')[1].split('</script>')[0].replace(/^import .*;$/m, '');

function app(fetch) {
  const location = { assign(url) { this.url = url; } };
  const context = {
    fetch, window: { location },
    ref: value => ({ value }),
    nextTick: async () => {},
    onMounted: () => {}
  };
  const state = runInNewContext(`${script}\n({loadSession, showApiResult, logout, user, loading, error, busy, result})`, context);
  return { state, context, location };
}

test('session loads OIDC profile and handles expired session and errors', async () => {
  const view = app(async () => ({ ok: true, json: async () => ({ authenticated: true, user: { email: 'test@example.com' } }) }));
  await view.state.loadSession();
  assert.equal(view.state.user.value.email, 'test@example.com');
  assert.equal(view.state.loading.value, false);
  view.context.fetch = async () => ({ ok: true, json: async () => ({ authenticated: false }) });
  await view.state.loadSession();
  assert.equal(view.state.user.value, null);
  view.context.fetch = async () => { throw new Error('offline'); };
  await view.state.loadSession();
  assert.equal(view.state.error.value, 'offline');
  assert.equal(view.state.loading.value, false);
});

test('both API actions display JSON and restore controls', async () => {
  for (const url of ['/api/test-read', '/api/backend-profile']) {
    const view = app(async path => {
      assert.equal(path, url);
      return { status: 403, json: async () => ({ error: 'Scope ditolak' }) };
    });
    await view.state.showApiResult(url);
    assert.match(view.state.result.value, /Scope ditolak/);
    assert.equal(view.state.busy.value, '');
  }
});

test('logout posts and navigates, and allows retry on failure', async () => {
  const view = app(async (url, options) => {
    assert.equal(url, '/auth/logout');
    assert.equal(options.method, 'POST');
    return { ok: true, json: async () => ({ logoutUrl: 'https://provider.example/logout' }) };
  });
  await view.state.logout();
  assert.equal(view.location.url, 'https://provider.example/logout');
  view.context.fetch = async () => ({ ok: false });
  await view.state.logout();
  assert.equal(view.state.busy.value, '');
  assert.match(view.state.error.value, /Sesi gagal/);
});
