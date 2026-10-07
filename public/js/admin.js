/* ============================================================
   Smart Canteen - Admin layout (sidebar, topbar, auth guard)
   ============================================================ */
const Admin = {
  page: document.body.dataset.page || 'dashboard',

  titles: {
    dashboard: ['Dashboard', 'Overview of today’s canteen activity'],
    orders: ['Order Management', 'Incoming orders and status updates'],
    menu: ['Menu Management', 'Add, edit and remove food items'],
    inventory: ['Inventory', 'Stock levels and low-stock alerts'],
    sales: ['Sales Management', 'Transactions, payments and exports'],
    analytics: ['Reports & Analytics', 'Charts, trends and popular items'],
    users: ['User Management', 'Students, vendors and administrator accounts']
  },

  navItems: [
    { id: 'dashboard', href: '/admin', icon: 'speedometer2', label: 'Dashboard' },
    { id: 'orders', href: '/admin/orders', icon: 'receipt', label: 'Orders' },
    { id: 'menu', href: '/admin/menu', icon: 'cup-hot', label: 'Menu Management' },
    { id: 'inventory', href: '/admin/inventory', icon: 'boxes', label: 'Inventory' },
    { id: 'sales', href: '/admin/sales', icon: 'currency-exchange', label: 'Sales' },
    { id: 'analytics', href: '/admin/analytics', icon: 'graph-up-arrow', label: 'Reports' },
    { id: 'users', href: '/admin/users', icon: 'people', label: 'User Management', adminOnly: true }
  ],

  // Render sidebar + topbar, verify vendor/admin session.
  // allowedRoles defaults to both staff roles; pass ['admin'] for admin-only pages.
  async init(allowedRoles = ['admin', 'vendor']) {
    const user = await SC.requireAuth(allowedRoles);
    if (!user) return null;

    const nav = Admin.navItems.filter((n) => !n.adminOnly || user.role === 'admin');

    document.getElementById('adminSidebarMount').outerHTML = `
      <aside class="admin-sidebar" id="adminSidebar">
        <div class="brand"><span class="brand-mark">🍽️</span> Smart Canteen</div>
        <div class="nav-section">Management</div>
        ${nav.map((n) => `
          <a class="side-link ${n.id === Admin.page ? 'active' : ''}" href="${n.href}">
            <i class="bi bi-${n.icon}"></i>${n.label}
          </a>`).join('')}
        <div class="nav-section">Account</div>
        <a class="side-link" href="/profile"><i class="bi bi-person-gear"></i>My Profile</a>
        <a class="side-link" href="/" target="_blank"><i class="bi bi-globe2"></i>View Student Site</a>
        <div class="side-foot">
          <button class="btn btn-outline-light w-100 btn-sm" data-logout-btn>
            <i class="bi bi-box-arrow-right me-1"></i>Logout
          </button>
        </div>
      </aside>
      <div class="admin-scrim" id="adminScrim"></div>`;

    const [title, sub] = Admin.titles[Admin.page] || Admin.titles.dashboard;
    document.getElementById('adminTopbarMount').outerHTML = `
      <header class="admin-topbar">
        <button class="side-toggle" id="sideToggle" aria-label="Toggle menu"><i class="bi bi-list"></i></button>
        <div class="flex-grow-1">
          <h5>${title}</h5>
          <div class="sub d-none d-sm-block">${sub}</div>
        </div>
        <span class="badge bg-light text-dark border d-none d-md-inline"><i class="bi bi-person-circle me-1"></i>${SC.esc(user.role !== 'student' && user.shop_name ? user.shop_name + ' · ' + user.name : user.name)}</span>
      </header>`;

    document.getElementById('sideToggle').addEventListener('click', () => document.body.classList.toggle('sidebar-open'));
    document.getElementById('adminScrim').addEventListener('click', () => document.body.classList.remove('sidebar-open'));
    document.title = `${title} — Smart Canteen Admin`;
    return user;
  },

  // <select> for changing order status
  statusSelect(order) {
    const statuses = ['pending', 'confirmed', 'preparing', 'ready', 'completed', 'cancelled'];
    return `
      <select class="form-select status-select" data-status-for="${order.id}">
        ${statuses.map((s) => `<option value="${s}" ${s === order.order_status ? 'selected' : ''}>${s}</option>`).join('')}
      </select>`;
  },

  async changeStatus(id, status) {
    await SC.api(`/api/orders/${id}/status`, { method: 'PUT', body: { status } });
    SC.toast('Order status updated');
  }
};

// Close sidebar when a nav link is clicked (mobile)
document.addEventListener('click', (e) => {
  if (e.target.closest('.admin-sidebar .side-link')) document.body.classList.remove('sidebar-open');
});
