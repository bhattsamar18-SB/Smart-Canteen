/* ============================================================
   Smart Canteen - shared frontend helpers (app.js)
   - fetch wrapper, toasts, session, loader, confirm modal
   - injects mobile bottom-nav, footer and toast host
   ============================================================ */
const SC = {
  user: null,

  // ---- API helper ----
  async api(path, { method = 'GET', body, silent = false } = {}) {
    if (!silent) SC.loading(true);
    try {
      const res = await fetch(path, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
      });
      let data = null;
      try { data = await res.json(); } catch (e) { /* non-JSON response */ }
      if (!res.ok) throw new Error((data && data.message) || `Request failed (${res.status})`);
      return data;
    } catch (err) {
      if (err.message === 'Failed to fetch') err.message = 'Cannot reach the server. Is it running?';
      throw err;
    } finally {
      if (!silent) SC.loading(false);
    }
  },

  // ---- Loader ----
  loading(show) {
    const el = document.getElementById('pageLoader');
    if (el) el.classList.toggle('show', !!show);
  },

  // ---- Toasts ----
  toast(message, type = 'success') {
    const host = document.getElementById('toastHost');
    if (!host) return;
    const icons = { success: 'check-circle-fill', error: 'exclamation-triangle-fill', warning: 'exclamation-circle-fill', info: 'info-circle-fill' };
    const el = document.createElement('div');
    el.className = `sc-toast ${type}`;
    el.innerHTML = `<i class="bi bi-${icons[type] || icons.info} t-ico"></i><div>${SC.esc(message)}</div>`;
    host.appendChild(el);
    setTimeout(() => {
      el.style.transition = '0.3s';
      el.style.opacity = '0';
      el.style.transform = 'translateX(30px)';
      setTimeout(() => el.remove(), 320);
    }, 3200);
  },

  // ---- Confirm modal ----
  confirm(message, title = 'Are you sure?') {
    return new Promise((resolve) => {
      const modal = document.getElementById('scConfirmModal');
      if (!modal) return resolve(window.confirm(message));
      modal.querySelector('.sc-confirm-msg').textContent = message;
      modal.querySelector('.sc-confirm-title').textContent = title;
      const bs = bootstrap.Modal.getOrCreateInstance(modal);
      const onYes = () => { cleanup(); bs.hide(); resolve(true); };
      const onNo = () => { cleanup(); bs.hide(); resolve(false); };
      function cleanup() {
        modal.querySelector('[data-confirm-yes]').removeEventListener('click', onYes);
        modal.querySelector('[data-confirm-no]').removeEventListener('click', onNo);
      }
      modal.querySelector('[data-confirm-yes]').addEventListener('click', onYes);
      modal.querySelector('[data-confirm-no]').addEventListener('click', onNo);
      bs.show();
    });
  },

  // ---- Formatting ----
  money(n) {
    const value = Number(n) || 0;
    return '₹' + value.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  },
  fmtDate(s) {
    if (!s) return '—';
    const d = new Date(String(s).replace(' ', 'T'));
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  fmtTime(s) {
    if (!s) return '—';
    // "12:45:00" or ISO datetime -> "12:45 PM"
    const t = String(s).match(/(\d{2}):(\d{2})/);
    if (!t) return s;
    let h = Number(t[1]) % 12 || 12;
    const ap = Number(t[1]) >= 12 ? 'PM' : 'AM';
    return `${h}:${t[2]} ${ap}`;
  },
  statusBadge(status) {
    return `<span class="badge-status st-${SC.esc(status)}">${SC.esc(status)}</span>`;
  },
  esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => (
      { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
    ));
  },

  // ---- Session ----
  async loadSession(silent = true) {
    try {
      const data = await SC.api('/api/auth/me', { silent });
      SC.user = data.user;
    } catch (e) { SC.user = null; }
    SC.renderAuthLinks();
    document.dispatchEvent(new CustomEvent('sc:session', { detail: SC.user }));
    return SC.user;
  },
  renderAuthLinks() {
    const loggedIn = !!SC.user;
    const isStaff = loggedIn && SC.user.role !== 'student';
    document.querySelectorAll('[data-auth-link="login"]').forEach((el) => { el.hidden = loggedIn; });
    document.querySelectorAll('[data-auth-link="logout"]').forEach((el) => { el.hidden = !loggedIn; });
    document.querySelectorAll('[data-auth-link="admin"]').forEach((el) => {
      el.hidden = !isStaff;
      if (!el.hidden && !el.dataset.customLabel) el.innerHTML = '<i class="bi bi-speedometer2 me-1"></i>Dashboard';
    });
    document.querySelectorAll('[data-auth-link="name"]').forEach((el) => { el.textContent = loggedIn ? SC.user.name.split(' ')[0] : ''; el.hidden = !loggedIn; });
    document.querySelectorAll('.bottom-nav [data-auth-link="login"]').forEach((el) => {
      el.querySelector('.bn-label').textContent = loggedIn ? 'Account' : 'Sign In';
    });

    // Profile (credentials) link in the navbar when signed in
    document.querySelectorAll('nav.navbar .d-flex.align-items-center.gap-2').forEach((host) => {
      let link = host.querySelector('[data-profile-link]');
      if (loggedIn && !link) {
        link = document.createElement('a');
        link.href = '/profile';
        link.className = 'btn btn-sm btn-outline-primary';
        link.setAttribute('data-profile-link', '');
        link.innerHTML = '<i class="bi bi-person-gear me-1"></i>Profile';
        const loginBtn = host.querySelector('[data-auth-link="login"]');
        host.insertBefore(link, loginBtn || null);
      } else if (!loggedIn && link) {
        link.remove();
      }
    });
  },
  async logout() {
    try { await SC.api('/api/auth/logout', { method: 'POST', silent: true }); } catch (e) { /* ignore */ }
    SC.user = null;
    SC.toast('Logged out successfully.');
    setTimeout(() => { window.location.href = '/'; }, 400);
  },

  // ---- Auth guard for pages ---- role may be a string or an array of allowed roles
  async requireAuth(role) {
    const user = await SC.loadSession();
    if (!user) {
      SC.toast('Please sign in to continue.', 'warning');
      setTimeout(() => { window.location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search); }, 500);
      return null;
    }
    if (role) {
      const allowed = Array.isArray(role) ? role : [role];
      if (!allowed.includes(user.role)) {
        SC.toast('You do not have access to that page.', 'error');
        setTimeout(() => { window.location.href = '/'; }, 600);
        return null;
      }
    }
    return user;
  }
};

// ---------- Shared food card renderer (home + menu) ----------
function foodCard(item) {
  const out = !item.available || item.stock <= 0;
  const low = !out && item.stock <= item.minimum_stock;
  const stockCls = out ? 'stock-out' : low ? 'stock-low' : 'stock-ok';
  const stockTxt = !item.available ? 'Unavailable' : out ? 'Out of stock' : low ? `Only ${item.stock} left` : `${item.stock} in stock`;
  const img = item.image || '/assets/food/burger.svg';
  const qty = Math.min(item.qty || 1, Math.max(item.stock || 1, 1));

  return `
  <div class="food-card">
    <div class="thumb">
      <img src="${SC.esc(img)}" alt="${SC.esc(item.name)}" loading="lazy" onerror="this.src='/assets/food/burger.svg'">
      ${out ? '<div class="out-overlay">OUT OF STOCK</div>' : ''}
    </div>
    <div class="body">
      <div class="d-flex justify-content-between align-items-start gap-2">
        <span class="cat">${SC.esc(item.category)}</span>
        <span class="stock-pill ${stockCls}">${stockTxt}</span>
      </div>
      <h5>${SC.esc(item.name)}</h5>
      ${item.vendor_shop ? `<div class="text-secondary" style="font-size:.74rem;margin-top:-2px"><i class="bi bi-shop"></i> ${SC.esc(item.vendor_shop)}</div>` : ''}
      <p class="desc">${SC.esc(item.description)}</p>
      <div class="d-flex justify-content-between align-items-center">
        <span class="price">${SC.money(item.price)}</span>
        ${out ? '' : `
        <div class="qty">
          <button type="button" data-step="-1" aria-label="Decrease">−</button>
          <input type="text" inputmode="numeric" value="1" min="1" max="${item.stock}" data-qty-for="${item.id}">
          <button type="button" data-step="1" aria-label="Increase">+</button>
        </div>`}
      </div>
      <div class="card-foot">
        <button class="btn btn-primary w-100" ${out ? 'disabled' : ''}
          data-add-id="${item.id}" data-add-name="${SC.esc(item.name)}" data-add-price="${item.price}" data-add-image="${SC.esc(img)}">
          ${out ? '<i class="bi bi-slash-circle me-1"></i>Out of Stock' : '<i class="bi bi-bag-plus me-1"></i>Add to Cart'}
        </button>
      </div>
    </div>
  </div>`;
}

// ---------- Chrome injection (loader, toasts, confirm modal, bottom nav, footer) ----------
function scInjectChrome() {
  const isHome = location.pathname === '/';
  const isAdmin = document.body.dataset.layout === 'admin';

  const chrome = [`
    <div class="page-loader" id="pageLoader"><div class="spinner-border spinner-lg" role="status"></div></div>
    <div id="toastHost"></div>
  `];

  chrome.push(`
    <div class="modal fade" id="scConfirmModal" tabindex="-1" aria-hidden="true">
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content" style="border-radius:18px">
          <div class="modal-body p-4 text-center">
            <div style="font-size:2.4rem">⚠️</div>
            <h5 class="sc-confirm-title mt-2">Are you sure?</h5>
            <p class="sc-confirm-msg text-secondary"></p>
            <div class="d-grid gap-2 mt-3">
              <button class="btn btn-danger" data-confirm-yes>Yes, continue</button>
              <button class="btn btn-outline-secondary" data-confirm-no type="button">Cancel</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `);

  if (!isAdmin) chrome.push(`
    <nav class="bottom-nav mobile-only">
      <a href="/" class="${isHome ? 'active' : ''}"><i class="bi bi-house-door bn-ico"></i><span class="bn-label">Home</span></a>
      <a href="/menu" class="${location.pathname === '/menu' ? 'active' : ''}"><i class="bi bi-grid bn-ico"></i><span class="bn-label">Menu</span></a>
      <button type="button" data-bs-toggle="offcanvas" data-bs-target="#cartOffcanvas"><i class="bi bi-bag bn-ico"></i><span class="bn-label">Cart</span><span class="cart-count" hidden>0</span></button>
      <a href="/orders" class="${location.pathname === '/orders' ? 'active' : ''}"><i class="bi bi-receipt bn-ico"></i><span class="bn-label">Orders</span></a>
      <a href="/login" data-auth-link="login"><i class="bi bi-person bn-ico"></i><span class="bn-label">Login</span></a>
      <button type="button" data-auth-link="logout" hidden data-logout-btn><i class="bi bi-box-arrow-right bn-ico"></i><span class="bn-label">Logout</span></button>
    </nav>

    <footer class="footer mobile-only-fix">
      <div class="container">
        <div class="row g-4">
          <div class="col-lg-4">
            <div class="d-flex align-items-center gap-2 mb-2">
              <span class="brand-mark" style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,var(--primary),var(--primary-dark));color:#fff;display:grid;place-items:center">🍽️</span>
              <b class="text-white" style="font-family:Poppins">Smart Canteen</b>
            </div>
            <p style="font-size:0.9rem">Order campus food online, skip the queue and pick up your meal when it's ready.</p>
          </div>
          <div class="col-6 col-lg-2"><h6>Quick Links</h6>
            <div class="d-flex flex-column gap-1" style="font-size:0.9rem">
              <a href="/">Home</a><a href="/menu">Menu</a><a href="/orders">My Orders</a><a href="/login">Sign In</a>
            </div></div>
          <div class="col-6 col-lg-2"><h6>Categories</h6>
            <div class="d-flex flex-column gap-1" style="font-size:0.9rem">
              <a href="/menu?category=Breakfast">Breakfast</a><a href="/menu?category=Snacks">Snacks</a><a href="/menu?category=Meals">Meals</a><a href="/menu?category=Beverages">Beverages</a>
            </div></div>
          <div class="col-lg-4"><h6>Canteen Hours</h6>
            <p style="font-size:0.9rem;margin:0">Mon – Sat · 8:00 AM – 5:00 PM<br>Campus Food Court, Block C<br>Need help? canteen@college.edu</p></div>
        </div>
        <hr style="border-color:#1e293b">
        <div class="d-flex justify-content-between flex-wrap gap-2" style="font-size:0.82rem">
          <span>© 2026 Smart Canteen Management System. Academic project.</span>
          <span>Built with Bootstrap 5 &amp; Node.js</span>
        </div>
      </div>
    </footer>
  `);

  document.body.insertAdjacentHTML('beforeend', chrome.join(''));

  // delegate logout clicks
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-logout-btn]')) SC.logout();
  });
}

// Quantity steppers with [data-qty] inputs (generic, used by menu cards)
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-step]');
  if (!btn) return;
  const input = btn.parentElement.querySelector('input');
  const step = Number(btn.dataset.step);
  const min = Number(input.min || 1);
  const max = Number(input.max || 99);
  input.value = Math.min(max, Math.max(min, Number(input.value || 1) + step));
  input.dispatchEvent(new Event('change', { bubbles: true }));
});

document.addEventListener('DOMContentLoaded', () => {
  scInjectChrome();
  SC.loadSession();
});
