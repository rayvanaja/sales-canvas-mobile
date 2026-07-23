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
  if (IS_NATIVE_APP) headers['X-Client-App'] = 'sales-canvas-apk';

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
  else if (parts[0] === 'receipt') renderReceipt(parts[1]);
  else if (parts[0] === 'history') renderHistory();
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
  }

  try {
    const [customers, visits, messages] = await Promise.all([api('/customers'), api('/visits'), api('/messages').catch(() => [])]);
    state.customers = customers;

    const today = new Date().toDateString();
    const visitedTodayIds = new Set(
      visits.filter(v => new Date(v.checkinAt).toDateString() === today).map(v => v.customerId)
    );
    const visitedCount = visitedTodayIds.size;
    const totalCount = state.customers.length;
    const progressPct = totalCount > 0 ? Math.round((visitedCount / totalCount) * 100) : 0;

    const golonganPalette = [
      { bg: 'oklch(93% 0.05 145 / 0.6)', color: '#057C43' },
      { bg: 'oklch(94% 0.09 120 / 0.55)', color: '#5c7a12' },
      { bg: '#FBEBD5', color: '#8a5c26' },
      { bg: '#EDEDEA', color: '#5c5c56' },
    ];
    const golonganColorMap = {};
    let colorIdx = 0;

    const rows = state.customers.map(c => {
      const visited = visitedTodayIds.has(c.id);
      const catName = c.category?.name || '-';
      if (!golonganColorMap[catName]) golonganColorMap[catName] = golonganPalette[colorIdx++ % golonganPalette.length];
      const gc = golonganColorMap[catName];
      const initials = c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
      const avatarColors = ['#057C43', '#7AB41D', '#B57837', '#5661d6'];
      const avatarColor = avatarColors[Math.abs(c.name.charCodeAt(0)) % avatarColors.length];

      return `
        <div onclick="navigate('#/customer/${c.id}')" style="display:flex;align-items:center;gap:11px;background:#fff;border:1px solid #ECECEC;border-radius:12px;padding:11px 13px;cursor:pointer;margin-bottom:9px;">
          <div style="width:38px;height:38px;border-radius:50%;background:${avatarColor};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;flex-shrink:0;">${initials}</div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:700;color:#1a1a1a;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.name}</div>
            <div style="font-size:12px;color:#888888;">${c.city}</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:5px;">
            <span style="font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:20px;background:${gc.bg};color:${gc.color};">${catName}</span>
            <span style="font-size:10.5px;font-weight:700;color:${visited ? '#057C43' : '#B0AFA9'};">${visited ? 'Dikunjungi' : 'Belum'}</span>
          </div>
        </div>`;
    }).join('');

    const broadcastHtml = messages && messages[0] ? `
      <div style="display:flex;align-items:center;gap:12px;background:linear-gradient(120deg,#FFF6DF,#FCE9C4);border:1px solid #F0D9A6;border-radius:14px;padding:13px 16px;margin-bottom:16px;">
        <div style="width:6px;align-self:stretch;border-radius:3px;background:linear-gradient(180deg,#B57837,#FFE370);"></div>
        <div style="font-size:12.5px;color:#5c4a24;line-height:1.5;"><b>${messages[0].fromName}:</b> ${messages[0].text}</div>
      </div>` : '';

    app.innerHTML = `
      <div style="flex:1;overflow-y:auto;padding:22px 20px 16px;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;">
          <div>
            <div style="font-size:13px;color:#777777;">Selamat datang,</div>
            <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:20px;color:#1a1a1a;">${state.user?.name || ''}</div>
          </div>
          <div style="font-size:12px;color:#999999;text-align:right;margin-top:4px;">${new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
        </div>

        <div style="background:linear-gradient(135deg,#057C43,#0a5c33);border-radius:16px;padding:18px 20px;margin-bottom:14px;color:#fff;box-shadow:0 10px 24px -10px rgba(5,124,67,0.5);">
          <div style="font-size:12px;letter-spacing:0.04em;text-transform:uppercase;opacity:0.85;margin-bottom:6px;">Kunjungan Hari Ini</div>
          <div style="display:flex;align-items:baseline;gap:6px;margin-bottom:10px;">
            <div style="font-family:'Trebuchet MS',sans-serif;font-size:30px;font-weight:700;">${visitedCount}</div>
            <div style="font-size:15px;opacity:0.85;">/ ${totalCount} customer</div>
          </div>
          <div style="height:6px;border-radius:3px;background:rgba(255,255,255,0.25);overflow:hidden;">
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
    box.innerHTML = `<div class="card" style="white-space:pre-wrap;font-size:13px;line-height:1.6;">${data.recommendation}</div>`;
  } catch (err) {
    box.innerHTML = `<div class="error-box">${err.message}</div>`;
  }
}

// ====== STRUK / BUKTI PESANAN ======
async function renderReceipt(orderId) {
  app.innerHTML = `<div style="padding:22px 20px;"><p style="color:var(--text-muted);font-size:14px;">Memuat struk...</p></div>`;

  try {
    const o = await api('/orders/' + orderId);
    const orderNumber = 'SC-' + new Date(o.createdAt).toISOString().slice(0, 10).replace(/-/g, '') + '-' + o.id.slice(-4).toUpperCase();
    const tanggal = new Date(o.createdAt).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    const payLabel = { CASH: 'Cash', TEMPO: 'Tempo', CONSIGNMENT: 'Konsinyasi' }[o.paymentMethod] || o.paymentMethod;

    const itemRows = o.items.map(it => `
      <div style="margin-bottom:5px;">
        <div>${it.product.name}</div>
        <div style="display:flex;justify-content:space-between;color:#555;">
          <span>${it.quantity} x ${formatRupiah(it.price)}</span><span>${formatRupiah(it.price * it.quantity)}</span>
        </div>
      </div>`).join('');

    app.innerHTML = `
      <div class="receipt-noprint" style="flex-shrink:0;display:flex;align-items:center;gap:10px;padding:16px 18px;border-bottom:1px solid #ECECEC;background:#fff;">
        <button onclick="navigate('#/home')" style="border:none;background:none;font-size:18px;color:#303030;cursor:pointer;">←</button>
        <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:16px;color:#1a1a1a;">Bukti Pesanan</div>
      </div>

      <div style="flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;align-items:center;">
        <div id="receipt-print-area" style="background:#fff;width:280px;padding:16px 14px;font-family:'Courier New',monospace;font-size:11.5px;color:#1a1a1a;border:1px solid #eee;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <div style="text-align:center;margin-bottom:10px;">
            <div style="font-weight:700;font-size:14px;letter-spacing:0.5px;">DAMAR FLOUR MILLS</div>
            <div style="font-size:10px;color:#555;">PT. Damar Ampat Sekawan</div>
            <div style="font-size:10px;color:#555;">Sales Canvas System</div>
          </div>
          <div style="border-top:1px dashed #999;margin:8px 0;"></div>
          <div style="text-align:center;font-weight:700;font-size:12px;margin-bottom:6px;">BUKTI PESANAN</div>
          <div>No. Order : ${orderNumber}</div>
          <div>Tanggal&nbsp;&nbsp;: ${tanggal}</div>
          <div>Sales&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: ${o.sales.name}</div>
          <div style="border-top:1px dashed #999;margin:8px 0;"></div>
          <div style="font-weight:700;">Customer:</div>
          <div>${o.customer.name}</div>
          <div style="color:#555;">${o.customer.address}</div>
          <div style="color:#555;">${o.customer.city}, ${o.customer.province}</div>
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
          <button onclick="window.print()" style="width:100%;padding:13px;border:none;border-radius:11px;background:#057C43;color:#fff;font-weight:700;font-size:13.5px;cursor:pointer;">Cetak Struk</button>
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
      <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:16px;color:#1a1a1a;">${title}</div>
    </div>`;
}

async function renderCustomerDetail(customerId) {
  app.innerHTML = navHeaderHtml('Memuat...', '#/home');

  try {
    const c = await api('/customers/' + customerId);
    const initials = c.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    const historyRows = (c.visits || []).slice(0, 5).map(v => `
      <div style="display:flex;justify-content:space-between;background:#fff;border:1px solid #ECECEC;border-radius:10px;padding:10px 13px;font-size:12.5px;margin-bottom:8px;">
        <span style="color:#303030;">${new Date(v.checkinAt).toLocaleDateString('id-ID')}</span>
        <span style="color:#888888;">${formatJam(v.checkinAt)}</span>
      </div>`).join('') || '<p style="color:#999;font-size:13px;">Belum ada riwayat kunjungan.</p>';

    app.innerHTML = `
      ${navHeaderHtml('Detail Customer', '#/home')}
      <div style="flex:1;overflow-y:auto;padding:20px;">
        <div style="display:flex;flex-direction:column;align-items:center;text-align:center;margin-bottom:18px;">
          ${c.photoUrl ? `<img src="${API}${c.photoUrl}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;margin-bottom:10px;">` : `<div style="width:72px;height:72px;border-radius:50%;background:#057C43;color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:24px;margin-bottom:10px;">${initials}</div>`}
          <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:18px;color:#1a1a1a;">${c.name}</div>
          <div style="display:flex;gap:6px;margin-top:8px;">
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:oklch(93% 0.05 145 / 0.6);color:#057C43;">${c.category?.name || '-'}</span>
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${c.verified ? 'oklch(93% 0.05 145 / 0.6)' : '#FBEBD5'};color:${c.verified ? '#057C43' : '#8a5c26'};">${c.verified ? 'Aktif' : 'Menunggu Approval'}</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:1px;background:#ECECEC;border-radius:12px;overflow:hidden;margin-bottom:18px;">
          <div style="background:#fff;padding:13px 15px;"><div style="font-size:11px;color:#999999;margin-bottom:3px;">Alamat</div><div style="font-size:13.5px;color:#303030;">${c.address}, ${c.city}, ${c.province}</div></div>
          <div style="background:#fff;padding:13px 15px;"><div style="font-size:11px;color:#999999;margin-bottom:3px;">No. Telepon</div><div style="font-size:13.5px;color:#303030;">${c.phone}</div></div>
          <div style="background:#fff;padding:13px 15px;"><div style="font-size:11px;color:#999999;margin-bottom:3px;">Sales Bertanggung Jawab</div><div style="font-size:13.5px;color:#303030;">${c.sales?.name || '-'}</div></div>
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

async function renderAddCustomerForm() {
  app.innerHTML = `<div class="topbar-nav"><button class="back-btn" onclick="navigate('#/home')">‹</button><p class="title">Memuat...</p></div>`;

  try {
    const categories = await api('/customer-categories');
    state.categories = categories;

    const categoryOptions = categories.map(cat => `<option value="${cat.id}">${cat.name}</option>`).join('');
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
            <div style="flex:1;">${fieldLabel('Kota')}<input type="text" id="new-customer-city" style="${inputStyle}"></div>
            <div style="flex:1;">${fieldLabel('Provinsi')}<input type="text" id="new-customer-province" style="${inputStyle}"></div>
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
      (latitude, longitude) => {
        addCustomerLocation = { latitude, longitude };
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
    <div style="display:flex;align-items:center;gap:10px;background:#fff;border-radius:9px;padding:8px 10px;margin-bottom:8px;">
      ${c.photoUrl ? `<img src="${API}${c.photoUrl}" style="width:30px;height:30px;border-radius:50%;object-fit:cover;flex-shrink:0;">` : `<div style="width:30px;height:30px;border-radius:50%;background:#8a5c26;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${c.name.slice(0,2).toUpperCase()}</div>`}
      <div style="flex:1;"><div style="font-size:12.5px;font-weight:700;color:#1a1a1a;">${c.name}</div><div style="font-size:11px;color:#999999;">± ${c.distanceMeters}m dari lokasi ini</div></div>
      <button onclick="navigate('#/edit-customer/${c.id}')" style="width:auto;border:none;background:#8a5c26;color:#fff;border-radius:8px;padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;">Ini sama</button>
    </div>`).join('');

  document.getElementById('candidate-list').innerHTML = `
    <div style="background:#FFF6DF;border:1px solid #F0D9A6;border-radius:11px;padding:11px 13px;">
      <div style="font-size:12px;font-weight:700;color:#8a5c24;margin-bottom:8px;">Kandidat duplikat terdeteksi</div>
      ${rows}
      <button onclick="submitNewCustomer()" style="width:100%;margin-top:4px;border:1.5px solid #8a5c26;background:#fff;color:#8a5c26;border-radius:8px;padding:9px;font-size:12.5px;font-weight:700;cursor:pointer;">Bukan, ini customer berbeda — lanjut tambah</button>
    </div>
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
    if (IS_NATIVE_APP) headers['X-Client-App'] = 'sales-canvas-apk';
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
    const fieldLabel = (text) => `<div style="font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:#777777;margin-bottom:6px;">${text}</div>`;
    const inputStyle = `width:100%;box-sizing:border-box;padding:12px 13px;border-radius:11px;border:1.5px solid #E4E4E4;font-family:'Manrope',sans-serif;font-size:14.5px;color:#303030;`;

    app.innerHTML = `
      ${navHeaderHtml('Edit Customer', '#/customer/' + customerId)}
      <div style="flex:1;overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:13px;">
        <div>${fieldLabel('Golongan')}<select id="edit-customer-category" style="${inputStyle}background:#fff;">${categoryOptions}</select></div>
        <div>${fieldLabel('Nama Customer')}<input type="text" id="edit-customer-name" value="${c.name}" style="${inputStyle}"></div>
        <div>${fieldLabel('Alamat')}<textarea id="edit-customer-address" rows="2" style="${inputStyle}resize:none;">${c.address || ''}</textarea></div>
        <div style="display:flex;gap:10px;">
          <div style="flex:1;">${fieldLabel('Kota')}<input type="text" id="edit-customer-city" value="${c.city || ''}" style="${inputStyle}"></div>
          <div style="flex:1;">${fieldLabel('Provinsi')}<input type="text" id="edit-customer-province" value="${c.province || ''}" style="${inputStyle}"></div>
        </div>
        <div>${fieldLabel('No. Telepon')}<input type="tel" id="edit-customer-phone" value="${c.phone || ''}" style="${inputStyle}"></div>
        <label for="edit-customer-photo" id="edit-photo-drop-label" style="border:1.5px dashed #C9C9C9;border-radius:12px;padding:22px;text-align:center;cursor:pointer;color:#999999;font-size:13px;font-weight:600;display:block;">${c.photoUrl ? 'Foto tersimpan · ketuk untuk ganti' : 'Ketuk untuk ambil/pilih foto'}</label>
        <input type="file" id="edit-customer-photo" accept="image/*" capture="environment" style="display:none;">
        <div id="edit-customer-error"></div>
        <button id="save-customer-btn" style="width:100%;padding:14px;border:none;border-radius:12px;background:linear-gradient(135deg,#057C43,#0a5c33);color:#fff;font-weight:700;font-size:14.5px;cursor:pointer;margin-top:6px;">Simpan Perubahan</button>
      </div>
    `;

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
    if (IS_NATIVE_APP) headers['X-Client-App'] = 'sales-canvas-apk';
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
  const customer = state.customers.find(c => c.id === customerId);
  app.innerHTML = `
    ${navHeaderHtml('Check-in', '#/customer/' + customerId)}
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:30px;gap:20px;">
      <div style="width:90px;height:90px;border-radius:50%;background:oklch(93% 0.05 145 / 0.5);display:flex;align-items:center;justify-content:center;">
        <div id="checkin-pulse" style="width:52px;height:52px;border-radius:50%;background:#057C43;animation:damarPulse 2s infinite;"></div>
      </div>
      <div style="text-align:center;">
        <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:17px;color:#1a1a1a;margin-bottom:6px;">${customer ? customer.name : 'Customer'}</div>
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
      <div style="padding:11px 18px;border-radius:10px;background:oklch(93% 0.05 145 / 0.5);color:#057C43;font-size:13px;font-weight:700;">Check-in berhasil dicatat</div>`;

    setTimeout(() => navigate(`#/order/${customerId}/${result.visit.id}`), 900);
  } catch (err) {
    document.getElementById('checkin-status').innerHTML = `<div class="error-box">${err.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Coba lagi';
  }
}

// ====== INPUT ORDER ======
async function renderOrderForm(customerId, visitId) {
  const customer = state.customers.find(c => c.id === customerId);
  app.innerHTML = navHeaderHtml('Memuat produk...', '#/customer/' + customerId);

  try {
    const products = await api('/products');
    state.products = products;

    const rows = products.map(p => `
      <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #ECECEC;border-radius:12px;padding:11px 13px;margin-bottom:9px;">
        <div><div style="font-size:13.5px;font-weight:700;color:#1a1a1a;">${p.name}</div><div style="font-size:12px;color:#888888;">${formatRupiah(p.price)} / ${p.unit}</div></div>
        <div style="display:flex;align-items:center;gap:9px;">
          <button type="button" onclick="stepQty('${p.id}',-1)" style="width:26px;height:26px;border-radius:50%;border:1px solid #D8D8D8;background:#fff;font-weight:700;cursor:pointer;">-</button>
          <div id="qty-${p.id}" data-product-id="${p.id}" data-price="${p.price}" class="qty-value" style="width:20px;text-align:center;font-weight:700;font-size:14px;">0</div>
          <button type="button" onclick="stepQty('${p.id}',1)" style="width:26px;height:26px;border-radius:50%;border:none;background:#057C43;color:#fff;font-weight:700;cursor:pointer;">+</button>
        </div>
      </div>`).join('');

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
      </div>
    `;

    state.selectedPayMethod = 'CASH';
    setPayMethod('CASH');
    document.getElementById('submit-order-btn').addEventListener('click', () => submitOrder(customerId, visitId));
  } catch (err) {
    app.innerHTML = `${navHeaderHtml('Input Order', '#/customer/' + customerId)}<div style="padding:20px;"><div class="error-box">${err.message}</div></div>`;
  }
}

function stepQty(productId, delta) {
  const el = document.getElementById('qty-' + productId);
  const current = parseInt(el.textContent, 10) || 0;
  el.textContent = Math.max(0, current + delta);
  recalcOrderTotal();
}

function recalcOrderTotal() {
  let total = 0;
  document.querySelectorAll('.qty-value').forEach(el => {
    total += (parseInt(el.textContent, 10) || 0) * parseFloat(el.dataset.price);
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
      body: JSON.stringify({ customerId, visitId: (visitId && visitId !== 'none') ? visitId : null, paymentMethod, items }),
    });
    navigate('#/receipt/' + order.id);
  } catch (err) {
    errorBox.innerHTML = `<div class="error-box">${err.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Kirim Pesanan';
  }
}

// ====== RIWAYAT ======
async function renderHistory() {
  app.innerHTML = `<div style="padding:22px 20px;"><p style="color:var(--text-muted);font-size:14px;">Memuat...</p></div>${tabBarHtml('history')}`;

  try {
    const visits = await api('/visits');
    const rows = visits.map(v => `
      <div style="display:flex;align-items:center;justify-content:space-between;background:#fff;border:1px solid #ECECEC;border-radius:12px;padding:12px 14px;margin-bottom:8px;">
        <div>
          <div style="font-size:13.5px;font-weight:700;color:#1a1a1a;">${v.customer.name}</div>
          <div style="font-size:12px;color:#888888;margin-top:2px;">${new Date(v.checkinAt).toLocaleDateString('id-ID')}</div>
        </div>
        <div style="font-size:13px;font-weight:700;color:#057C43;">${formatJam(v.checkinAt)}</div>
      </div>`).join('') || '<p style="color:#999;font-size:13px;">Belum ada riwayat kunjungan.</p>';

    app.innerHTML = `
      <div style="flex:1;overflow-y:auto;padding:22px 20px 16px;">
        <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:20px;color:#1a1a1a;margin-bottom:16px;">Riwayat Kunjungan</div>
        ${rows}
      </div>
      ${tabBarHtml('history')}
    `;
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

  app.innerHTML = `
    <div style="flex:1;overflow-y:auto;padding:22px 20px 16px;">
      <div style="display:flex;flex-direction:column;align-items:center;text-align:center;padding-top:14px;margin-bottom:26px;">
        <div style="width:76px;height:76px;border-radius:50%;background:linear-gradient(135deg,#057C43,#7AB41D);color:#fff;display:flex;align-items:center;justify-content:center;font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:26px;margin-bottom:12px;">${initials}</div>
        <div style="font-family:'Trebuchet MS',sans-serif;font-weight:700;font-size:19px;color:#1a1a1a;">${state.user?.name || '-'}</div>
        <div style="font-size:13px;color:#888888;margin-top:2px;">${state.user?.email || '-'}</div>
        <span style="margin-top:10px;font-size:11px;font-weight:700;padding:4px 12px;border-radius:20px;background:oklch(93% 0.05 145 / 0.5);color:#057C43;">${roleLabel}</span>
      </div>
      ${targetHtml}
      <button onclick="logout()" style="width:100%;padding:13px;border:1.5px solid #E28686;border-radius:11px;background:#fff;color:#B3261E;font-weight:700;font-size:14px;cursor:pointer;">Keluar</button>
    </div>
    ${tabBarHtml('profile')}
  `;
}
