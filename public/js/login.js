/* Login / Register - two portals:
   Student (orders food) and Vendor (sells food), each with Sign In + Sign Up. */
document.addEventListener('DOMContentLoaded', () => {
  const roleView = document.getElementById('roleView');
  const authView = document.getElementById('authView');
  const loginForm = document.getElementById('loginForm');
  const studentRegForm = document.getElementById('studentRegisterForm');
  const vendorRegForm = document.getElementById('vendorRegisterForm');

  const params = new URLSearchParams(location.search);
  const next = params.get('next') || '/';
  let role = 'student'; // 'student' | 'vendor'
  let tab = 'login';    // 'login' | 'register'

  // ---------- View switching ----------
  function showRoleView() {
    roleView.hidden = false;
    authView.hidden = true;
  }

  function showAuthView(selected) {
    role = selected;
    roleView.hidden = true;
    authView.hidden = false;
    tab = 'login'; // always start at Sign In when a portal is chosen

    const isVendor = role === 'vendor';
    const tag = document.getElementById('portalTag');
    tag.className = 'portal-tag ' + (isVendor ? 'vendor' : 'student');
    tag.innerHTML = isVendor
      ? '<i class="bi bi-shop-window"></i> Vendor Portal'
      : '<i class="bi bi-mortarboard-fill"></i> Student Portal';
    document.getElementById('portalIco').textContent = isVendor ? '🛒' : '🎓';
    document.getElementById('formTitle').textContent = isVendor ? 'Vendor access' : 'Student access';
    document.getElementById('formSub').textContent = isVendor
      ? 'Sign in to run your canteen, or sign up to start selling.'
      : 'Sign in to order food, or create an account in seconds.';
    setTab(tab);
  }

  function setTab(t) {
    tab = t;
    const isLogin = t === 'login';
    document.getElementById('tabLogin').classList.toggle('active', isLogin);
    document.getElementById('tabRegister').classList.toggle('active', !isLogin);

    loginForm.hidden = !isLogin;
    studentRegForm.hidden = isLogin || role !== 'student';
    vendorRegForm.hidden = isLogin || role !== 'vendor';

    // Clear validation styling when switching between Sign In / Sign Up
    [loginForm, studentRegForm, vendorRegForm].forEach((f) => f.classList.remove('was-validated'));
    [loginForm, studentRegForm, vendorRegForm].forEach((f) =>
      f.querySelectorAll('.is-invalid').forEach((el) => el.classList.remove('is-invalid')));

    const first = isLogin
      ? document.getElementById('loginEmail')
      : (role === 'vendor' ? document.getElementById('vName') : document.getElementById('sName'));
    first.focus({ preventScroll: true });
  }

  // Show / hide password toggles
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-pw-toggle]');
    if (!btn) return;
    const input = document.getElementById(btn.dataset.pwToggle);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.innerHTML = show ? '<i class="bi bi-eye-slash"></i>' : '<i class="bi bi-eye"></i>';
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });

  // ---------- Portal choice ----------
  document.querySelectorAll('[data-role]').forEach((btn) => {
    btn.addEventListener('click', () => showAuthView(btn.dataset.role));
  });
  document.getElementById('backBtn').addEventListener('click', (e) => { e.preventDefault(); showRoleView(); });
  document.getElementById('tabLogin').addEventListener('click', () => setTab('login'));
  document.getElementById('tabRegister').addEventListener('click', () => setTab('register'));
  document.querySelectorAll('[data-goto-login]').forEach((a) => {
    a.addEventListener('click', (e) => { e.preventDefault(); setTab('login'); });
  });

  // ---------- Redirect after auth ----------
  function redirect() {
    const user = SC.user;
    if (!user) return;
    if (user.role === 'student') window.location.href = next;
    else window.location.href = '/admin'; // vendors & admins run the dashboard
  }

  SC.loadSession().then((user) => { if (user) redirect(); });

  // Deep links: /login?role=vendor or /login?role=student
  if (params.get('role') === 'vendor') showAuthView('vendor');
  else if (params.get('role') === 'student') showAuthView('student');

  // ---------- Sign in ----------
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!loginForm.checkValidity()) { loginForm.classList.add('was-validated'); return; }

    const btn = document.getElementById('loginBtn');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Signing in…';
    try {
      const data = await SC.api('/api/auth/login', {
        method: 'POST',
        body: {
          email: document.getElementById('loginEmail').value.trim(),
          password: document.getElementById('loginPassword').value
        }
      });

      // Portal safety: students can only enter the student portal,
      // vendors/admins only the vendor portal.
      if (role === 'student' && data.user.role !== 'student') {
        SC.toast('This is a vendor account. Please use the Vendor portal.', 'error');
        btn.disabled = false; btn.textContent = label;
        return;
      }
      if (role === 'vendor' && data.user.role === 'student') {
        SC.toast('This is a student account. Please use the Student portal.', 'error');
        btn.disabled = false; btn.textContent = label;
        return;
      }

      SC.user = data.user;
      SC.renderAuthLinks();
      SC.toast(`Welcome back, ${data.user.name.split(' ')[0]}!`);
      setTimeout(redirect, 500);
    } catch (err) {
      SC.toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = label;
    }
  });

  // ---------- Student sign up ----------
  studentRegForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!studentRegForm.checkValidity()) { studentRegForm.classList.add('was-validated'); return; }
    const btn = document.getElementById('sRegBtn');
    btn.disabled = true;
    btn.textContent = 'Creating account…';
    try {
      const data = await SC.api('/api/auth/register', {
        method: 'POST',
        body: {
          role: 'student',
          name: document.getElementById('sName').value.trim(),
          email: document.getElementById('sEmail').value.trim(),
          password: document.getElementById('sPassword').value,
          student_id: document.getElementById('sSid').value.trim()
        }
      });
      SC.user = data.user;
      SC.renderAuthLinks();
      SC.toast('Student account created — welcome!');
      setTimeout(redirect, 500);
    } catch (err) {
      SC.toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Create student account';
    }
  });

  // ---------- Vendor sign up ----------
  vendorRegForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!vendorRegForm.checkValidity()) { vendorRegForm.classList.add('was-validated'); return; }
    const btn = document.getElementById('vRegBtn');
    btn.disabled = true;
    btn.textContent = 'Creating account…';
    try {
      const data = await SC.api('/api/auth/register', {
        method: 'POST',
        body: {
          role: 'vendor',
          name: document.getElementById('vName').value.trim(),
          shop_name: document.getElementById('vShop').value.trim(),
          email: document.getElementById('vEmail').value.trim(),
          password: document.getElementById('vPassword').value
        }
      });
      SC.user = data.user;
      SC.renderAuthLinks();
      SC.toast('Vendor account created — you can start selling!');
      setTimeout(redirect, 500);
    } catch (err) {
      SC.toast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Create vendor account';
    }
  });
});
