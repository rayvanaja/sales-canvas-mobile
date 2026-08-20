// FITUR PENOMORAN VERSI: APP_VERSION harus SELALU sama dengan yang di
// dashboard (app.js) - satu angka untuk seluruh sistem. BUILD_NUMBER adalah
// placeholder yang ditanam OTOMATIS oleh build-apk.yml saat APK di-compile
// (diganti jadi nomor run GitHub Actions, mis. "18") - kalau dibuka lewat
// browser biasa (bukan APK), placeholder ini TIDAK pernah diganti, sehingga
// sengaja dideteksi & disembunyikan (lihat renderProfile).
const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '__BUILD_NUMBER__';

// ====== Escape HTML (K2) ======
// Wajib dipakai untuk SEMUA teks yang berasal dari database/pengguna (nama customer,
// alamat, telepon, nama produk, dst) sebelum ditempel ke innerHTML. Tanpa ini, siapa pun
// yang bisa mengetik nama customer bisa menjalankan kode di browser Direktur/Admin.
function esc(v) {
  if (v === null || v === undefined) return '';
  return String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

async function compressImage(file, maxDim = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    reader.onload = (e) => { img.src = e.target.result; };
    reader.onerror = () => reject(new Error('Gagal membaca file foto. Coba pilih ulang.'));
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxDim) { height = Math.round(height * (maxDim / width)); width = maxDim; }
      else if (height > maxDim) { width = Math.round(width * (maxDim / height)); height = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob || file), 'image/jpeg', quality);
    };
    img.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// ====== Konfigurasi ======
const IS_NATIVE_APP = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
const API = IS_NATIVE_APP ? 'https://canv.smart-outsource.my.id/api' : '/api';

// ====== State ======
function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('sc_user') || 'null');
  } catch (e) {
    // Data tersimpan rusak -> bersihkan supaya aplikasi tidak layar putih selamanya
    localStorage.removeItem('sc_user');
    return null;
  }
}

const state = {
  token: localStorage.getItem('sc_token') || null,
  user: readStoredUser(),
  customers: [],
  categories: [],
  products: [],
};

const app = document.getElementById('app');

// ====== Helper API ======
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  if (IS_NATIVE_APP) headers['X-Client-App'] = 'sales-canvas-apk';

  let res;
  try {
    res = await fetch(API + path, { ...options, headers });
  } catch (networkErr) {
    // FIX: fetch() yang gagal total (tidak ada sinyal/koneksi terputus) dulu
    // melempar pesan mentah teknis (mis. "Failed to fetch") yang membingungkan
    // sales di lapangan. Sekarang diterjemahkan ke pesan yang jelas - berlaku
    // untuk SEMUA pemanggilan api(), bukan cuma order.
    throw new Error('Tidak bisa terhubung ke server. Periksa sinyal internet Anda, lalu coba lagi.');
  }
  const data = await res.json().catch(() => ({}));

  if (data.appDisabled) {
    renderAppDisabledScreen();
    throw new Error(data.error || 'Aplikasi sedang dinonaktifkan sementara.');
  }

  if (res.status === 401 && state.token) {
    // Sesi login tidak valid/kedaluwarsa -> keluar otomatis, jangan biarkan
    // pengguna terjebak di layar error tanpa jalan keluar.
    localStorage.removeItem('sc_token');
    localStorage.removeItem('sc_user');
    state.token = null;
    state.user = null;
    navigate('#/home');
    render();
    throw new Error('Sesi login sudah berakhir. Silakan login ulang.');
  }

  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');
  return data;
}

function renderAppDisabledScreen() {
  app.innerHTML = `
    <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F7F5EE;padding:24px;">
      <div style="max-width:320px;text-align:center;">
        <div style="width:56px;height:56px;border-radius:16px;background:#052C1B;display:flex;align-items:center;justify-content:center;margin:0 auto 18px;">
          <span style="color:#fff;font-size:24px;">⏸</span>
        </div>
        <h2 style="font-family:'Trebuchet MS',sans-serif;font-size:18px;margin:0 0 8px;">Aplikasi Sedang Dinonaktifkan</h2>
        <p style="font-size:13px;color:#777;line-height:1.6;margin:0;">Sistem sedang dalam mode pemeliharaan sementara. Hubungi Admin untuk informasi lebih lanjut.</p>
      </div>
    </div>`;
}

// G7: dipakai untuk upload FormData (foto) dan download blob (PDF struk) -
// sebelumnya logika bikin header auth ditulis ulang 4 kali terpisah, dan
// tidak satu pun menangani sesi habis (401). Sekarang satu fungsi bersama,
// pemanggil tinggal urus body responsnya sendiri (json/blob) sesuai kebutuhan.
async function apiRaw(path, options = {}) {
  const headers = options.headers || {};
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
  if (IS_NATIVE_APP) headers['X-Client-App'] = 'sales-canvas-apk';

  let res;
  try {
    res = await fetch(API + path, { ...options, headers });
  } catch (networkErr) {
    throw new Error('Tidak bisa terhubung ke server. Periksa sinyal internet Anda, lalu coba lagi.');
  }

  if (res.status === 401 && state.token) {
    localStorage.removeItem('sc_token');
    localStorage.removeItem('sc_user');
    state.token = null;
    state.user = null;
    navigate('#/home');
    render();
    throw new Error('Sesi login sudah berakhir. Silakan login ulang.');
  }

  return res;
}

function formatRupiah(n) {
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

function formatJam(dateStr) {
  // A17: sebelumnya pakai getHours()/getMinutes() - itu jam ZONA WAKTU HP,
  // bisa salah kalau HP sales salah setel zona waktu. Server selalu WIB
  // (Asia/Jakarta), jadi tampilan dipaksa sama supaya konsisten.
  return new Date(dateStr).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false });
}

// Ambil lokasi GPS - otomatis pakai plugin Capacitor (APK) atau browser API (web)
// Deteksi root Tingkat 1 - lihat catatan lengkap di RootCheckPlugin.java.
// Hanya menambah skor risiko di server, tidak pernah dipakai memblokir di sini.
async function checkPossibleRoot() {
  try {
    if (IS_NATIVE_APP && window.Capacitor?.Plugins?.RootCheck) {
      const result = await window.Capacitor.Plugins.RootCheck.check();
      return result?.possibleRoot === true;
    }
  } catch (e) {
    // Plugin tidak tersedia (browser web, atau APK versi lama) - abaikan saja.
  }
  return false;
}

async function getCurrentLocation(onSuccess, onError) {
  if (IS_NATIVE_APP && window.Capacitor.Plugins.Geolocation) {
    try {
      const pos = await window.Capacitor.Plugins.Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 });
      onSuccess(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
    } catch (err) {
      onError(err.message || 'Izin lokasi ditolak');
    }
  } else {
    navigator.geolocation.getCurrentPosition(
      (pos) => onSuccess(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy),
      (err) => onError(err.message),
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }
}

// ====== Router ======
window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

function navigate(hash) { window.location.hash = hash; }

function render() {
  if (!state.token) { renderLogin(); return; }

  const hash = window.location.hash || '#/home';
  const parts = hash.replace('#/', '').split('/');

  if (parts[0] === 'home' || parts[0] === '') renderHome();
  else if (parts[0] === 'customer') renderCustomerDetail(parts[1]);
  else if (parts[0] === 'add-customer') renderAddCustomerForm();
  else if (parts[0] === 'edit-customer') renderEditCustomerForm(parts[1]);
  else if (parts[0] === 'checkin') renderCheckinForm(parts[1]);
  else if (parts[0] === 'order') renderOrderForm(parts[1], parts[2]);
  else if (parts[0] === 'receipt') renderReceipt(parts[1]);
  else if (parts[0] === 'history') renderHistory(parts[1] || 'kunjungan');
  else if (parts[0] === 'profile') renderProfile();
  else renderHome();
}

// ====== LOGIN ======
function renderLogin() {
  app.innerHTML = `
    <div style="height:100vh;display:flex;flex-direction:column;background:#ffffff;">
      <div style="position:relative;flex-shrink:0;height:298px;background:linear-gradient(160deg,#7AB41DEB,#FFE370EB,#057C43EB);display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;">
        <div style="position:absolute;inset:-40% -20% auto -20%;height:220px;background:radial-gradient(ellipse at center, oklch(85% 0.14 95 / 0.25), transparent 70%);pointer-events:none;"></div>
        <img src="assets/logo.png" alt="Damar Flour Mills" style="width:108px;height:auto;filter:drop-shadow(0 6px 16px rgba(0,0,0,0.28));margin-bottom:14px;">
        <div style="width:34px;height:2px;background:linear-gradient(90deg,#B57837,#FFE370);margin-bottom:12px;"></div>
        <div style="font-family:'Cormorant Garamond',serif;font-style:italic;font-weight:500;font-size:20px;color:#303030;text-align:center;padding:0 40px;line-height:1.4;">Tepung Pilihan, Untuk Cita Rasa Istimewa</div>
      </div>

      <div style="flex:1;background:#ffffff;border-radius:26px 26px 0 0;margin-top:-22px;padding:30px 24px 24px;display:flex;flex-direction:column;gap:16px;box-shadow:0 -8px 24px rgba(0,0,0,0.05);">
        <div>
          <div style="font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--text-muted);margin-bottom:7px;">Email</div>
          <input type="email" id="login-email" placeholder="nama@damarflourmills.co.id" style="width:100%;box-sizing:border-box;padding:13px 14px;border-radius:12px;border:1.5px solid var(--border-light);font-family:'Manrope',sans-serif;font-size:15px;color:var(--text-dark);outline:none;">
        </div>
        <div>
          <div style="font-size:12px;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;color:var(--text-muted);margin-bottom:7px;">Kata Sandi</div>
          <div style="position:relative;">
            <input type="password" id="login-password" placeholder="********" style="width:100%;box-sizing:border-box;padding:13px 44px 13px 14px;border-radius:12px;border:1.5px solid var(--border-light);font-family:'Manrope',sans-serif;font-size:15px;color:var(--text-dark);outline:none;">
          </div>
        </div>
        <div id="login-error"></div>
        <button id="login-submit-btn" style="width:100%;padding:15px;border:none;border-radius:12px;background:linear-gradient(135deg,#057C43,#0a5c33);color:#fff;font-family:'Manrope',sans-serif;font-weight:700;font-size:15px;letter-spacing:0.02em;cursor:pointer;box-shadow:0 8px 20px -6px rgba(5,124,67,0.55);margin-top:4px;">Masuk</button>
        <div style="flex:1;"></div>
        <div style="text-align:center;font-size:12px;color:var(--text-faint);">Butuh bantuan? Hubungi admin wilayah Anda.</div>
      </div>
    </div>
  `;

  document.getElementById('login-submit-btn').addEventListener('click', handleLogin);
  document.getElementById('login-password').addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(e); });

  // Cek proaktif SEBELUM sales sempat login - kalau aplikasi sedang
  // dinonaktifkan, langsung kasih tahu, jangan biarkan mereka bingung
  // kenapa login gagal terus.
  fetch(API + '/app-status').then(r => r.json()).then(d => {
    if (!d.enabled) {
      const errBox = document.getElementById('login-error');
      if (errBox) errBox.innerHTML = `<div class="error-box">Aplikasi sedang dalam mode pemeliharaan. Hubungi Admin.</div>`;
    }
  }).catch(() => {});
}

async function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorBox = document.getElementById('login-error');
  errorBox.innerHTML = '';

  try {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    state.token = data.token;
    state.user = data.user;
    localStorage.setItem('sc_token', data.token);
    localStorage.setItem('sc_user', JSON.stringify(data.user));
    navigate('#/home');
    render();
  } catch (err) {
    errorBox.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

function logout() {
  localStorage.removeItem('sc_token');
  localStorage.removeItem('sc_user');
  state.token = null;
  state.user = null;
  navigate('#/home');
  render();
}

// ====== TAB BAR ======
function tabBarHtml(active) {
  const tab = (key, label, hash) => `
    <button class="tab-item ${active === key ? 'active' : ''}" onclick="navigate('${hash}')">
      <span class="tab-dot"></span>
      <span>${label}</span>
    </button>`;
  return `
    <div class="tabbar">
      ${tab('home', 'Home', '#/home')}
      ${tab('history', 'Riwayat', '#/history')}
      ${tab('profile', 'Profil', '#/profile')}
    </div>`;
}

// ====== HOME ======
async function renderHome() {
  app.innerHTML = `<div style="padding:22px 20px;"><p style="color:var(--text-muted);font-size:14px;">Memuat...</p></div>${tabBarHtml('home')}`;

  if (state.user?.role === 'SALES') {
    getCurrentLocation((latitude, longitude) => {
      api('/users/me/location', { method: 'POST', body: JSON.stringify({ latitude, longitude }) }).catch(() => {});
    }, () => {});

    // FITUR NONAKTIF CUSTOMER: dipanggil setiap kali Home dibuka, tapi server
    // hanya mengirim nama yang BELUM pernah diberitahukan (lihat penanda
    // lastDeactivationCheckAt di backend) - jadi aman dipanggil berulang,
    // popup cuma muncul saat memang ada yang baru.
    api('/customers/notif/deactivation-notice').then((res) => {
      if (res.names && res.names.length) {
        alert(`Pemberitahuan:\n\n${res.names.length} customer Anda telah dinonaktifkan kantor pusat:\n${res.names.map(n => '• ' + n).join('\n')}\n\nCustomer ini sudah tidak muncul lagi di daftar Anda.`);
      }
    }).catch(() => {});
  }

  try {
    const [customers, visits, orders, messages] = await Promise.all([
      api('/customers'), api('/visits'), api('/orders').catch(() => []), api('/messages').catch(() => []),
    ]);
    state.customers = customers;

    const today = new Date().toDateString();
    const visitedTodayIds = new Set(
      visits.filter(v => new Date(v.checkinAt).toDateString() === today).map(v => v.customerId)
    );
    const visitedCount = visitedTodayIds.size;
    const totalCount = state.customers.length;
    const progressPct = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0;

    const revenueToday = orders
      .filter(o => new Date(o.createdAt).toDateString() === today)
      .reduce((sum, o) => sum + o.totalAmount, 0);

    // Kapan terakhir tiap customer dikunjungi - dipakai utk urutan prioritas,
    // supaya sales tahu harus ke mana dulu tanpa perlu buka menu lain.
    const lastVisitMap = {};
    visits.forEach(v => {
      const t = new Date(v.checkinAt).getTime();
      if (!lastVisitMap[v.customerId] || t > lastVisitMap[v.customerId]) lastVisitMap[v.customerId] = t;
    });
    const now = Date.now();
    const daysSinceVisit = (customerId) => {
      const last = lastVisitMap[customerId];
      return last ? Math.floor((now - last) / 86400000) : 9999; // belum pernah dikunjungi = paling prioritas
    };

    const golonganPalette = [
      { bg: 'oklch(93% 0.05 145 / 0.6)', color: '#057C43' },
      { bg: 'oklch(94% 0.09 120 / 0.55)', color: '#5c7a12' },
      { bg: '#FBEBD5', color: '#8a5c26' },
      { bg: '#EDEDEA', color: '#5c5c56' },
    ];
    const golonganColorMap = {};
    let colorIdx = 0;

    // Urutkan: yang sudah dikunjungi hari ini ke bawah, sisanya dari yang
    // paling lama tidak dikunjungi (paling perlu perhatian) ke atas.
    const sortedCustomers = [...state.customers].sort((a, b) => {
      const aVisited = visitedTodayIds.has(a.id);
      const bVisited = visitedTodayIds.has(b.id);
      if (aVisited !== bVisited) return aVisited ? 1 : -1;
      return daysSinceVisit(b.id) - daysSinceVisit(a.id);
    });

    const rows = sortedCustomers.map(c => {
      const visited = visitedTodayIds.has(c.id);
      const catName = c.category?.name || '-';
      if (!golonganColorMap[catName]) golonganColorMap[catName] = golonganPalette[colorIdx++ % golonganPalette.length];
      const gc = golonganColorMap[catName];
      const initials = c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      const avatarColors = ['#057C43', '#7AB41D', '#B57837', '#5661d6'];
      const avatarColor = avatarColors[Math.abs(c.name.charCodeAt(0)) % avatarColors.length];

      const days = daysSinceVisit(c.id);
      let priorityLabel = '';
      if (!visited) {
        if (days === 9999) priorityLabel = '<span style="font-size:10.5px;color:#B3261E;">Belum pernah dikunjungi</span>';
        else if (days >= 14) priorityLabel = `<span style="font-size:10.5px;color:#B3261E;">${days} hari tanpa kunjungan</span>`;
        else if (days >= 7) priorityLabel = `<span style="font-size:10.5px;color:#8a5c26;">${days} hari tanpa kunjungan</span>`;
      }

      return `
        <div onclick="navigate('#/customer/${c.id}')" style="display:flex;align-items:center;gap:11px;background:#fff;border:1px solid ${!visited && days >= 14 ? '#F0C4C0' : '#ECECEC'};border-radius:12px;padding:11px 13px;cursor:pointer;margin-bottom:9px;">
          <div style="width:38px;height:38px;border-radius:50%;background:${avatarColor};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">${initials}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(c.name)}</div>
            <div style="font-size:12px;color:#888888;">${esc(c.city?.name || '-')}</div>
            ${priorityLabel}
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
            <span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:20px;background:${gc.bg};color:${gc.color};">${esc(catName)}</span>
            <span style="font-size:10.5px;font-weight:700;color:${visited ? '#057C43' : '#B0AFA9'};">${visited ? 'Dikunjungi' : 'Belum'}</span>
          </div>
        </div>`;
    }).join('');

    // Broadcast dipindah jadi baris kecil (bukan banner besar) - supaya tidak
    // bersaing dengan tombol utama, tetap terlihat tanpa mendominasi layar.
    const broadcastHtml = messages && messages[0] ? `
      <div style="display:flex;align-items:center;gap:8px;padding:9px 12px;margin-bottom:14px;background:#F7F5EE;border-radius:10px;">
        <span style="width:6px;height:6px;border-radius:50%;background:#B57837;flex-shrink:0;"></span>
        <div style="font-size:12px;color:#5c5652;line-height:1.4;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;"><b>${esc(messages[0].fromName)}:</b> ${esc(messages[0].text)}</div>
      </div>` : '';

    app.innerHTML = `
      <div style="flex:1;overflow-y:auto;padding:22px 20px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
          <div>
            <div style="font-size:13px;color:#777777;">Selamat datang,</div>
            <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:20px;color:#1a1a1a;">${esc(state.user?.name || '')}</div>
          </div>
          <div style="font-size:12px;color:#999999;text-align:right;margin-top:4px;">${new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'short' })}</div>
        </div>

        <div style="background:linear-gradient(135deg,#057C43,#0a5c33);border-radius:16px;padding:18px 20px;margin-bottom:14px;color:#fff;box-shadow:0 10px 24px -10px rgba(5,124,67,0.5);">
          <div style="display:flex;justify-content:space-between;gap:12px;">
            <div>
              <div style="font-size:11px;letter-spacing:0.04em;text-transform:uppercase;opacity:0.85;margin-bottom:6px;">Kunjungan Hari Ini</div>
              <div style="display:flex;align-items:baseline;gap:6px;">
                <div style="font-family:'Trebuchet MS',sans-serif;font-size:26px;font-weight:700;">${visitedCount}</div>
                <div style="font-size:13px;opacity:0.85;">/ ${totalCount}</div>
              </div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:11px;letter-spacing:0.04em;text-transform:uppercase;opacity:0.85;margin-bottom:6px;">Revenue Hari Ini</div>
              <div style="font-family:'Trebuchet MS',sans-serif;font-size:26px;font-weight:700;">Rp${Math.round(revenueToday).toLocaleString('id-ID')}</div>
            </div>
          </div>
          <div style="height:6px;border-radius:3px;background:rgba(255,255,255,0.25);overflow:hidden;margin-top:12px;">
            <div style="height:100%;width:${progressPct}%;background:linear-gradient(90deg,#FFE370,#B57837);border-radius:3px;"></div>
          </div>
        </div>

        ${broadcastHtml}

        <div style="display:flex;gap:10px;margin-bottom:20px;">
          <button onclick="navigate('#/add-customer')" style="flex:1;padding:13px;border:none;border-radius:11px;background:#057C43;color:#fff;font-weight:700;font-size:13.5px;cursor:pointer;">+ Tambah Customer</button>
          <button onclick="showAiRecommendation()" style="flex:1;padding:13px;border:1.5px solid #B57837;border-radius:11px;background:#fff;color:#8a5c26;font-weight:700;font-size:13.5px;cursor:pointer;">Rekomendasi AI</button>
        </div>
        <div id="ai-recommendation-box" style="margin-bottom:14px;"></div>

        <div style="font-size:13px;font-weight:700;color:#303030;margin-bottom:10px;">Customer Anda (${totalCount})</div>
        <div>${rows || '<p style="color:#999;font-size:13px;">Belum ada customer ditugaskan ke Anda.</p>'}</div>
      </div>
      ${tabBarHtml('home')}
    `;
  } catch (err) {
    app.innerHTML = `<div style="padding:22px 20px;"><div class="error-box">${err.message}</div></div>${tabBarHtml('home')}`;
  }
}

async function showAiRecommendation() {
  const box = document.getElementById('ai-recommendation-box');
  box.innerHTML = `<div class="card"><p style="margin:0;font-size:13px;color:#8e8e93;">Menganalisa...</p></div>`;
  try {
    const data = await api('/ai/sales-recommendation', { method: 'POST' });
    // FITUR NONAKTIFKAN AI SALES: server mengembalikan disabled:true (bukan
    // error) saat fitur ini dimatikan Direktur/Admin - tampilkan keterangan
    // netral, bukan kotak error merah yang terkesan aplikasi rusak.
    if (data.disabled) {
      box.innerHTML = `<div class="card" style="background:#F5F6F5;border-color:#E4E4E4;"><p style="margin:0;font-size:13px;color:#777;">ℹ️ Fitur Rekomendasi AI sedang dinonaktifkan oleh Admin/Direktur.</p></div>`;
      return;
    }
    box.innerHTML = `<div class="card" style="white-space:pre-wrap;font-size:13px;line-height:1.6;">${esc(data.recommendation)}</div>`;
  } catch (err) {
    box.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

// ====== STRUK / BUKTI PESANAN ======
// FIX BUG-003: dulu window.open(blob URL) dipakai untuk buka PDF di tab baru
// saat APK - tapi blob URL tidak bisa diresolusi WebView Android sebagai
// "tab baru" sama sekali, jadi gagal DIAM-DIAM (tidak error, tidak apa-apa).
// Solusi resmi: tulis PDF ke penyimpanan HP lewat plugin Filesystem, lalu
// buka menu Bagikan Android bawaan (WhatsApp, Drive, printer, dst) lewat
// plugin Share - keduanya cara resmi Capacitor untuk kasus persis ini.
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      // reader.result = "data:application/pdf;base64,XXXX" - Filesystem
      // plugin cuma butuh bagian base64 setelah koma.
      resolve(String(reader.result).split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function openReceiptPdf(orderId) {
  const btn = document.getElementById('print-receipt-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyiapkan PDF...'; }
  try {
    const res = await apiRaw('/orders/' + orderId + '/receipt-pdf');
    if (!res.ok) throw new Error('Gagal membuat struk PDF.');
    const blob = await res.blob();
    const fileName = 'struk-' + orderId.slice(-6) + '.pdf';

    if (IS_NATIVE_APP && window.Capacitor?.Plugins?.Filesystem && window.Capacitor?.Plugins?.Share) {
      const base64Data = await blobToBase64(blob);
      const written = await window.Capacitor.Plugins.Filesystem.writeFile({
        path: fileName,
        data: base64Data,
        directory: 'CACHE', // tidak butuh izin penyimpanan tambahan
      });
      await window.Capacitor.Plugins.Share.share({
        title: 'Struk Pesanan',
        url: written.uri,
        dialogTitle: 'Simpan atau bagikan struk',
      });
    } else if (IS_NATIVE_APP) {
      // APK tapi plugin belum ter-sync (versi lama) - beri pesan jelas,
      // bukan diam-diam gagal seperti sebelumnya.
      throw new Error('Fitur simpan struk butuh update aplikasi terbaru. Silakan update APK Anda.');
    } else {
      // Browser web biasa (dashboard/mobile-web) - unduh langsung seperti biasa.
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
    }
  } catch (err) {
    alert(err.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Simpan Struk (PDF)'; }
  }
}

// Diset sesaat sebelum navigate ke #/receipt/... supaya tombol "kembali" di
// struk tahu harus balik ke mana (Home setelah order baru, atau Riwayat Order
// kalau dibuka dari sana).
let receiptReturnTo = '#/home';

async function renderReceipt(orderId) {
  app.innerHTML = `<div style="padding:22px 20px;"><p style="color:var(--text-muted);font-size:14px;">Memuat struk...</p></div>`;

  try {
    const o = await api('/orders/' + orderId);
    const orderNumber = 'SC-' + new Date(o.createdAt).toISOString().slice(0, 10).replace(/-/g, '') + '-' + o.id.slice(-4).toUpperCase();
    const tanggal = new Date(o.createdAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const payLabel = { CASH: 'Cash', TEMPO: 'Tempo', CONSIGNMENT: 'Konsinyasi' }[o.paymentMethod] || o.paymentMethod;

    const itemRows = o.items.map(it => `
      <div style="margin-bottom:5px;">
        <div>${esc(it.product.name)}</div>
        <div style="display:flex;justify-content:space-between;color:#555;">
          <span>${it.quantity} x ${formatRupiah(it.price)}</span><span>${formatRupiah(it.price * it.quantity)}</span>
        </div>
      </div>`).join('');

    app.innerHTML = `
      <div class="receipt-noprint" style="flex-shrink:0;display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid #ECECEC;background:#fff;">
        <button onclick="navigate('${receiptReturnTo}')" style="border:none;background:none;font-size:18px;color:#303030;cursor:pointer;">←</button>
        <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:16px;color:#1a1a1a;">Bukti Pesanan</div>
      </div>

      <div style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;align-items:center;">
        <div id="receipt-print-area" style="background:#fff;width:280px;padding:16px 14px;font-family:'Courier New',monospace;font-size:11.5px;color:#1a1a1a;border:1px solid #eee;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <div style="text-align:center;margin-bottom:10px;">
            <div style="font-weight:700;font-size:14px;letter-spacing:0.5px;">DAMAR FLOUR MILLS</div>
            <div style="font-size:10px;color:#555;">PT. Damar Ampat Sekawan</div>
            <div style="font-size:10px;color:#555;">Damarindo System</div>
          </div>
          <div style="border-top:1px dashed #999;margin:8px 0;"></div>
          <div style="text-align:center;font-weight:700;font-size:12px;margin-bottom:6px;">BUKTI PESANAN</div>
          <div>No. Order : ${orderNumber}</div>
          <div>Tanggal&nbsp;&nbsp;: ${tanggal}</div>
          <div>Sales&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${esc(o.sales.name)}</div>
          <div style="border-top:1px dashed #999;margin:8px 0;"></div>
          <div style="font-weight:700;">Customer:</div>
          <div>${esc(o.customer.name)}</div>
          <div style="color:#555;">${esc(o.customer.address)}</div>
          <div style="color:#555;">${esc(o.customer.city.name)}, ${esc(o.customer.city.province.name)}</div>
          <div style="border-top:1px dashed #999;margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;margin-bottom:4px;"><span>Item</span><span>Subtotal</span></div>
          ${itemRows}
          <div style="border-top:1px dashed #999;margin:8px 0;"></div>
          <div style="display:flex;justify-content:space-between;font-weight:700;font-size:13px;"><span>TOTAL</span><span>${formatRupiah(o.totalAmount)}</span></div>
          <div style="display:flex;justify-content:space-between;margin-top:4px;"><span>Metode Bayar</span><span>${payLabel}</span></div>
          <div style="border-top:1px dashed #999;margin:8px 0;"></div>
          <div style="text-align:center;font-size:10px;color:#555;">Bukti ini sah tanpa tanda tangan.<br>Terima kasih atas pesanan Anda.</div>
        </div>

        <div class="receipt-noprint" style="width:280px;margin-top:16px;display:flex;flex-direction:column;gap:10px;">
          <button id="print-receipt-btn" onclick="openReceiptPdf('${o.id}')" style="width:100%;padding:13px;border:none;border-radius:11px;background:#057C43;color:#fff;font-weight:700;font-size:13.5px;cursor:pointer;">Simpan Struk (PDF)</button>
          <button onclick="navigate('#/home')" style="width:100%;padding:13px;border:1.5px solid #D8D8D8;border-radius:11px;background:#fff;color:#303030;font-weight:700;font-size:13.5px;cursor:pointer;">Kembali ke Home</button>
        </div>
      </div>
    `;
  } catch (err) {
    app.innerHTML = `<div style="padding:20px;"><div class="error-box">${err.message}</div></div>`;
  }
}

// ====== DETAIL CUSTOMER ======
function navHeaderHtml(title, backHash) {
  return `
    <div style="flex-shrink:0;display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid #ECECEC;background:#fff;">
      <button onclick="navigate('${backHash}')" style="border:none;background:none;font-size:18px;color:#303030;cursor:pointer;">←</button>
      <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:16px;color:#1a1a1a;">${esc(title)}</div>
    </div>`;
}

async function renderCustomerDetail(customerId) {
  app.innerHTML = navHeaderHtml('Memuat...', '#/home');

  try {
    const c = await api('/customers/' + customerId);
    const initials = c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    const historyRows = (c.visits || []).slice(0, 5).map(v => `
      <div style="display:flex;justify-content:space-between;background:#fff;border:1px solid #ECECEC;border-radius:10px;padding:10px 13px;font-size:12.5px;margin-bottom:8px;">
        <span style="color:#303030;">${new Date(v.checkinAt).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}</span>
        <span style="color:#888888;">${formatJam(v.checkinAt)}</span>
      </div>`).join('') || '<p style="color:#999;font-size:13px;">Belum ada riwayat kunjungan.</p>';

    app.innerHTML = `
      ${navHeaderHtml('Detail Customer', '#/home')}
      <div style="flex:1;overflow-y:auto;padding:20px;">
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:18px;">
          ${c.photoUrl ? `<img src="${API}${c.photoUrl}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;margin-bottom:10px;">` : `<div style="width:72px;height:72px;border-radius:50%;background:#057C43;color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:24px;margin-bottom:10px;">${initials}</div>`}
          <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:18px;color:#1a1a1a;">${esc(c.name)}</div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:oklch(93% 0.05 145 / 0.6);color:#057C43;">${esc(c.category?.name || '-')}</span>
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${c.verified ? 'oklch(93% 0.05 145 / 0.6)' : '#FBEBD5'};color:${c.verified ? '#057C43' : '#8a5c26'};">${c.verified ? 'Aktif' : 'Menunggu Approval'}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:1px;background:#ECECEC;border-radius:12px;overflow:hidden;margin-bottom:18px;">
          <div style="background:#fff;padding:13px 15px;"><div style="font-size:11px;color:#999999;margin-bottom:3px;">Alamat</div><div style="font-size:13.5px;color:#303030;">${esc(c.address)}, ${esc(c.city?.name || '-')}, ${esc(c.city?.province?.name || '-')}</div></div>
          <div style="background:#fff;padding:13px 15px;"><div style="font-size:11px;color:#999999;margin-bottom:3px;">No. Telepon</div><div style="font-size:13.5px;color:#303030;">${esc(c.phone)}</div></div>
          <div style="background:#fff;padding:13px 15px;"><div style="font-size:11px;color:#999999;margin-bottom:3px;">Sales Bertanggung Jawab</div><div style="font-size:13.5px;color:#303030;">${esc(c.sales?.name || '-')}</div></div>
        </div>
        <div style="display:flex;gap:10px;margin-bottom:20px;">
          <button onclick="navigate('#/checkin/${c.id}')" style="flex:1;padding:13px;border:none;border-radius:11px;background:#057C43;color:#fff;font-weight:700;font-size:13.5px;cursor:pointer;">Check-in</button>
          <button onclick="navigate('#/edit-customer/${c.id}')" style="flex:1;padding:13px;border:1.5px solid #D8D8D8;border-radius:11px;background:#fff;color:#303030;font-weight:700;font-size:13.5px;cursor:pointer;">Edit</button>
        </div>
        <button onclick="navigate('#/order/${c.id}/none')" style="width:100%;padding:13px;border:1.5px solid #B57837;border-radius:11px;background:#fff;color:#8a5c26;font-weight:700;font-size:13.5px;cursor:pointer;margin-bottom:20px;">Buat Pesanan</button>
        <div style="font-size:13px;font-weight:700;color:#303030;margin-bottom:10px;">Riwayat Kunjungan Singkat</div>
        ${historyRows}
      </div>
    `;
  } catch (err) {
    app.innerHTML = `${navHeaderHtml('Detail Customer', '#/home')}<div style="padding:20px;"><div class="error-box">${err.message}</div></div>`;
  }
}

// ====== TAMBAH CUSTOMER ======
let addCustomerLocation = null;

async function loadCityOptions(provinceSelectId, citySelectId, selectedCityId) {
  const provinceId = document.getElementById(provinceSelectId).value;
  const citySelect = document.getElementById(citySelectId);
  if (!provinceId) {
    citySelect.innerHTML = '<option value="">Pilih provinsi dulu</option>';
    return;
  }
  citySelect.innerHTML = '<option value="">Memuat...</option>';
  try {
    const cities = await api('/regions/cities?provinceId=' + provinceId);
    citySelect.innerHTML = '<option value="">Pilih kota</option>' + cities.map(c => `<option value="${c.id}" ${c.id === selectedCityId ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
  } catch (err) {
    citySelect.innerHTML = '<option value="">Gagal memuat kota</option>';
  }
}

async function renderAddCustomerForm() {
  isSubmittingNewCustomer = false;
  flaggedInactiveCandidateId = null;
  app.innerHTML = `<div class="topbar-nav"><button class="back-btn" onclick="navigate('#/home')">‹</button><p class="title">Memuat...</p></div>`;

  try {
    const [categories, provinces] = await Promise.all([api('/customer-categories'), api('/regions/provinces')]);
    state.categories = categories;

    const categoryOptions = categories.map(cat => `<option value="${cat.id}">${esc(cat.name)}</option>`).join('');
    const provinceOptions = provinces.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('');
    const fieldLabel = (text) => `<div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#777777;margin-bottom:6px;">${text}</div>`;
    const inputStyle = `width:100%;box-sizing:border-box;padding:12px 13px;border-radius:11px;border:1.5px solid #E4E4E4;font-family:'Manrope',sans-serif;font-size:14.5px;color:#303030;`;

    app.innerHTML = `
      ${navHeaderHtml('Tambah Customer', '#/home')}
      <div style="flex:1;overflow-y:auto;padding:18px 20px;">
        <div id="gps-status" style="display:inline-flex;align-items:center;gap:7px;background:oklch(93% 0.05 145 / 0.5);color:#057C43;font-size:12px;font-weight:700;padding:7px 12px;border-radius:20px;margin-bottom:16px;">
          Mengambil lokasi GPS Anda...
        </div>

        <div style="display:flex;flex-direction:column;gap:13px;">
          <div>
            ${fieldLabel('Golongan')}
            <select id="new-customer-category" style="${inputStyle}background:#fff;">${categoryOptions || '<option value="">Belum ada golongan</option>'}</select>
          </div>
          <div>
            ${fieldLabel('Nama Customer')}
            <input type="text" id="new-customer-name" placeholder="Nama toko / usaha" style="${inputStyle}">
          </div>
          <div id="candidate-list"></div>
          <div>
            ${fieldLabel('Alamat')}
            <textarea id="new-customer-address" placeholder="Jalan, nomor, RT/RW" rows="2" style="${inputStyle}resize:none;"></textarea>
          </div>
          <div style="display:flex;gap:10px;">
            <div style="flex:1;">
              ${fieldLabel('Provinsi')}
              <select id="new-customer-province" style="${inputStyle}background:#fff;" onchange="loadCityOptions('new-customer-province','new-customer-city')">
                <option value="">Pilih provinsi</option>${provinceOptions}
              </select>
            </div>
            <div style="flex:1;">
              ${fieldLabel('Kota/Kab')}
              <select id="new-customer-city" style="${inputStyle}background:#fff;">
                <option value="">Pilih provinsi dulu</option>
              </select>
            </div>
          </div>
          <div>
            ${fieldLabel('No. Telepon')}
            <input type="tel" id="new-customer-phone" placeholder="08xx xxxx xxxx" style="${inputStyle}">
          </div>
          <label for="new-customer-photo" id="photo-drop-label" style="border:1.5px dashed #C9C9C9;border-radius:12px;padding:22px;text-align:center;cursor:pointer;color:#999999;font-size:13px;font-weight:600;display:block;">Ketuk untuk ambil/pilih foto (wajib)</label>
          <input type="file" id="new-customer-photo" accept="image/*" capture="environment" style="display:none;">

          <div id="add-customer-error"></div>
          <button id="check-customer-btn" disabled style="width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#057C43,#0a5c33);color:#fff;font-weight:700;font-size:14.5px;cursor:pointer;margin-top:6px;">Mengambil lokasi...</button>
        </div>
      </div>
    `;

    document.getElementById('new-customer-photo').addEventListener('change', (e) => {
      const label = document.getElementById('photo-drop-label');
      if (e.target.files[0]) { label.textContent = 'Foto dipilih: ' + e.target.files[0].name; label.style.color = '#057C43'; }
    });

    getCurrentLocation(
      (latitude, longitude, accuracy) => {
        addCustomerLocation = { latitude, longitude, accuracy };
        document.getElementById('gps-status').innerHTML = 'Lokasi terkunci';
        const btn = document.getElementById('check-customer-btn');
        btn.disabled = false;
        btn.textContent = 'Lanjut';
        btn.onclick = checkNearbyBeforeSubmit;
      },
      (errMessage) => {
        document.getElementById('gps-status').outerHTML = `<div class="error-box">Gagal mengambil lokasi: ${errMessage}. Aktifkan izin lokasi lalu coba lagi.</div>`;
      }
    );
  } catch (err) {
    app.innerHTML = `${navHeaderHtml('Tambah Customer', '#/home')}<div style="padding:20px;"><div class="error-box">${err.message}</div></div>`;
  }
}

async function checkNearbyBeforeSubmit() {
  const name = document.getElementById('new-customer-name').value.trim();
  const address = document.getElementById('new-customer-address').value.trim();
  const provinceId = document.getElementById('new-customer-province').value;
  const cityId = document.getElementById('new-customer-city').value;
  const phone = document.getElementById('new-customer-phone').value.trim();
  const photoInput = document.getElementById('new-customer-photo');
  const errorBox = document.getElementById('add-customer-error');
  errorBox.innerHTML = '';

  if (!name || !address || !provinceId || !cityId || !phone) {
    errorBox.innerHTML = `<div class="error-box">Semua field wajib diisi.</div>`;
    return;
  }
  if (!photoInput.files[0]) {
    errorBox.innerHTML = `<div class="error-box">Foto customer wajib diisi.</div>`;
    return;
  }
  if (!addCustomerLocation) {
    errorBox.innerHTML = `<div class="error-box">Lokasi GPS belum siap, tunggu sebentar.</div>`;
    return;
  }

  const btn = document.getElementById('check-customer-btn');
  btn.disabled = true;
  btn.textContent = 'Mengecek customer sekitar...';

  try {
    const { latitude, longitude } = addCustomerLocation;
    const result = await api(`/customers/nearby-check?latitude=${latitude}&longitude=${longitude}&name=${encodeURIComponent(name)}`);

    if (result.candidates && result.candidates.length > 0) {
      renderCandidateList(result.candidates);
    } else {
      await submitNewCustomer();
    }
  } catch (err) {
    errorBox.innerHTML = `<div class="error-box">${err.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Lanjut';
  }
}

// FITUR PERINGATAN DUPLIKAT: disimpan supaya submitNewCustomer tahu ID kandidat
// nonaktif yang sempat dilihat sales, untuk dikirim ke server sebagai catatan
// yang nanti ditinjau TL/Manager di layar Approval.
let flaggedInactiveCandidateId = null;

function renderCandidateList(candidates) {
  const btn = document.getElementById('check-customer-btn');
  btn.style.display = 'none';

  // Backend sudah mengurutkan kandidat nonaktif lebih dulu - ambil yang
  // pertama kalau memang berstatus nonaktif.
  flaggedInactiveCandidateId = candidates.find(c => c.active === false)?.id || null;

  const rows = candidates.map(c => {
    const nonaktif = c.active === false;
    return `
    <div style="background:#fff;border:1.5px solid ${nonaktif ? '#E3B0AC' : '#eee'};border-radius:9px;padding:10px;margin-bottom:8px;">
      <div style="display:flex;align-items:center;gap:10px;">
        ${c.photoUrl ? `<img src="${API}${c.photoUrl}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : `<div style="width:30px;height:30px;border-radius:50%;background:#8a5c26;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${c.name.slice(0,2).toUpperCase()}</div>`}
        <div style="flex:1;">
          <div style="font-size:12.5px;font-weight:700;color:#1a1a1a;">${esc(c.name)}</div>
          <div style="font-size:11px;color:#999999;">± ${c.distanceMeters}m dari lokasi ini</div>
          ${nonaktif ? `<span style="display:inline-block;margin-top:3px;font-size:9.5px;font-weight:700;padding:2px 7px;border-radius:20px;background:#FBEAE9;color:#B3261E;">NONAKTIF</span>` : ''}
        </div>
        <button onclick="navigate('#/edit-customer/${c.id}')" style="width:auto;border:none;background:#8a5c26;color:#fff;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">Ini sama</button>
      </div>
      ${nonaktif ? `<div style="margin-top:8px;padding:8px 9px;background:#FBEAE9;border-radius:8px;font-size:11px;color:#7A241E;line-height:1.5;">⚠ <b>Toko ini sedang dinonaktifkan</b> kantor pusat. Kemungkinan besar ini toko yang sama — pastikan dulu sebelum lanjut mendaftarkan sebagai toko baru.</div>` : ''}
    </div>`;
  }).join('');

  document.getElementById('candidate-list').innerHTML = `
    <div style="background:#FFF6DF;border:1px solid #F0D9A6;border-radius:11px;padding:11px 13px;">
      <div style="font-size:12px;font-weight:700;color:#8a5c24;margin-bottom:8px;">Kandidat duplikat terdeteksi</div>
      ${rows}
      <button id="confirm-different-customer-btn" onclick="submitNewCustomer()" style="width:100%;margin-top:4px;border:1.5px solid #8a5c26;background:#fff;color:#8a5c26;border-radius:8px;padding:9px;font-size:12.5px;font-weight:700;cursor:pointer;">Bukan, ini customer berbeda — lanjut tambah</button>
    </div>
  `;
}

let isSubmittingNewCustomer = false;

async function submitNewCustomer() {
  if (isSubmittingNewCustomer) return; // cegah customer kembar akibat klik ganda
  isSubmittingNewCustomer = true;

  const categoryId = document.getElementById('new-customer-category').value;
  const name = document.getElementById('new-customer-name').value.trim();
  const address = document.getElementById('new-customer-address').value.trim();
  const cityId = document.getElementById('new-customer-city').value;
  const phone = document.getElementById('new-customer-phone').value.trim();
  const photoFile = document.getElementById('new-customer-photo').files[0];
  const errorBox = document.getElementById('add-customer-error');
  errorBox.innerHTML = '';

  const submitBtn = document.getElementById('confirm-different-customer-btn');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Menyimpan...'; }

  try {
    const formData = new FormData();
    formData.append('categoryId', categoryId);
    formData.append('name', name);
    formData.append('address', address);
    formData.append('cityId', cityId);
    formData.append('phone', phone);
    formData.append('latitude', addCustomerLocation.latitude);
    formData.append('longitude', addCustomerLocation.longitude);
    if (addCustomerLocation.accuracy !== undefined) formData.append('accuracy', addCustomerLocation.accuracy);
    formData.append('possibleRoot', await checkPossibleRoot());
    // FITUR PERINGATAN DUPLIKAT: kalau sales sempat melihat kandidat nonaktif
    // tapi tetap lanjut, ID-nya diikutkan supaya server bisa mencatat untuk
    // ditinjau ulang TL/Manager di layar Approval.
    if (flaggedInactiveCandidateId) formData.append('similarToInactiveId', flaggedInactiveCandidateId);
    const compressedPhoto = await compressImage(photoFile);
    formData.append('photo', compressedPhoto, 'photo.jpg');

    const res = await apiRaw('/customers', { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');

    flaggedInactiveCandidateId = null;
    navigate('#/home');
  } catch (err) {
    errorBox.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Bukan, ini customer berbeda — lanjut tambah'; }
    isSubmittingNewCustomer = false;
  }
}

// ====== EDIT CUSTOMER ======
async function renderEditCustomerForm(customerId) {
  app.innerHTML = `<div class="topbar-nav"><button class="back-btn" onclick="navigate('#/customer/${customerId}')">‹</button><p class="title">Memuat...</p></div>`;

  try {
    const [c, categories, provinces] = await Promise.all([api('/customers/' + customerId), api('/customer-categories'), api('/regions/provinces')]);

    const categoryOptions = categories.map(cat =>
      `<option value="${cat.id}" ${cat.id === c.categoryId ? 'selected' : ''}>${esc(cat.name)}</option>`
    ).join('');
    const currentProvinceId = c.city?.provinceId || c.city?.province?.id || '';
    const provinceOptions = provinces.map(p => `<option value="${p.id}" ${p.id === currentProvinceId ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
    const fieldLabel = (text) => `<div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#777777;margin-bottom:6px;">${text}</div>`;
    const inputStyle = `width:100%;box-sizing:border-box;padding:12px 13px;border-radius:11px;border:1.5px solid #E4E4E4;font-family:'Manrope',sans-serif;font-size:14.5px;color:#303030;`;

    app.innerHTML = `
      ${navHeaderHtml('Edit Customer', '#/customer/' + customerId)}
      <div style="flex:1;overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:13px;">
        <div>${fieldLabel('Golongan')}<select id="edit-customer-category" style="${inputStyle}background:#fff;">${categoryOptions}</select></div>
        <div>${fieldLabel('Nama Customer')}<input type="text" id="edit-customer-name" value="${esc(c.name)}" style="${inputStyle}"></div>
        <div>${fieldLabel('Alamat')}<textarea id="edit-customer-address" rows="2" style="${inputStyle}resize:none;">${esc(c.address || '')}</textarea></div>
        <div style="display:flex;gap:10px;">
          <div style="flex:1;">
            ${fieldLabel('Provinsi')}
            <select id="edit-customer-province" style="${inputStyle}background:#fff;" onchange="loadCityOptions('edit-customer-province','edit-customer-city')">
              <option value="">Pilih provinsi</option>${provinceOptions}
            </select>
          </div>
          <div style="flex:1;">
            ${fieldLabel('Kota/Kab')}
            <select id="edit-customer-city" style="${inputStyle}background:#fff;">
              <option value="">Memuat...</option>
            </select>
          </div>
        </div>
        <div>${fieldLabel('No. Telepon')}<input type="tel" id="edit-customer-phone" value="${esc(c.phone || '')}" style="${inputStyle}"></div>
        <label for="edit-customer-photo" id="edit-photo-drop-label" style="border:1.5px dashed #C9C9C9;border-radius:12px;padding:22px;text-align:center;cursor:pointer;color:#999999;font-size:13px;font-weight:600;display:block;">${c.photoUrl ? 'Foto tersimpan · ketuk untuk ganti' : 'Ketuk untuk ambil/pilih foto'}</label>
        <input type="file" id="edit-customer-photo" accept="image/*" capture="environment" style="display:none;">
        <div id="edit-customer-error"></div>
        <button id="save-customer-btn" style="width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#057C43,#0a5c33);color:#fff;font-weight:700;font-size:14.5px;cursor:pointer;margin-top:6px;">Simpan Perubahan</button>
      </div>
    `;

    if (currentProvinceId) await loadCityOptions('edit-customer-province', 'edit-customer-city', c.cityId);

    document.getElementById('edit-customer-photo').addEventListener('change', (e) => {
      const label = document.getElementById('edit-photo-drop-label');
      if (e.target.files[0]) { label.textContent = 'Foto dipilih: ' + e.target.files[0].name; label.style.color = '#057C43'; }
    });
    document.getElementById('save-customer-btn').addEventListener('click', () => submitEditCustomer(customerId));
  } catch (err) {
    app.innerHTML = `${navHeaderHtml('Edit Customer', '#/home')}<div style="padding:20px;"><div class="error-box">${err.message}</div></div>`;
  }
}

async function submitEditCustomer(customerId) {
  const categoryId = document.getElementById('edit-customer-category').value;
  const name = document.getElementById('edit-customer-name').value.trim();
  const address = document.getElementById('edit-customer-address').value.trim();
  const cityId = document.getElementById('edit-customer-city').value;
  const phone = document.getElementById('edit-customer-phone').value.trim();
  const photoFile = document.getElementById('edit-customer-photo').files[0];
  const errorBox = document.getElementById('edit-customer-error');
  errorBox.innerHTML = '';

  const formData = new FormData();
  formData.append('categoryId', categoryId);
  formData.append('name', name);
  formData.append('address', address);
  formData.append('cityId', cityId);
  formData.append('phone', phone);

  const btn = document.getElementById('save-customer-btn');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    if (photoFile) {
      const compressedPhoto = await compressImage(photoFile);
      formData.append('photo', compressedPhoto, 'photo.jpg');
    }

    const res = await apiRaw('/customers/' + customerId, { method: 'PUT', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');

    navigate('#/customer/' + customerId);
  } catch (err) {
    errorBox.innerHTML = `<div class="error-box">${esc(err.message)}</div>`;
    btn.disabled = false;
    btn.textContent = 'Simpan perubahan';
  }
}

// ====== CHECK-IN ======
function renderCheckinForm(customerId) {
  const customer = state.customers.find(c => c.id === customerId);
  app.innerHTML = `
    ${navHeaderHtml('Check-in', '#/customer/' + customerId)}
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;gap:20px;">
      <div style="width:90px;height:90px;border-radius:50%;background:oklch(93% 0.05 145 / 0.5);display:flex;align-items:center;justify-content:center;">
        <div id="checkin-pulse" style="width:52px;height:52px;border-radius:50%;background:#057C43;animation:damarPulse 2s infinite;"></div>
      </div>
      <div style="text-align:center;">
        <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:17px;color:#1a1a1a;margin-bottom:6px;">${esc(customer ? customer.name : 'Customer')}</div>
        <div id="checkin-accuracy" style="font-size:13px;color:#777777;">Mengambil lokasi GPS Anda...</div>
      </div>
      <div id="checkin-status"></div>
      <button id="checkin-btn" disabled style="width:100%;padding:15px;border:none;border-radius:12px;background:linear-gradient(135deg,#057C43,#0a5c33);color:#fff;font-weight:700;font-size:14.5px;cursor:pointer;opacity:0.6;">Mengambil lokasi...</button>
    </div>
    <style>@keyframes damarPulse { 0%,100%{transform:scale(1);opacity:1;} 50%{transform:scale(1.15);opacity:0.7;} }</style>
  `;

  getCurrentLocation(
    (latitude, longitude, accuracy) => {
      document.getElementById('checkin-accuracy').textContent = `Akurasi lokasi · ${Math.round(accuracy)} meter`;
      const btn = document.getElementById('checkin-btn');
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.textContent = 'Konfirmasi Check-in';
      btn.onclick = () => doCheckin(customerId, latitude, longitude, accuracy);
    },
    (errMessage) => {
      document.getElementById('checkin-status').innerHTML = `<div class="error-box">Gagal mengambil lokasi: ${errMessage}. Pastikan izin lokasi diaktifkan.</div>`;
    }
  );
}

async function doCheckin(customerId, latitude, longitude, accuracy) {
  const btn = document.getElementById('checkin-btn');
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    const possibleRoot = await checkPossibleRoot();
    const result = await api('/visits/checkin', {
      method: 'POST',
      body: JSON.stringify({ customerId, latitude, longitude, accuracy, possibleRoot }),
    });

    document.getElementById('checkin-status').innerHTML = `
      <div style="padding:11px 18px;border-radius:10px;background:oklch(93% 0.05 145 / 0.5);color:#057C43;font-size:13px;font-weight:700;">Check-in berhasil dicatat</div>`;

    setTimeout(() => navigate(`#/order/${customerId}/${result.visit.id}`), 900);
  } catch (err) {
    document.getElementById('checkin-status').innerHTML = `<div class="error-box">${err.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Coba lagi';
  }
}

// ====== INPUT ORDER ======
// LAPIS 1 ANTI-DUPLIKAT: dibuat SEKALI saat form order dibuka, bukan setiap
// tombol ditekan. Kalau sales terpaksa tekan "Kirim Pesanan" berkali-kali
// karena sinyal jelek, kode ini tetap sama di setiap percobaan - server
// memakainya untuk tahu "ini pengiriman ulang dari order yang sama" dan
// tidak akan pernah membuat order kembar walau permintaannya terkirim >1 kali.
let currentOrderClientId = null;
function buatKodeUnik() {
  if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
  // Fallback untuk WebView lama yang belum dukung crypto.randomUUID().
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

async function renderOrderForm(customerId, visitId) {
  currentOrderClientId = buatKodeUnik();
  const customer = state.customers.find(c => c.id === customerId);
  app.innerHTML = navHeaderHtml('Memuat produk...', '#/customer/' + customerId);

  try {
    const products = await api('/products');
    state.products = products;

    const rows = products.map(p => {
      const tierInfo = (p.priceTiers && p.priceTiers.length > 0)
        ? `<div style="font-size:10.5px;color:#B57837;margin-top:2px;">Grosir: ${p.priceTiers.map(t => `≥${t.minQty}=${formatRupiah(t.price)}`).join(', ')}</div>`
        : '';
      return `
      <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #ECECEC;border-radius:12px;padding:11px 13px;margin-bottom:9px;">
        <div>
          <div style="font-size:13.5px;font-weight:700;color:#1a1a1a;">${esc(p.name)}</div>
          <div id="unit-price-${p.id}" style="font-size:12px;color:#888888;">${formatRupiah(p.price)} / ${esc(p.unit)}</div>
          ${tierInfo}
        </div>
        <div style="display:flex;align-items:center;gap:9px;">
          <button type="button" onclick="stepQty('${p.id}',-1)" style="width:26px;height:26px;border-radius:50%;border:1px solid #D8D8D8;background:#fff;font-weight:700;cursor:pointer;">-</button>
          <div id="qty-${p.id}" data-product-id="${p.id}" class="qty-value" style="width:20px;text-align:center;font-weight:700;font-size:14px;">0</div>
          <button type="button" onclick="stepQty('${p.id}',1)" style="width:26px;height:26px;border-radius:50%;border:none;background:#057C43;color:#fff;font-weight:700;cursor:pointer;">+</button>
        </div>
      </div>`;
    }).join('');

    const payBtn = (val, label) => `<button type="button" data-pay="${val}" onclick="setPayMethod('${val}')" class="pay-method-btn" style="flex:1;padding:11px;border-radius:10px;font-size:12.5px;font-weight:700;cursor:pointer;border:1.5px solid #E4E4E4;background:#fff;color:#555;">${label}</button>`;

    app.innerHTML = `
      ${navHeaderHtml('Input Order · ' + (customer ? customer.name : ''), '#/customer/' + customerId)}
      <div style="flex:1;overflow-y:auto;padding:18px 20px;">
        <div style="margin-bottom:18px;">${rows || '<p style="color:#999;font-size:13px;">Belum ada produk terdaftar.</p>'}</div>

        <div style="font-size:13px;font-weight:700;color:#303030;margin-bottom:10px;">Metode Pembayaran</div>
        <div style="display:flex;gap:8px;margin-bottom:20px;">
          ${payBtn('CASH', 'Cash')}${payBtn('TEMPO', 'Tempo')}${payBtn('CONSIGNMENT', 'Konsinyasi')}
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;background:#F7F7F5;border-radius:12px;padding:14px 16px;margin-bottom:18px;">
          <div style="font-size:13px;color:#777777;">Total Pesanan</div>
          <div id="order-total" style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:19px;color:#057C43;">Rp0</div>
        </div>

        <div id="order-error"></div>
        <button id="submit-order-btn" style="width:100%;padding:15px;border:none;border-radius:12px;background:linear-gradient(135deg,#057C43,#0a5c33);color:#fff;font-weight:700;font-size:14.5px;cursor:pointer;">Kirim Pesanan</button>
        ${visitId && visitId !== 'none' ? `<button id="finish-no-order-btn" type="button" onclick="finishVisitWithoutOrder('${customerId}','${visitId}')" style="width:100%;margin-top:10px;padding:13px;border:1.5px solid #D8D8D8;border-radius:12px;background:#fff;color:#555;font-weight:700;font-size:13px;cursor:pointer;">Kunjungan tanpa order — selesai</button>` : ''}
      </div>
    `;

    state.selectedPayMethod = 'CASH';
    setPayMethod('CASH');
    document.getElementById('submit-order-btn').addEventListener('click', () => submitOrder(customerId, visitId));
  } catch (err) {
    app.innerHTML = `${navHeaderHtml('Input Order', '#/customer/' + customerId)}<div style="padding:20px;"><div class="error-box">${err.message}</div></div>`;
  }
}

function resolveTierPrice(product, qty) {
  if (!product.priceTiers) return product.price;
  const sorted = [...product.priceTiers].sort((a, b) => b.minQty - a.minQty);
  const applicable = sorted.find(t => t.minQty <= qty);
  return applicable ? applicable.price : product.price;
}

function stepQty(productId, delta) {
  const el = document.getElementById('qty-' + productId);
  const current = parseInt(el.textContent, 10) || 0;
  const newQty = Math.max(0, current + delta);
  el.textContent = newQty;

  const product = state.products.find(p => p.id === productId);
  if (product) {
    const price = resolveTierPrice(product, Math.max(newQty, 1));
    document.getElementById('unit-price-' + productId).innerHTML = `${formatRupiah(price)} / ${esc(product.unit)}` + (price < product.price ? ' <span style="color:#057C43;font-weight:700;">(harga grosir)</span>' : '');
  }
  recalcOrderTotal();
}

function recalcOrderTotal() {
  let total = 0;
  document.querySelectorAll('.qty-value').forEach(el => {
    const qty = parseInt(el.textContent, 10) || 0;
    const product = state.products.find(p => p.id === el.dataset.productId);
    if (product && qty > 0) total += resolveTierPrice(product, qty) * qty;
  });
  document.getElementById('order-total').textContent = formatRupiah(total);
}

function setPayMethod(val) {
  state.selectedPayMethod = val;
  document.querySelectorAll('.pay-method-btn').forEach(btn => {
    if (btn.dataset.pay === val) {
      btn.style.background = '#057C43'; btn.style.color = '#fff'; btn.style.borderColor = '#057C43';
    } else {
      btn.style.background = '#fff'; btn.style.color = '#555'; btn.style.borderColor = '#E4E4E4';
    }
  });
}

async function submitOrder(customerId, visitId) {
  const qtyEls = document.querySelectorAll('.qty-value');
  const items = [];
  qtyEls.forEach(el => {
    const qty = parseInt(el.textContent, 10) || 0;
    if (qty > 0) items.push({ productId: el.dataset.productId, quantity: qty });
  });

  const errorBox = document.getElementById('order-error');
  errorBox.innerHTML = '';

  if (items.length === 0) {
    errorBox.innerHTML = `<div class="error-box">Isi minimal 1 jumlah produk.</div>`;
    return;
  }

  const paymentMethod = state.selectedPayMethod || 'CASH';
  const btn = document.getElementById('submit-order-btn');
  btn.disabled = true;
  btn.textContent = 'Mengirim...';

  try {
    const order = await api('/orders', {
      method: 'POST',
      body: JSON.stringify({ customerId, visitId: (visitId && visitId !== 'none') ? visitId : null, paymentMethod, items, clientRequestId: currentOrderClientId }),
    });
    currentOrderClientId = null;
    receiptReturnTo = '#/home';
    navigate('#/receipt/' + order.id);
  } catch (err) {
    errorBox.innerHTML = `<div class="error-box">${err.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Kirim Pesanan';
  }
}

async function finishVisitWithoutOrder(customerId, visitId) {
  if (!confirm('Tandai kunjungan ini selesai tanpa order?')) return;

  const btn = document.getElementById('finish-no-order-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }

  try {
    await api(`/visits/${visitId}/checkout`, {
      method: 'POST',
      body: JSON.stringify({ notes: null }),
    });
    navigate('#/home');
  } catch (err) {
    alert(err.message);
    if (btn) { btn.disabled = false; btn.textContent = 'Kunjungan tanpa order — selesai'; }
  }
}

// ====== RIWAYAT ======
// ====== RIWAYAT (Kunjungan & Order) ======
// FITUR RIWAYAT + FILTER TANGGAL: dulu menu ini cuma Riwayat Kunjungan,
// tidak ada Riwayat Order sama sekali (BUG-005) - sales tidak bisa buka lagi
// struk order lama (BUG-006). Sekarang dipecah 2 sub-tab, keduanya punya
// filter tanggal yang sama caranya.
let historyFilterMode = '7hari'; // 'hari-ini' | '7hari' | '30hari' | 'custom'
let historyCustomFrom = null;
let historyCustomTo = null;
let historyShowDatePicker = false;

// Selalu berpatokan ke zona waktu Asia/Jakarta (sama seperti server), BUKAN
// UTC bawaan toISOString() - kalau pakai UTC, sales yang buka HP dini hari
// (mis. 00:30 WIB) bisa melihat "Hari Ini" salah menunjuk tanggal kemarin.
function jakartaTodayStr() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}
function tambahHari(dateStr, delta) {
  const d = new Date(dateStr + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

function hitungRentangTanggal(mode) {
  const toStr = jakartaTodayStr();
  if (mode === 'hari-ini') return { from: toStr, to: toStr };
  if (mode === '7hari') return { from: tambahHari(toStr, -6), to: toStr };
  if (mode === '30hari') return { from: tambahHari(toStr, -29), to: toStr };
  // custom
  return { from: historyCustomFrom || toStr, to: historyCustomTo || toStr };
}

function formatTanggalIndo(dateStr) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function pilihFilterHistory(subTab, mode) {
  historyFilterMode = mode;
  historyShowDatePicker = false;
  renderHistory(subTab);
}

function toggleDatePickerHistory(subTab) {
  historyShowDatePicker = !historyShowDatePicker;
  renderHistory(subTab);
}

function terapkanCustomDateHistory(subTab) {
  const from = document.getElementById('history-from').value;
  const to = document.getElementById('history-to').value;
  if (!from || !to) { alert('Pilih tanggal awal dan akhir dulu.'); return; }
  if (new Date(from) > new Date(to)) { alert('Tanggal awal tidak boleh setelah tanggal akhir.'); return; }
  const rentangHari = (new Date(to) - new Date(from)) / 86400000;
  if (rentangHari > 90) { alert('Rentang tanggal maksimal 90 hari sekali tampil.'); return; }
  historyCustomFrom = from;
  historyCustomTo = to;
  historyFilterMode = 'custom';
  historyShowDatePicker = false;
  renderHistory(subTab);
}

function filterChipsHtml(subTab) {
  const chip = (mode, label) => `<div onclick="pilihFilterHistory('${subTab}','${mode}')" style="padding:6px 12px;border-radius:20px;font-size:11.5px;font-weight:700;border:1.3px solid ${historyFilterMode === mode ? '#057C43' : '#ECECEC'};color:${historyFilterMode === mode ? '#fff' : '#777'};background:${historyFilterMode === mode ? '#057C43' : '#fff'};white-space:nowrap;cursor:pointer;">${label}</div>`;
  return `
    <div style="display:flex;gap:7px;margin-bottom:12px;align-items:center;">
      ${chip('hari-ini', 'Hari Ini')}
      ${chip('7hari', '7 Hari')}
      ${chip('30hari', '30 Hari')}
      <div onclick="toggleDatePickerHistory('${subTab}')" style="width:32px;height:32px;border-radius:50%;border:1.3px solid ${historyFilterMode === 'custom' ? '#057C43' : '#ECECEC'};background:${historyFilterMode === 'custom' ? '#057C43' : '#fff'};color:${historyFilterMode === 'custom' ? '#fff' : '#555'};display:flex;align-items:center;justify-content:center;font-size:14px;margin-left:auto;flex:none;cursor:pointer;">&#128197;</div>
    </div>
    ${historyShowDatePicker ? `
    <div style="background:#fff;border:1px solid #ECECEC;border-radius:14px;padding:16px;margin-bottom:14px;">
      <p style="font-size:12.5px;font-weight:700;color:#1B2A4A;margin:0 0 10px;">Pilih rentang tanggal</p>
      <div style="margin-bottom:10px;">
        <label style="font-size:10.5px;color:#999;display:block;margin-bottom:4px;">Dari tanggal</label>
        <input type="date" id="history-from" value="${historyCustomFrom || ''}" style="width:100%;border:1.3px solid #ECECEC;border-radius:8px;padding:9px 10px;font-size:12.5px;color:#333;background:#FAFAFA;box-sizing:border-box;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:10.5px;color:#999;display:block;margin-bottom:4px;">Sampai tanggal</label>
        <input type="date" id="history-to" value="${historyCustomTo || ''}" style="width:100%;border:1.3px solid #ECECEC;border-radius:8px;padding:9px 10px;font-size:12.5px;color:#333;background:#FAFAFA;box-sizing:border-box;">
      </div>
      <button onclick="terapkanCustomDateHistory('${subTab}')" style="width:100%;background:#057C43;color:#fff;border:none;border-radius:8px;padding:10px;font-size:12.5px;font-weight:700;cursor:pointer;">Terapkan</button>
      <p style="font-size:10.5px;color:#999;margin:8px 0 0;">Rentang maksimal 90 hari sekali tampil, supaya HP tidak berat.</p>
    </div>` : ''}`;
}

async function renderHistory(subTab) {
  subTab = subTab === 'order' ? 'order' : 'kunjungan';
  app.innerHTML = `<div style="padding:22px 20px;"><p style="color:var(--text-muted);font-size:14px;">Memuat...</p></div>${tabBarHtml('history')}`;

  const { from, to } = hitungRentangTanggal(historyFilterMode);
  const segHtml = `
    <div style="display:flex;background:#EDEDEA;border-radius:11px;padding:3px;margin-bottom:14px;">
      <div onclick="navigate('#/history/kunjungan')" style="flex:1;text-align:center;padding:8px 0;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;background:${subTab === 'kunjungan' ? '#fff' : 'transparent'};color:${subTab === 'kunjungan' ? '#0A5C37' : '#777'};">Kunjungan</div>
      <div onclick="navigate('#/history/order')" style="flex:1;text-align:center;padding:8px 0;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;background:${subTab === 'order' ? '#fff' : 'transparent'};color:${subTab === 'order' ? '#0A5C37' : '#777'};">Order</div>
    </div>`;

  try {
    if (subTab === 'kunjungan') {
      const visits = await api(`/visits?from=${from}&to=${to}`);
      const rows = visits.map(v => `
        <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #ECECEC;border-radius:12px;padding:12px 14px;margin-bottom:8px;">
          <div>
            <div style="font-size:13.5px;font-weight:700;color:#1a1a1a;">${esc(v.customer.name)}</div>
            <div style="font-size:12px;color:#888888;margin-top:2px;">${new Date(v.checkinAt).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}</div>
          </div>
          <div style="font-size:13px;font-weight:700;color:#057C43;">${formatJam(v.checkinAt)}</div>
        </div>`).join('') || '<p style="color:#999;font-size:13px;">Belum ada kunjungan di rentang tanggal ini.</p>';

      app.innerHTML = `
        <div style="flex:1;overflow-y:auto;padding:22px 20px 16px;">
          <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:20px;color:#1a1a1a;margin-bottom:16px;">Riwayat</div>
          ${segHtml}
          ${filterChipsHtml('kunjungan')}
          <p style="font-size:10.5px;color:#999;margin:0 0 10px;">${formatTanggalIndo(from)} &ndash; ${formatTanggalIndo(to)} &middot; ${visits.length} kunjungan</p>
          ${rows}
        </div>
        ${tabBarHtml('history')}`;
    } else {
      const orders = await api(`/orders?from=${from}&to=${to}`);
      const labelMetode = { CASH: 'Cash', TEMPO: 'Tempo', CONSIGNMENT: 'Konsinyasi' };
      const warnaMetode = { CASH: { bg: '#DFF3E7', text: '#0A5C37' }, TEMPO: { bg: '#FBF0E4', text: '#B57837' }, CONSIGNMENT: { bg: '#EAF1FA', text: '#2C5282' } };
      const rows = orders.map(o => {
        const orderNumber = 'SC-' + new Date(o.createdAt).toISOString().slice(0, 10).replace(/-/g, '') + '-' + o.id.slice(-4).toUpperCase();
        const warna = warnaMetode[o.paymentMethod] || { bg: '#EEE', text: '#555' };
        return `
        <div onclick="receiptReturnTo='#/history/order';navigate('#/receipt/${o.id}')" style="background:#fff;border:1px solid #ECECEC;border-radius:12px;padding:12px 14px;margin-bottom:8px;cursor:pointer;">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <div>
              <div style="font-size:13.5px;font-weight:700;color:#1a1a1a;margin:0 0 3px;">${esc(o.customer.name)}</div>
              <div style="font-size:11px;color:#888888;">${orderNumber} &middot; ${new Date(o.createdAt).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' })}, ${formatJam(o.createdAt)}</div>
            </div>
            <div style="font-size:14px;font-weight:700;color:#057C43;white-space:nowrap;">${formatRupiah(o.totalAmount)}</div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:8px;border-top:1px dashed #ECECEC;">
            <span style="font-size:9.5px;font-weight:700;padding:2px 8px;border-radius:20px;background:${warna.bg};color:${warna.text};">${labelMetode[o.paymentMethod] || o.paymentMethod}</span>
            <span style="color:#C7C7C7;font-size:15px;">&rsaquo;</span>
          </div>
        </div>`;
      }).join('') || '<p style="color:#999;font-size:13px;">Belum ada order di rentang tanggal ini.</p>';

      app.innerHTML = `
        <div style="flex:1;overflow-y:auto;padding:22px 20px 16px;">
          <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:20px;color:#1a1a1a;margin-bottom:16px;">Riwayat</div>
          ${segHtml}
          ${filterChipsHtml('order')}
          <p style="font-size:10.5px;color:#999;margin:0 0 10px;">${formatTanggalIndo(from)} &ndash; ${formatTanggalIndo(to)} &middot; ${orders.length} order</p>
          ${rows}
        </div>
        ${tabBarHtml('history')}`;
    }
  } catch (err) {
    app.innerHTML = `<div style="padding:22px 20px;"><div class="error-box">${err.message}</div></div>${tabBarHtml('history')}`;
  }
}

// ====== PROFIL ======
async function renderProfile() {
  const initials = (state.user?.name || '-').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const roleLabel = { SALES: 'Sales Lapangan', TEAM_LEADER: 'Team Leader', MANAGER: 'Manager', DIREKTUR: 'Direktur' }[state.user?.role] || state.user?.role;

  let targetHtml = '';
  if (state.user?.role === 'SALES') {
    try {
      const t = await api('/targets/me');
      const visitPct = t.targetVisits > 0 ? Math.min(100, Math.round((t.actualVisits / t.targetVisits) * 100)) : 0;
      const revenuePct = t.targetRevenue > 0 ? Math.min(100, Math.round((t.actualRevenue / t.targetRevenue) * 100)) : 0;
      const overallPct = t.targetRevenue > 0 ? Math.round((t.actualRevenue / t.targetRevenue) * 100) : 0;
      const monthLabel = new Date(t.periodMonth + '-01').toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });

      targetHtml = `
        <div style="font-size:12px;font-weight:700;color:#303030;margin-bottom:8px;">Target &amp; Pencapaian — ${monthLabel}</div>
        <div style="background:#fff;border:1px solid #ECECEC;border-radius:14px;padding:16px;margin-bottom:20px;">
          ${t.targetVisits === 0 && t.targetRevenue === 0 ? '<p style="color:#999;font-size:12.5px;">Target belum diset oleh Team Leader/Manager.</p>' : `
          <div style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">
              <span style="color:#777777;">Kunjungan</span>
              <span style="font-weight:700;color:#1a1a1a;">${t.actualVisits} / ${t.targetVisits}</span>
            </div>
            <div style="height:7px;border-radius:4px;background:#F1F1EE;overflow:hidden;">
              <div style="height:100%;width:${visitPct}%;background:linear-gradient(90deg,#7AB41D,#057C43);"></div>
            </div>
          </div>
          <div style="margin-bottom:14px;">
            <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:6px;">
              <span style="color:#777777;">Revenue</span>
              <span style="font-weight:700;color:#1a1a1a;">${formatRupiah(t.actualRevenue)} / ${formatRupiah(t.targetRevenue)}</span>
            </div>
            <div style="height:7px;border-radius:4px;background:#F1F1EE;overflow:hidden;">
              <div style="height:100%;width:${revenuePct}%;background:linear-gradient(90deg,#B57837,#FFE370);"></div>
            </div>
          </div>
          <div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid #F1F1EE;padding-top:12px;">
            <span style="font-size:12px;color:#777777;">Pencapaian keseluruhan</span>
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${overallPct >= 100 ? 'oklch(93% 0.05 145 / 0.6)' : '#FBEBD5'};color:${overallPct >= 100 ? '#057C43' : '#8a5c26'};">${overallPct}% dari target</span>
          </div>`}
        </div>`;
    } catch (err) {
      targetHtml = '';
    }
  }

  const photoHtml = state.user?.photoUrl
    ? `<img src="${API}${state.user.photoUrl}" style="width:76px;height:76px;border-radius:50%;object-fit:cover;margin-bottom:12px;">`
    : `<div style="width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,#057C43,#7AB41D);color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:26px;margin-bottom:12px;">${initials}</div>`;

  app.innerHTML = `
    <div style="flex:1;overflow-y:auto;padding:22px 20px 16px;">
      <div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:14px;margin-bottom:26px;">
        ${photoHtml}
        <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:19px;color:#1a1a1a;">${esc(state.user?.name || '-')}</div>
        <div style="font-size:13px;color:#888888;margin-top:2px;">${state.user?.email || '-'}</div>
        <span style="margin-top:10px;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;background:oklch(93% 0.05 145 / 0.5);color:#057C43;">${roleLabel}</span>
      </div>
      ${targetHtml}

      <div style="background:#fff;border-radius:14px;overflow:hidden;border:1px solid #ECECEC;">
        <label for="profile-photo-input" style="display:flex;align-items:center;gap:12px;padding:14px 16px;font-size:14px;color:#303030;border-bottom:1px solid #F1F1EE;cursor:pointer;">📷 <span>Ubah Foto Profil</span></label>
        <input type="file" id="profile-photo-input" accept="image/*" capture="environment" style="display:none;" onchange="submitProfilePhoto(this)">
        <div onclick="showChangePasswordForm()" style="display:flex;align-items:center;gap:12px;padding:14px 16px;font-size:14px;color:#303030;border-bottom:1px solid #F1F1EE;cursor:pointer;">🔒 <span>Ganti Password</span></div>
        <div onclick="confirmLogout()" style="display:flex;align-items:center;gap:12px;padding:14px 16px;font-size:14px;color:#B3261E;cursor:pointer;">🚪 <span>Keluar</span></div>
      </div>
      <div id="change-password-box" style="margin-top:10px;"></div>

      <div style="text-align:center;padding:22px 0 6px;color:#B0B0B0;font-size:10.5px;font-family:monospace;">
        Damarindo v${APP_VERSION}${BUILD_NUMBER !== '__BUILD_NUMBER__' ? ` (build ${BUILD_NUMBER})` : ''}
      </div>
    </div>
    ${tabBarHtml('profile')}
    <div id="logout-modal-box"></div>
  `;
}

function confirmLogout() {
  const box = document.getElementById('logout-modal-box');
  box.innerHTML = `
    <div style="position:fixed;inset:0;background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center;z-index:100;" onclick="if(event.target===this) this.parentElement.innerHTML=''">
      <div style="background:#fff;border-radius:14px;padding:22px;width:280px;text-align:center;">
        <div style="font-size:14px;font-weight:700;color:#303030;margin-bottom:8px;">Yakin ingin keluar?</div>
        <div style="font-size:12px;color:#888;margin-bottom:16px;">Anda perlu login ulang untuk masuk lagi.</div>
        <div style="display:flex;gap:8px;">
          <button style="flex:1;border:none;background:#B3261E;color:#fff;padding:10px;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;" onclick="logout()">Ya, Keluar</button>
          <button style="flex:1;border:1.5px solid #D8D8D8;background:#fff;color:#303030;padding:10px;border-radius:9px;font-size:12.5px;font-weight:700;cursor:pointer;" onclick="document.getElementById('logout-modal-box').innerHTML=''">Batal</button>
        </div>
      </div>
    </div>`;
}

async function submitProfilePhoto(input) {
  const file = input.files[0];
  if (!file) return;
  try {
    const compressed = await compressImage(file);
    const formData = new FormData();
    formData.append('photo', compressed, 'photo.jpg');
    const res = await apiRaw('/users/me/photo', { method: 'POST', body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Gagal upload foto.');
    state.user = data.user;
    localStorage.setItem('sc_user', JSON.stringify(data.user));
    alert('Foto profil berhasil disimpan.');
    renderProfile();
  } catch (err) {
    alert(err.message);
  }
}

function showChangePasswordForm() {
  const box = document.getElementById('change-password-box');
  box.innerHTML = `
    <div style="background:#fff;border:1px solid #ECECEC;border-radius:14px;padding:16px;margin-bottom:10px;">
      <input type="password" id="cp-current" placeholder="Password saat ini" style="width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1.5px solid #E4E4E4;margin-bottom:8px;font-size:14px;">
      <input type="password" id="cp-new" placeholder="Password baru (min. 10 karakter)" style="width:100%;box-sizing:border-box;padding:12px;border-radius:10px;border:1.5px solid #E4E4E4;margin-bottom:10px;font-size:14px;">
      <div id="cp-error"></div>
      <button onclick="submitChangePassword()" style="width:100%;padding:12px;border:none;border-radius:10px;background:#057C43;color:#fff;font-weight:700;font-size:13.5px;cursor:pointer;">Simpan Password</button>
    </div>`;
}

async function submitChangePassword() {
  const currentPassword = document.getElementById('cp-current').value;
  const newPassword = document.getElementById('cp-new').value;
  const errorBox = document.getElementById('cp-error');
  errorBox.innerHTML = '';
  try {
    await api('/users/me/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) });
    document.getElementById('change-password-box').innerHTML = `<div style="background:oklch(93% 0.05 145 / 0.5);color:#057C43;border-radius:10px;padding:10px 12px;font-size:12.5px;font-weight:700;margin-bottom:10px;">Password berhasil diubah.</div>`;
  } catch (err) {
    errorBox.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}
