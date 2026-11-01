import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const source = await readFile(new URL('./public/app.js', import.meta.url), 'utf8');

async function page(session) {
  const elements = new Map();
  const buttons = ['/api/test-read', '/api/backend-profile'].map(url => ({ dataset: { url } }));
  function element(key) {
    if (!elements.has(key)) elements.set(key, {
      hidden: true,
      textContent: '',
      addEventListener(type, handler) { this[type] = handler; },
      focus() { this.focused = true; }
    });
    return elements.get(key);
  }
  for (const button of buttons) Object.assign(button, element(button.dataset.url));
  const calls = [];
  const location = { assign(url) { this.url = url; } };
  const context = {
    document: { querySelector: element, querySelectorAll: () => buttons },
    location,
    fetch: async (url, options) => {
      calls.push([url, options]);
      return { ok: true, json: async () => session };
    }
  };
  runInNewContext(source, context);
  await new Promise(resolve => setImmediate(resolve));
  return { context, element, buttons, calls, location };
}

test('session displays OIDC email, mail fallback, and missing claim', async () => {
  for (const [user, email] of [
    [{ email: 'email@example.com', mail: 'mail@example.com' }, 'email@example.com'],
    [{ email: '', mail: 'mail@example.com' }, 'mail@example.com'],
    [{}, 'Tidak dikirim oleh provider']
  ]) {
    const view = await page({ authenticated: true, user });
    assert.equal(view.element('#email').textContent, email);
    assert.equal(view.element('#signed-in').hidden, false);
  }
  const view = await page({ authenticated: false });
  assert.equal(view.element('#signed-out').hidden, false);
  assert.equal(view.element('#signed-in').hidden, true);
});

test('each API button shows JSON errors and restores its state', async () => {
  const view = await page({ authenticated: true, user: {} });
  view.context.fetch = async url => {
    view.calls.push([url]);
    return { ok: false, json: async () => ({ error: 'Akses ditolak' }) };
  };
  for (const button of view.buttons) {
    button.textContent = 'Panggil API';
    await button.click({ currentTarget: button });
    assert.equal(view.calls.at(-1)[0], button.dataset.url);
    assert.match(view.element('#backend-result').textContent, /Akses ditolak/);
    assert.equal(button.disabled, false);
    assert.equal(button.textContent, 'Panggil API');
  }
  view.context.fetch = async () => { throw new Error('offline'); };
  await view.buttons[0].click({ currentTarget: view.buttons[0] });
  assert.equal(view.element('#error').hidden, false);
});

test('logout posts to server and navigates to provider', async () => {
  const view = await page({ authenticated: true, user: {} });
  view.context.fetch = async (url, options) => {
    assert.equal(url, '/auth/logout');
    assert.equal(options.method, 'POST');
    return { ok: true, json: async () => ({ logoutUrl: 'https://provider.example/logout' }) };
  };
  await view.element('#logout').click({ currentTarget: view.element('#logout') });
  assert.equal(view.location.url, 'https://provider.example/logout');
});
