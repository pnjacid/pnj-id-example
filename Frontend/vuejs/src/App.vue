<script setup>
import { nextTick, onMounted, ref } from 'vue';

const loading = ref(true);
const user = ref(null);
const error = ref('');
const busy = ref('');
const result = ref('');
const resultView = ref(null);

async function loadSession() {
  error.value = '';
  loading.value = true;
  try {
    const response = await fetch('/api/session');
    if (!response.ok) throw new Error('Sesi tidak dapat dimuat. Coba lagi.');
    const session = await response.json();
    user.value = session.authenticated ? session.user : null;
  } catch (failure) {
    error.value = failure.message;
  } finally {
    loading.value = false;
  }
}

async function showApiResult(url) {
  busy.value = url;
  error.value = '';
  result.value = '';
  try {
    const response = await fetch(url);
    const body = await response.json();
    result.value = JSON.stringify(body, null, 2);
    if (response.status === 401) await loadSession();
    await nextTick();
    resultView.value?.focus();
  } catch {
    error.value = 'Layanan data tidak dapat dihubungi. Coba lagi.';
  } finally {
    busy.value = '';
  }
}

async function logout() {
  busy.value = 'logout';
  error.value = '';
  try {
    const response = await fetch('/auth/logout', { method: 'POST' });
    if (!response.ok) throw new Error();
    const { logoutUrl } = await response.json();
    window.location.assign(logoutUrl);
  } catch {
    error.value = 'Sesi gagal dihapus. Coba keluar lagi.';
    busy.value = '';
  }
}

onMounted(loadSession);
</script>

<template>
  <main>
    <h1>Contoh OIDC dengan Vue</h1>
    <p>Login dengan PNJ ID, baca profil, lalu uji akses API.</p>
    <div v-if="error" role="alert" class="error">{{ error }}</div>
    <p v-if="loading" role="status">Memeriksa sesi masuk...</p>
    <section v-else-if="!user" aria-label="Masuk">
      <p>Belum ada sesi aktif. Masuk untuk melihat profil PNJ ID.</p>
      <a class="button" href="/auth/login">Masuk dengan PNJ ID</a>
      <button v-if="error" type="button" @click="loadSession">Coba muat sesi lagi</button>
    </section>
    <section v-else aria-labelledby="profile-title">
      <h2 id="profile-title">{{ user.name ?? user.preferred_username ?? 'Pengguna PNJ' }}</h2>
      <p>Profil dari endpoint UserInfo PNJ ID.</p>
      <dl>
        <dt>Subject</dt><dd>{{ user.sub ?? 'Tidak tersedia' }}</dd>
        <dt>Email</dt><dd>{{ user.email || user.mail || 'Tidak dikirim oleh provider' }}</dd>
        <dt>Username</dt><dd>{{ user.preferred_username ?? user.uid ?? 'Tidak tersedia' }}</dd>
      </dl>
      <div class="actions">
        <button type="button" :disabled="!!busy" @click="showApiResult('/api/test-read')">Lihat data test.read</button>
        <button type="button" :disabled="!!busy" @click="showApiResult('/api/backend-profile')">Periksa akses backend</button>
        <button type="button" :disabled="!!busy" @click="logout">Keluar</button>
      </div>
      <p v-if="busy" role="status">{{ busy === 'logout' ? 'Mengakhiri sesi...' : 'Memuat data...' }}</p>
    </section>
    <pre v-if="result" ref="resultView" tabindex="0" aria-label="Respons API">{{ result }}</pre>
  </main>
  <footer>Scope: openid profile email test.read</footer>
</template>
