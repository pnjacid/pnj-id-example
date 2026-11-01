'use client';

import { useEffect, useRef, useState } from 'react';

export default function Home() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [result, setResult] = useState('');
  const resultView = useRef(null);

  async function loadSession() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/session', { cache: 'no-store' });
      if (!response.ok) throw new Error('Sesi tidak dapat dimuat. Coba lagi.');
      const session = await response.json();
      setUser(session.authenticated ? session.user : null);
    } catch (failure) {
      setError(failure.message);
    } finally {
      setLoading(false);
    }
  }

  async function showApiResult(url) {
    setBusy(url);
    setError('');
    setResult('');
    try {
      const response = await fetch(url, { cache: 'no-store' });
      const body = await response.json();
      setResult(JSON.stringify(body, null, 2));
      if (response.status === 401) await loadSession();
    } catch {
      setError('Layanan data tidak dapat dihubungi. Coba lagi.');
    } finally {
      setBusy('');
    }
  }

  async function logout() {
    setBusy('logout');
    setError('');
    try {
      const response = await fetch('/auth/logout', { method: 'POST' });
      if (!response.ok) throw new Error();
      const { logoutUrl } = await response.json();
      window.location.assign(logoutUrl);
    } catch {
      setError('Sesi gagal dihapus. Coba keluar lagi.');
      setBusy('');
    }
  }

  useEffect(() => { loadSession(); }, []);
  useEffect(() => { if (result) resultView.current?.focus(); }, [result]);

  return (
    <>
      <main>
        <h1>Contoh OIDC dengan Next.js</h1>
        <p>Login dengan PNJ ID, baca profil, lalu uji akses API.</p>
        {error && <p role="alert" className="error">{error}</p>}
        {loading ? <p role="status">Memeriksa sesi masuk...</p> : !user ? (
          <section aria-label="Masuk">
            <p>Belum ada sesi aktif. Masuk untuk melihat profil PNJ ID.</p>
            <a className="button" href="/auth/login">Masuk dengan PNJ ID</a>
            {error && <button type="button" onClick={loadSession}>Coba muat sesi lagi</button>}
          </section>
        ) : (
          <section aria-labelledby="profile-title">
            <h2 id="profile-title">{user.name ?? user.preferred_username ?? 'Pengguna PNJ'}</h2>
            <p>Profil dari endpoint UserInfo PNJ ID.</p>
            <dl>
              <dt>Subject</dt><dd>{user.sub ?? 'Tidak tersedia'}</dd>
              <dt>Email</dt><dd>{user.email || user.mail || 'Tidak dikirim oleh provider'}</dd>
              <dt>Username</dt><dd>{user.preferred_username ?? user.uid ?? 'Tidak tersedia'}</dd>
            </dl>
            <div className="actions">
              <button type="button" disabled={!!busy} onClick={() => showApiResult('/api/test-read')}>Lihat data test.read</button>
              <button type="button" disabled={!!busy} onClick={() => showApiResult('/api/backend-profile')}>Periksa akses backend</button>
              <button type="button" disabled={!!busy} onClick={logout}>Keluar</button>
            </div>
            {busy && <p role="status">{busy === 'logout' ? 'Mengakhiri sesi...' : 'Memuat data...'}</p>}
          </section>
        )}
        {result && <pre ref={resultView} tabIndex={0} aria-label="Respons API">{result}</pre>}
      </main>
      <footer>Scope: openid profile email test.read</footer>
    </>
  );
}
