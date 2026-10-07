/* Profile & credentials management - details + password change */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await SC.requireAuth();
  if (!user) return;

  const isStudent = user.role === 'student';

  // ---- Fill the account summary ----
  function fillSummary(u) {
    document.getElementById('heroAva').textContent = isStudent ? '🎓' : '🛒';
    document.getElementById('heroName').textContent = u.name;
    document.getElementById('heroEmail').textContent = u.email;

    const roleChip = document.getElementById('heroRole');
    const roleLabel = u.role === 'student' ? 'Student' : u.role === 'vendor' ? 'Vendor' : 'Admin';
    roleChip.textContent = roleLabel;
    roleChip.classList.toggle('vendor', u.role !== 'student');

    document.getElementById('roleValue').textContent = roleLabel;
    document.getElementById('sinceValue').textContent = SC.fmtDate(u.created_at);

    // Role-specific identity fields
    const idKey = document.getElementById('idKeyLabel');
    const idVal = document.getElementById('idValue');
    if (isStudent) {
      idKey.textContent = 'Student ID';
      idVal.textContent = u.student_id || 'Not set';
    } else {
      idKey.textContent = 'Shop / Canteen';
      idVal.textContent = u.shop_name || 'Not set';
    }

    // Details form
    document.getElementById('pfName').value = u.name || '';
    document.getElementById('pfEmail').value = u.email || '';
    document.getElementById('studentIdWrap').hidden = !isStudent;
    document.getElementById('shopNameWrap').hidden = isStudent;
    if (isStudent) document.getElementById('pfSid').value = u.student_id || '';
    else document.getElementById('pfShop').value = u.shop_name || '';
  }
  fillSummary(user);

  function setBtn(btn, html) { btn.innerHTML = html; }

  // ---- Save personal details ----
  document.getElementById('detailsForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.target.checkValidity()) { e.target.classList.add('was-validated'); return; }

    const payload = {
      name: document.getElementById('pfName').value.trim(),
      email: document.getElementById('pfEmail').value.trim()
    };
    if (isStudent) payload.student_id = document.getElementById('pfSid').value.trim();
    else payload.shop_name = document.getElementById('pfShop').value.trim();

    const btn = document.getElementById('saveDetailsBtn');
    setBtn(btn, '<span class="spinner-border spinner-border-sm me-1"></span>Saving…');
    btn.disabled = true;
    try {
      const data = await SC.api('/api/auth/profile', { method: 'PUT', body: payload });
      SC.user = data.user;
      fillSummary(data.user);
      SC.renderAuthLinks();
      SC.toast('Profile updated successfully.');
      e.target.classList.remove('was-validated');
    } catch (err) {
      SC.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      setBtn(btn, '<i class="bi bi-check2-circle me-1"></i>Save changes');
    }
  });

  // ---- Change password ----
  const pwForm = document.getElementById('passwordForm');
  const pfConfirm = document.getElementById('pfConfirm');

  pfConfirm.addEventListener('input', () => {
    pfConfirm.setCustomValidity(
      pfConfirm.value && pfConfirm.value !== document.getElementById('pfNew').value
        ? 'mismatch' : ''
    );
  });

  pwForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.target.checkValidity()) { e.target.classList.add('was-validated'); return; }

    const btn = document.getElementById('savePwBtn');
    setBtn(btn, '<span class="spinner-border spinner-border-sm me-1"></span>Updating…');
    btn.disabled = true;
    try {
      await SC.api('/api/auth/profile', {
        method: 'PUT',
        body: {
          current_password: document.getElementById('pfCurrent').value,
          password: document.getElementById('pfNew').value
        }
      });
      SC.toast('Password changed. Use it next time you sign in.');
      pwForm.reset();
      pwForm.classList.remove('was-validated');
    } catch (err) {
      SC.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
      setBtn(btn, '<i class="bi bi-key me-1"></i>Update password');
    }
  });
});
