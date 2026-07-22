// ====== Konfigurasi ======
const IS_NATIVE_APP = typeof window.Capacitor !== 'undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
const API = IS_NATIVE_APP ? 'https://canv.smart-outsource.my.id/api' : '/api';

// ====== State ======
const state = {
  token: localStorage.getItem('sc_token') || null,
  user: JSON.parse(localStorage.getItem('sc_user') || 'null'),
  customers: [],
  categories: [],
  products: [],
};

const app = document.getElementById('app');

// ====== Helper API ======
async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) headers['Authorization'] = 'Bearer ' + state.token;

  const res = await fetch(API + path, { ...options, headers });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');
  return data;
}

function formatRupiah(n) {
  return 'Rp' + Math.round(n).toLocaleString('id-ID');
}

function formatJam(dateStr) {
  const d = new Date(dateStr);
  return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
}

// Ambil lokasi GPS - otomatis pakai plugin Capacitor (APK) atau browser API (web)
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
  else if (parts[0] === 'history') renderHistory();
  else if (parts[0] === 'profile') renderProfile();
  else renderHome();
}

// ====== LOGIN ======
function renderLogin() {
  app.innerHTML = `
    <div class="login-wrap">
      <p class="login-title">Sales Canvas</p>
      <p class="login-sub">Masuk untuk mulai kunjungan hari ini</p>
      <div id="login-error"></div>
      <form id="login-form">
        <div class="field">
          <label>Email</label>
          <input type="email" id="login-email" required placeholder="nama@email.com">
        </div>
        <div class="field">
          <label>Password</label>
          <input type="password" id="login-password" required placeholder="Password">
        </div>
        <button type="submit" class="btn-primary">Masuk</button>
      </form>
    </div>
  `;
  document.getElementById('login-form').addEventListener('submit', handleLogin);
}

async function handleLogin(e) {
  e.preventDefault();
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
  const tab = (key, icon, label, hash) => `
    <button class="tab-item ${active === key ? 'active' : ''}" onclick="navigate('${hash}')">
      <span class="tab-icon">${icon}</span>
      <span>${label}</span>
    </button>`;
  return `
    <div class="tabbar">
      ${tab('home', '⌂', 'Home', '#/home')}
      ${tab('history', '≡', 'Riwayat', '#/history')}
      ${tab('profile', '●', 'Profil', '#/profile')}
    </div>`;
}

// ====== HOME ======
async function renderHome() {
  app.innerHTML = `<div class="topbar"><p class="date">Memuat...</p></div>`;

  if (state.user?.role === 'SALES') {
    getCurrentLocation((latitude, longitude) => {
      api('/users/me/location', { method: 'POST', body: JSON.stringify({ latitude, longitude }) }).catch(() => {});
    }, () => {});
  }

  try {
    const [customers, visits, messages] = await Promise.all([api('/customers'), api('/visits'), api('/messages').catch(() => [])]);
    state.customers = customers;
    const broadcastHtml = messages && messages[0] ? `
      <div class="card" style="background:#fff8e5;border:1px solid #ffe4a3;margin:0 16px 10px;">
        <p style="margin:0 0 2px;font-size:12px;color:#8e6a00;font-weight:600;">Pengumuman dari ${messages[0].fromName}</p>
        <p style="margin:0;font-size:13px;">${messages[0].text}</p>
      </div>` : '';

    const today = new Date().toDateString();
    const visitedTodayIds = new Set(
      visits.filter(v => new Date(v.checkinAt).toDateString() === today).map(v => v.customerId)
    );

    const rows = state.customers.map(c => {
      const visited = visitedTodayIds.has(c.id);
      const iconBg = visited ? '#e5f7ec' : '#eef2ff';
      const iconColor = visited ? '#1f9254' : '#5661d6';
      const icon = visited ? '✓' : '○';
      const statusText = visited ? 'Sudah dikunjungi hari ini' : 'Belum dikunjungi';
      const statusColor = visited ? '#1f9254' : '#8e8e93';
      const categoryName = c.category?.name || '-';

      return `
        <div class="card card-row" onclick="navigate('#/customer/${c.id}')">
          <div class="icon-circle" style="background:${iconBg};color:${iconColor};">${icon}</div>
          <div style="flex:1;min-width:0;">
            <p style="margin:0;font-size:15px;font-weight:600;">${c.name}</p>
            <p style="margin:0;font-size:12px;color:${statusColor};">${statusText} · ${categoryName}</p>
          </div>
          <span style="color:#c7c7cc;">›</span>
        </div>`;
    }).join('');

    const visitedCount = visitedTodayIds.size;

    app.innerHTML = `
      <div class="topbar">
        <p class="date">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        <p class="title">Hari ini</p>
      </div>
      <div class="grid-2">
        <div class="card">
          <p class="stat-label">Kunjungan</p>
          <p class="stat-value">${visitedCount} <span style="font-size:14px;color:#8e8e93;font-weight:400;">/ ${state.customers.length}</span></p>
        </div>
        <div class="card">
          <p class="stat-label">Total customer</p>
          <p class="stat-value">${state.customers.length}</p>
        </div>
      </div>
      ${broadcastHtml}
      <p class="section-label">Daftar customer</p>
      <div style="padding:0 16px 10px;">
        <button class="btn-secondary" style="height:44px;" onclick="navigate('#/add-customer')">+ Tambah customer baru</button>
      </div>
      <div class="list-wrap">${rows || '<p class="muted" style="padding:8px 0;">Belum ada customer ditugaskan ke Anda.</p>'}</div>
      ${tabBarHtml('home')}
    `;
  } catch (err) {
    app.innerHTML = `<div class="topbar"><div class="error-box">${err.message}</div></div>${tabBarHtml('home')}`;
  }
}

// ====== DETAIL CUSTOMER ======
async function renderCustomerDetail(customerId) {
  app.innerHTML = `<div class="topbar-nav"><button class="back-btn" onclick="navigate('#/home')">‹</button><p class="title">Memuat...</p></div>`;

  try {
    const c = await api('/customers/' + customerId);

    const visitRows = (c.visits || []).slice(0, 5).map(v => `
      <div class="card">
        <p style="margin:0;font-size:14px;">Kunjungan · ${formatJam(v.checkinAt)}</p>
        <p style="margin:0;font-size:12px;color:#8e8e93;">${v.notes || 'Tidak ada catatan'}</p>
      </div>`).join('') || '<p class="muted">Belum ada riwayat kunjungan.</p>';

    app.innerHTML = `
      <div class="topbar-nav">
        <button class="back-btn" onclick="navigate('#/home')">‹</button>
        <p class="title">${c.name}</p>
      </div>
      <div style="padding:0 16px;">
        ${c.photoUrl ? `<img src="${API}${c.photoUrl}" style="width:100%;height:160px;object-fit:cover;border-radius:14px;margin-bottom:10px;">` : ''}
        <div class="card">
          <p style="margin:0 0 4px;font-size:13px;color:#8e8e93;">Alamat</p>
          <p style="margin:0 0 10px;font-size:14px;">${c.address}, ${c.city}, ${c.province}</p>
          <p style="margin:0 0 4px;font-size:13px;color:#8e8e93;">No. Telepon/WA</p>
          <p style="margin:0 0 10px;font-size:14px;">${c.phone}</p>
          <div style="display:flex;gap:8px;align-items:center;">
            <span class="pill" style="background:#eef2ff;color:#5661d6;">${c.category?.name || '-'}</span>
            ${!c.verified ? '<span class="pill" style="background:#fff4e5;color:#b26a00;">Menunggu approval</span>' : ''}
          </div>
        </div>

        <button class="btn-primary" style="margin-bottom:10px;" onclick="navigate('#/checkin/${c.id}')">Check-in di sini</button>
        <button class="btn-secondary" style="margin-bottom:20px;" onclick="navigate('#/edit-customer/${c.id}')">Edit data customer</button>

        <p class="section-label" style="padding:0 0 8px;">Riwayat kunjungan</p>
        ${visitRows}
      </div>
    `;
  } catch (err) {
    app.innerHTML = `<div class="topbar-nav"><button class="back-btn" onclick="navigate('#/home')">‹</button></div><div style="padding:0 16px;"><div class="error-box">${err.message}</div></div>`;
  }
}

// ====== TAMBAH CUSTOMER ======
let addCustomerLocation = null;

async function renderAddCustomerForm() {
  app.innerHTML = `<div class="topbar-nav"><button class="back-btn" onclick="navigate('#/home')">‹</button><p class="title">Memuat...</p></div>`;

  try {
    const categories = await api('/customer-categories');
    state.categories = categories;

    const categoryOptions = categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');

    app.innerHTML = `
      <div class="topbar-nav">
        <button class="back-btn" onclick="navigate('#/home')">‹</button>
        <p class="title">Tambah customer</p>
      </div>
      <div style="padding:0 16px;">
        <div class="card" id="gps-status">
          <p style="margin:0;font-size:14px;">Mengambil lokasi GPS Anda...</p>
        </div>

        <div class="field">
          <label>Golongan</label>
          <select id="new-customer-category">${categoryOptions || '<option value="">Belum ada golongan</option>'}</select>
        </div>
        <div class="field">
          <label>Nama customer</label>
          <input type="text" id="new-customer-name" placeholder="Contoh: Toko Sinar Jaya">
        </div>
        <div class="field">
          <label>Alamat</label>
          <input type="text" id="new-customer-address" placeholder="Contoh: Los 12 Blok C, Pasar Baru">
        </div>
        <div class="field">
          <label>Kota/Kabupaten</label>
          <input type="text" id="new-customer-city" placeholder="Contoh: Jakarta Barat">
        </div>
        <div class="field">
          <label>Provinsi</label>
          <input type="text" id="new-customer-province" placeholder="Contoh: DKI Jakarta">
        </div>
        <div class="field">
          <label>No. Telepon/WhatsApp</label>
          <input type="tel" id="new-customer-phone" placeholder="Contoh: 081234567890">
        </div>
        <div class="field">
          <label>Foto customer (wajib)</label>
          <input type="file" id="new-customer-photo" accept="image/*" capture="environment">
        </div>

        <div id="add-customer-error"></div>
        <div id="candidate-list"></div>

        <button class="btn-primary" id="check-customer-btn" disabled>Mengambil lokasi...</button>
      </div>
    `;

    getCurrentLocation(
      (latitude, longitude) => {
        addCustomerLocation = { latitude, longitude };
        document.getElementById('gps-status').innerHTML = `<p style="margin:0;font-size:14px;color:#1f9254;">Lokasi berhasil didapat.</p>`;
        const btn = document.getElementById('check-customer-btn');
        btn.disabled = false;
        btn.textContent = 'Lanjut';
        btn.onclick = checkNearbyBeforeSubmit;
      },
      (errMessage) => {
        document.getElementById('gps-status').innerHTML = `<div class="error-box">Gagal mengambil lokasi: ${errMessage}. Aktifkan izin lokasi lalu coba lagi.</div>`;
      }
    );
  } catch (err) {
    app.innerHTML = `<div class="topbar-nav"><button class="back-btn" onclick="navigate('#/home')">‹</button></div><div style="padding:0 16px;"><div class="error-box">${err.message}</div></div>`;
  }
}

async function checkNearbyBeforeSubmit() {
  const name = document.getElementById('new-customer-name').value.trim();
  const address = document.getElementById('new-customer-address').value.trim();
  const city = document.getElementById('new-customer-city').value.trim();
  const province = document.getElementById('new-customer-province').value.trim();
  const phone = document.getElementById('new-customer-phone').value.trim();
  const photoInput = document.getElementById('new-customer-photo');
  const errorBox = document.getElementById('add-customer-error');
  errorBox.innerHTML = '';

  if (!name || !address || !city || !province || !phone) {
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

function renderCandidateList(candidates) {
  const btn = document.getElementById('check-customer-btn');
  btn.style.display = 'none';

  const rows = candidates.map(c => `
    <div class="card card-row">
      ${c.photoUrl ? `<img src="${API}${c.photoUrl}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;flex-shrink:0;">` : '<div class="icon-circle" style="background:#f2f2f7;">○</div>'}
      <div style="flex:1;min-width:0;">
        <p style="margin:0;font-size:14px;font-weight:600;">${c.name}</p>
        <p style="margin:0;font-size:12px;color:#8e8e93;">${c.distanceMeters}m dari lokasi Anda</p>
      </div>
      <button class="btn-secondary" style="width:auto;height:36px;padding:0 12px;font-size:13px;" onclick="navigate('#/edit-customer/${c.id}')">Ini sama</button>
    </div>`).join('');

  document.getElementById('candidate-list').innerHTML = `
    <p class="section-label" style="padding:0 0 8px;">Ditemukan customer di sekitar sini — apakah salah satu ini yang sama?</p>
    ${rows}
    <button class="btn-primary" style="margin-top:12px;" onclick="submitNewCustomer()">Bukan, ini customer berbeda — lanjut tambah</button>
  `;
}

async function submitNewCustomer() {
  const categoryId = document.getElementById('new-customer-category').value;
  const name = document.getElementById('new-customer-name').value.trim();
  const address = document.getElementById('new-customer-address').value.trim();
  const city = document.getElementById('new-customer-city').value.trim();
  const province = document.getElementById('new-customer-province').value.trim();
  const phone = document.getElementById('new-customer-phone').value.trim();
  const photoFile = document.getElementById('new-customer-photo').files[0];
  const errorBox = document.getElementById('add-customer-error');
  errorBox.innerHTML = '';

  const formData = new FormData();
  formData.append('categoryId', categoryId);
  formData.append('name', name);
  formData.append('address', address);
  formData.append('city', city);
  formData.append('province', province);
  formData.append('phone', phone);
  formData.append('latitude', addCustomerLocation.latitude);
  formData.append('longitude', addCustomerLocation.longitude);
  formData.append('photo', photoFile);

  try {
    const headers = {};
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    const res = await fetch(API + '/customers', { method: 'POST', headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');

    navigate('#/home');
  } catch (err) {
    errorBox.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

// ====== EDIT CUSTOMER ======
async function renderEditCustomerForm(customerId) {
  app.innerHTML = `<div class="topbar-nav"><button class="back-btn" onclick="navigate('#/customer/${customerId}')">‹</button><p class="title">Memuat...</p></div>`;

  try {
    const [c, categories] = await Promise.all([api('/customers/' + customerId), api('/customer-categories')]);

    const categoryOptions = categories.map(cat =>
      `<option value="${cat.id}" ${cat.id === c.categoryId ? 'selected' : ''}>${cat.name}</option>`
    ).join('');

    app.innerHTML = `
      <div class="topbar-nav">
        <button class="back-btn" onclick="navigate('#/customer/${customerId}')">‹</button>
        <p class="title">Edit customer</p>
      </div>
      <div style="padding:0 16px;">
        ${c.photoUrl ? `<img src="${API}${c.photoUrl}" style="width:100%;height:140px;object-fit:cover;border-radius:14px;margin-bottom:10px;">` : ''}
        <div class="field">
          <label>Golongan</label>
          <select id="edit-customer-category">${categoryOptions}</select>
        </div>
        <div class="field">
          <label>Nama customer</label>
          <input type="text" id="edit-customer-name" value="${c.name}">
        </div>
        <div class="field">
          <label>Alamat</label>
          <input type="text" id="edit-customer-address" value="${c.address || ''}">
        </div>
        <div class="field">
          <label>Kota/Kabupaten</label>
          <input type="text" id="edit-customer-city" value="${c.city || ''}">
        </div>
        <div class="field">
          <label>Provinsi</label>
          <input type="text" id="edit-customer-province" value="${c.province || ''}">
        </div>
        <div class="field">
          <label>No. Telepon/WhatsApp</label>
          <input type="tel" id="edit-customer-phone" value="${c.phone || ''}">
        </div>
        <div class="field">
          <label>Ganti foto (opsional)</label>
          <input type="file" id="edit-customer-photo" accept="image/*" capture="environment">
        </div>
        <div id="edit-customer-error"></div>
        <button class="btn-primary" id="save-customer-btn">Simpan perubahan</button>
      </div>
    `;

    document.getElementById('save-customer-btn').addEventListener('click', () => submitEditCustomer(customerId));
  } catch (err) {
    app.innerHTML = `<div class="topbar-nav"><button class="back-btn" onclick="navigate('#/home')">‹</button></div><div style="padding:0 16px;"><div class="error-box">${err.message}</div></div>`;
  }
}

async function submitEditCustomer(customerId) {
  const categoryId = document.getElementById('edit-customer-category').value;
  const name = document.getElementById('edit-customer-name').value.trim();
  const address = document.getElementById('edit-customer-address').value.trim();
  const city = document.getElementById('edit-customer-city').value.trim();
  const province = document.getElementById('edit-customer-province').value.trim();
  const phone = document.getElementById('edit-customer-phone').value.trim();
  const photoFile = document.getElementById('edit-customer-photo').files[0];
  const errorBox = document.getElementById('edit-customer-error');
  errorBox.innerHTML = '';

  const formData = new FormData();
  formData.append('categoryId', categoryId);
  formData.append('name', name);
  formData.append('address', address);
  formData.append('city', city);
  formData.append('province', province);
  formData.append('phone', phone);
  if (photoFile) formData.append('photo', photoFile);

  const btn = document.getElementById('save-customer-btn');
  btn.disabled = true;
  btn.textContent = 'Menyimpan...';

  try {
    const headers = {};
    if (state.token) headers['Authorization'] = 'Bearer ' + state.token;
    const res = await fetch(API + '/customers/' + customerId, { method: 'PUT', headers, body: formData });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Terjadi kesalahan.');

    navigate('#/customer/' + customerId);
  } catch (err) {
    errorBox.innerHTML = `<div class="error-box">${err.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Simpan perubahan';
  }
}

// ====== CHECK-IN ======
function renderCheckinForm(customerId) {
  app.innerHTML = `
    <div class="topbar-nav">
      <button class="back-btn" onclick="navigate('#/customer/${customerId}')">‹</button>
      <p class="title">Check-in</p>
    </div>
    <div style="padding:0 16px;">
      <div class="card" id="checkin-status">
        <p style="margin:0;font-size:14px;">Mengambil lokasi GPS Anda...</p>
      </div>
      <button class="btn-primary" id="checkin-btn" disabled>Mengambil lokasi...</button>
    </div>
  `;

  getCurrentLocation(
    (latitude, longitude, accuracy) => {
      document.getElementById('checkin-status').innerHTML = `
        <p style="margin:0;font-size:14px;">Lokasi berhasil didapat.</p>
        <p style="margin:4px 0 0;font-size:12px;color:#8e8e93;">Akurasi ±${Math.round(accuracy)}m</p>`;
      const btn = document.getElementById('checkin-btn');
      btn.disabled = false;
      btn.textContent = 'Konfirmasi check-in';
      btn.onclick = () => doCheckin(customerId, latitude, longitude);
    },
    (errMessage) => {
      document.getElementById('checkin-status').innerHTML = `<div class="error-box">Gagal mengambil lokasi: ${errMessage}. Pastikan izin lokasi diaktifkan.</div>`;
    }
  );
}

async function doCheckin(customerId, latitude, longitude) {
  const btn = document.getElementById('checkin-btn');
  btn.disabled = true;
  btn.textContent = 'Memproses...';

  try {
    const result = await api('/visits/checkin', {
      method: 'POST',
      body: JSON.stringify({ customerId, latitude, longitude }),
    });

    document.getElementById('checkin-status').innerHTML = `
      <p style="margin:0;font-size:14px;font-weight:600;color:${result.lokasiValid ? '#1f9254' : '#c0392b'};">${result.pesan}</p>`;

    setTimeout(() => navigate(`#/order/${customerId}/${result.visit.id}`), 900);
  } catch (err) {
    document.getElementById('checkin-status').innerHTML = `<div class="error-box">${err.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Coba lagi';
  }
}

// ====== INPUT ORDER ======
async function renderOrderForm(customerId, visitId) {
  app.innerHTML = `<div class="topbar-nav"><button class="back-btn" onclick="navigate('#/customer/${customerId}')">‹</button><p class="title">Memuat produk...</p></div>`;

  try {
    const products = await api('/products');
    state.products = products;

    const rows = products.map(p => `
      <div class="card" style="display:flex;align-items:center;gap:12px;">
        <div style="flex:1;">
          <p style="margin:0;font-size:14px;font-weight:600;">${p.name}</p>
          <p style="margin:0;font-size:12px;color:#8e8e93;">${formatRupiah(p.price)} / ${p.unit}</p>
        </div>
        <input type="number" min="0" value="0" data-product-id="${p.id}" data-price="${p.price}"
          class="qty-input" style="width:56px;height:38px;border-radius:8px;border:1px solid #d1d1d6;text-align:center;">
      </div>`).join('');

    app.innerHTML = `
      <div class="topbar-nav">
        <button class="back-btn" onclick="navigate('#/customer/${customerId}')">‹</button>
        <p class="title">Input order</p>
      </div>
      <div style="padding:0 16px;">
        ${rows || '<p class="muted">Belum ada produk terdaftar.</p>'}

        <div class="field" style="margin-top:16px;">
          <label>Metode pembayaran</label>
          <select id="payment-method">
            <option value="CASH">Cash</option>
            <option value="TEMPO">Tempo</option>
            <option value="CONSIGNMENT">Konsinyasi</option>
          </select>
        </div>

        <div id="order-error"></div>
        <button class="btn-primary" id="submit-order-btn">Kirim order</button>
      </div>
    `;

    document.getElementById('submit-order-btn').addEventListener('click', () => submitOrder(customerId, visitId));
  } catch (err) {
    app.innerHTML = `<div class="topbar-nav"><button class="back-btn" onclick="navigate('#/customer/${customerId}')">‹</button></div><div style="padding:0 16px;"><div class="error-box">${err.message}</div></div>`;
  }
}

async function submitOrder(customerId, visitId) {
  const inputs = document.querySelectorAll('.qty-input');
  const items = [];
  inputs.forEach(inp => {
    const qty = parseInt(inp.value, 10);
    if (qty > 0) items.push({ productId: inp.dataset.productId, quantity: qty });
  });

  const errorBox = document.getElementById('order-error');
  errorBox.innerHTML = '';

  if (items.length === 0) {
    errorBox.innerHTML = `<div class="error-box">Isi minimal 1 jumlah produk.</div>`;
    return;
  }

  const paymentMethod = document.getElementById('payment-method').value;
  const btn = document.getElementById('submit-order-btn');
  btn.disabled = true;
  btn.textContent = 'Mengirim...';

  try {
    await api('/orders', {
      method: 'POST',
      body: JSON.stringify({ customerId, visitId, paymentMethod, items }),
    });
    navigate('#/home');
  } catch (err) {
    errorBox.innerHTML = `<div class="error-box">${err.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Kirim order';
  }
}

// ====== RIWAYAT ======
async function renderHistory() {
  app.innerHTML = `<div class="topbar"><p class="title">Riwayat</p></div>`;

  try {
    const visits = await api('/visits');
    const rows = visits.map(v => `
      <div class="card">
        <p style="margin:0;font-size:14px;font-weight:600;">${v.customer.name}</p>
        <p style="margin:0;font-size:12px;color:#8e8e93;">${new Date(v.checkinAt).toLocaleDateString('id-ID')} · ${formatJam(v.checkinAt)}</p>
      </div>`).join('') || '<p class="muted" style="padding:0 16px;">Belum ada riwayat kunjungan.</p>';

    app.innerHTML = `
      <div class="topbar"><p class="title">Riwayat kunjungan</p></div>
      <div class="list-wrap">${rows}</div>
      ${tabBarHtml('history')}
    `;
  } catch (err) {
    app.innerHTML = `<div class="topbar"><div class="error-box">${err.message}</div></div>${tabBarHtml('history')}`;
  }
}

// ====== PROFIL ======
function renderProfile() {
  app.innerHTML = `
    <div class="topbar"><p class="title">Profil</p></div>
    <div style="padding:0 16px;">
      <div class="card">
        <p style="margin:0 0 4px;font-size:16px;font-weight:600;">${state.user?.name || '-'}</p>
        <p style="margin:0;font-size:13px;color:#8e8e93;">${state.user?.email || '-'}</p>
        <p style="margin:6px 0 0;font-size:12px;color:#8e8e93;">Role: ${state.user?.role || '-'}</p>
      </div>
      <button class="btn-secondary" onclick="logout()">Keluar</button>
    </div>
    ${tabBarHtml('profile')}
  `;
}
