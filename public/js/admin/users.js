/* User management - admin creates, edits, restricts and deletes accounts */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await Admin.init(['admin']); // administrator only
  if (!user) return;

  const body = document.getElementById('usersBody');
  const meta = document.getElementById('usersMeta');
  const form = document.getElementById('userForm');
  const modalEl = document.getElementById('userModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);

  const ROLE_BADGE = {
    student: 'bg-primary-subtle text-primary',
    vendor: 'bg-warning-subtle text-warning-emphasis',
    admin: 'bg-danger-subtle text-danger-emphasis'
  };
  const ROLE_ICON = { student: 'mortarboard', vendor: 'shop', admin: 'shield-lock' };

  let rows = []; // last loaded list

  // ---------- Load + render ----------
  async function load() {
    const q = new URLSearchParams();
    const search = document.getElementById('userSearch').value.trim();
    const role = document.getElementById('roleFilter').value;
    const status = document.getElementById('statusFilter').value;
    if (search) q.set('search', search);
    if (role) q.set('role', role);
    if (status) q.set('status', status);

    try {
      const data = await SC.api('/api/users' + (q.toString() ? '?' + q : ''));
      rows = data.users;
      render(data.stats);
    } catch (err) {
      body.innerHTML = `<tr><td colspan="7" class="empty-mini">${SC.esc(err.message)}</td></tr>`;
    }
  }

  function render(stats) {
    document.getElementById('kpiTotal').textContent = stats.total;
    document.getElementById('kpiStudents').textContent = stats.students;
    document.getElementById('kpiVendors').textContent = stats.vendors;
    document.getElementById('kpiRestricted').textContent = stats.restricted;

    if (!rows.length) {
      body.innerHTML = '<tr><td colspan="7" class="empty-mini">No accounts match these filters.</td></tr>';
      meta.textContent = '';
      return;
    }

    body.innerHTML = rows.map((u) => {
      const isMe = u.id === user.id;
      const detail = u.role === 'vendor'
        ? (u.shop_name ? SC.esc(u.shop_name) : '—')
        : (u.role === 'student' ? SC.esc(u.student_id || '—') : '—');
      const statusBadge = u.status === 'restricted'
        ? '<span class="badge-status st-cancelled">restricted</span>'
        : '<span class="badge-status st-completed">active</span>';

      return `
      <tr ${isMe ? 'style="background:var(--primary-light)"' : ''}>
        <td>
          <div class="fw-semibold">${SC.esc(u.name)} ${isMe ? '<span class="badge bg-secondary ms-1" style="font-size:.65rem">you</span>' : ''}</div>
          <div class="text-secondary" style="font-size:.8rem">${SC.esc(u.email)}</div>
        </td>
        <td><span class="badge ${ROLE_BADGE[u.role] || 'bg-secondary-subtle text-secondary'}"><i class="bi bi-${ROLE_ICON[u.role] || 'person'} me-1"></i>${SC.esc(u.role)}</span></td>
        <td class="text-secondary">${detail}</td>
        <td>${statusBadge}</td>
        <td class="text-end">${u.order_count}</td>
        <td class="text-secondary">${SC.fmtDate(u.created_at)}</td>
        <td style="text-align:right;white-space:nowrap">
          <button class="btn btn-sm btn-outline-primary" data-edit="${u.id}" title="Edit account"><i class="bi bi-pencil"></i></button>
          ${isMe ? '' : `
          <button class="btn btn-sm btn-outline-warning" data-toggle-status="${u.id}" data-next="${u.status === 'restricted' ? 'active' : 'restricted'}"
                  title="${u.status === 'restricted' ? 'Restore access' : 'Restrict account'}">
            <i class="bi bi-${u.status === 'restricted' ? 'unlock' : 'lock'}"></i>
          </button>
          <button class="btn btn-sm btn-outline-danger" data-delete="${u.id}" title="Delete account"><i class="bi bi-trash"></i></button>`}
        </td>
      </tr>`;
    }).join('');

    meta.textContent = `Showing ${rows.length} account${rows.length === 1 ? '' : 's'}.`;
  }

  // ---------- Filters ----------
  let debounce;
  document.getElementById('userSearch').addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(load, 250);
  });
  document.getElementById('roleFilter').addEventListener('change', load);
  document.getElementById('statusFilter').addEventListener('change', load);

  // ---------- Add / edit modal ----------
  function syncRoleFields() {
    const role = document.getElementById('uRole').value;
    document.getElementById('sidWrap').hidden = role !== 'student';
    document.getElementById('shopWrap').hidden = role !== 'vendor';
  }
  document.getElementById('uRole').addEventListener('change', syncRoleFields);

  function openAdd() {
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('userId').value = '';
    document.getElementById('userModalTitle').textContent = 'Add User';
    document.getElementById('userSave').textContent = 'Create account';
    document.getElementById('pwLabel').textContent = 'Password';
    document.getElementById('uPassword').required = true;
    document.getElementById('pwHelp').textContent = 'Min 6 characters.';
    document.getElementById('uStatus').disabled = false;
    document.getElementById('uRole').disabled = false;
    syncRoleFields();
    modal.show();
  }

  function openEdit(u) {
    form.reset();
    form.classList.remove('was-validated');
    document.getElementById('userId').value = u.id;
    document.getElementById('userModalTitle').textContent = 'Edit Account';
    document.getElementById('userSave').textContent = 'Save changes';
    document.getElementById('uName').value = u.name;
    document.getElementById('uEmail').value = u.email;
    document.getElementById('uRole').value = u.role;
    document.getElementById('uStatus').value = u.status;
    document.getElementById('uSid').value = u.student_id || '';
    document.getElementById('uShop').value = u.shop_name || '';
    // Password optional when editing
    document.getElementById('pwLabel').textContent = 'Reset password (optional)';
    document.getElementById('uPassword').required = false;
    document.getElementById('uPassword').value = '';
    document.getElementById('pwHelp').textContent = 'Leave blank to keep the current password.';
    // Lock role/status of the signed-in admin (server also enforces this)
    const isMe = u.id === user.id;
    document.getElementById('uRole').disabled = isMe;
    document.getElementById('uStatus').disabled = isMe;
    syncRoleFields();
    modal.show();
  }

  document.getElementById('addUserBtn').addEventListener('click', openAdd);

  // ---------- Row actions ----------
  body.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    const delBtn = e.target.closest('[data-delete]');
    const togBtn = e.target.closest('[data-toggle-status]');

    if (editBtn) {
      const u = rows.find((r) => r.id === Number(editBtn.dataset.edit));
      if (u) openEdit(u);
    }

    if (togBtn) {
      const id = Number(togBtn.dataset.toggleStatus);
      const next = togBtn.dataset.next;
      const u = rows.find((r) => r.id === id);
      if (!u) return;
      const ok = await SC.confirm(
        next === 'restricted'
          ? `${u.name} will be signed out and blocked from logging in. Their data and orders stay untouched.`
          : `${u.name} will be able to sign in again.`,
        next === 'restricted' ? 'Restrict this account?' : 'Restore access?'
      );
      if (!ok) return;
      try {
        await SC.api(`/api/users/${id}`, { method: 'PUT', body: { status: next } });
        SC.toast(next === 'restricted' ? 'Account restricted.' : 'Account restored.');
        load();
      } catch (err) { SC.toast(err.message, 'error'); }
    }

    if (delBtn) {
      const id = Number(delBtn.dataset.delete);
      const u = rows.find((r) => r.id === id);
      if (!u) return;
      const ok = await SC.confirm(
        `This permanently removes ${u.name}'s account (${u.email}). Past orders stay in sales history.`,
        'Delete this account?'
      );
      if (!ok) return;
      try {
        await SC.api(`/api/users/${id}`, { method: 'DELETE' });
        SC.toast('Account deleted.');
        load();
      } catch (err) { SC.toast(err.message, 'error'); }
    }
  });

  // ---------- Save (add or edit) ----------
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const id = document.getElementById('userId').value;
    const role = document.getElementById('uRole').value;
    const status = document.getElementById('uStatus').value;
    const password = document.getElementById('uPassword').value;

    const payload = {
      name: document.getElementById('uName').value.trim(),
      email: document.getElementById('uEmail').value.trim(),
      role,
      status
    };
    if (role === 'student') payload.student_id = document.getElementById('uSid').value.trim();
    if (role === 'vendor') payload.shop_name = document.getElementById('uShop').value.trim();
    if (password) payload.password = password;

    const btn = document.getElementById('userSave');
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      if (id) {
        await SC.api(`/api/users/${id}`, { method: 'PUT', body: payload });
        SC.toast('Account updated.');
      } else {
        if (!password) throw new Error('Password is required for a new account.');
        await SC.api('/api/users', { method: 'POST', body: payload });
        SC.toast('Account created.');
      }
      modal.hide();
      load();
    } catch (err) {
      SC.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = label;
    }
  });

  load();
});
