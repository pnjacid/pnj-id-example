const loading = document.querySelector('#loading');
const signedOut = document.querySelector('#signed-out');
const signedIn = document.querySelector('#signed-in');
const errorView = document.querySelector('#error');
const result = document.querySelector('#backend-result');

function showError(message) {
  loading.hidden = true;
  errorView.textContent = `${message}. Muat ulang halaman untuk mencoba lagi.`;
  errorView.hidden = false;
}

async function loadSession() {
  try {
    const response = await fetch('/api/session');
    if (!response.ok) throw new Error('Sesi tidak dapat dimuat');
    const session = await response.json();
    loading.hidden = true;

    if (!session.authenticated) {
      signedOut.hidden = false;
      return;
    }

    const user = session.user;
    document.querySelector('#user-name').textContent = user.name ?? user.preferred_username ?? 'Pengguna PNJ';
    const fields = [['Subject', user.sub], ['Email', user.email ?? user.mail], ['Username', user.preferred_username ?? user.uid]];
    document.querySelector('#profile').replaceChildren(...fields.filter(([, value]) => value).flatMap(([label, value]) => {
      const term = document.createElement('dt');
      const description = document.createElement('dd');
      term.textContent = label;
      description.textContent = value;
      return [term, description];
    }));
    signedIn.hidden = false;
  } catch (error) {
    showError(error.message);
  }
}

async function showApiResult(event, url, loadingLabel) {
  const button = event.currentTarget;
  const label = button.textContent;
  button.disabled = true;
  button.textContent = loadingLabel;
  result.hidden = true;
  try {
    const response = await fetch(url);
    const body = await response.json();
    result.textContent = JSON.stringify(body, null, 2);
    result.hidden = false;
    result.focus();
  } catch {
    showError('Layanan data tidak dapat dihubungi');
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

document.querySelector('#test-read').addEventListener('click', event => showApiResult(event, '/api/test-read', 'Memuat data...'));
document.querySelector('#check-backend').addEventListener('click', event => showApiResult(event, '/api/backend-profile', 'Memeriksa akses...'));

document.querySelector('#logout').addEventListener('click', async event => {
  event.currentTarget.disabled = true;
  try {
    const response = await fetch('/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error();
    const { logoutUrl } = await response.json();
    location.assign(logoutUrl);
  } catch {
    event.currentTarget.disabled = false;
    showError('Sesi gagal dihapus');
  }
});

loadSession();
