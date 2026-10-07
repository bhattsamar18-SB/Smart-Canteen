/* Admin orders - filter table + live status changes via fetch */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await Admin.init();
  if (!user) return;

  const body = document.getElementById('ordersBody');
  const meta = document.getElementById('ordersMeta');

  const filters = { status: '', date: '', search: '' };

  function buildQuery() {
    const p = new URLSearchParams({ scope: 'all' });
    if (filters.status) p.set('status', filters.status);
    if (filters.date) p.set('date', filters.date);
    if (filters.search) p.set('search', filters.search);
    return p.toString();
  }

  async function load() {
    try {
      const data = await SC.api('/api/orders?' + buildQuery());
      meta.textContent = `${data.orders.length} order${data.orders.length === 1 ? '' : 's'} shown`;

      if (!data.orders.length) {
        body.innerHTML = `<tr><td colspan="9" class="empty-mini">No orders match these filters 🔍</td></tr>`;
        return;
      }

      body.innerHTML = data.orders.map((o) => {
        const items = o.items.map((i) => `${i.food_name} ×${i.quantity}`);
        const itemsTxt = items.slice(0, 2).join(', ') + (items.length > 2 ? ` +${items.length - 2} more` : '');
        return `
        <tr data-order-row="${o.id}">
          <td class="text-secondary">#${o.id}</td>
          <td><b>${SC.esc(o.token_number)}</b></td>
          <td>
            <div class="fw-semibold">${SC.esc(o.customer_name)}</div>
            <div class="text-secondary" style="font-size:.78rem">${SC.esc(o.customer_mobile || '')}</div>
          </td>
          <td class="text-secondary" style="max-width:230px" title="${SC.esc(items.join(', '))}">${SC.esc(itemsTxt)}</td>
          <td class="fw-semibold">${SC.money(o.total_amount)}</td>
          <td>
            <span class="badge bg-light text-dark border" style="font-size:.7rem">${SC.esc((o.payment_method || '').toUpperCase())}</span>
            ${o.payment_status === 'paid' ? '<i class="bi bi-check-circle-fill text-success ms-1" title="Paid"></i>' : ''}
          </td>
          <td class="text-secondary" style="white-space:nowrap">${SC.fmtDate(o.created_at)}<br><span style="font-size:.8rem">${SC.fmtTime(o.created_at)}</span></td>
          <td class="status-cell">${Admin.statusSelect(o)}</td>
          <td>
            <a class="btn btn-sm btn-outline-primary" href="/tracking?id=${o.id}" title="Track / view order">
              <i class="bi bi-eye"></i>
            </a>
          </td>
        </tr>`;
      }).join('');
    } catch (err) {
      body.innerHTML = `<tr><td colspan="9" class="empty-mini">${SC.esc(err.message)}</td></tr>`;
    }
  }

  // Status dropdown -> PUT (no page refresh)
  body.addEventListener('change', async (e) => {
    const sel = e.target.closest('[data-status-for]');
    if (!sel) return;
    const id = sel.dataset.statusFor;
    const status = sel.value;
    const previous = sel.dataset.prev || sel.defaultValue;
    sel.disabled = true;
    try {
      await Admin.changeStatus(id, status);
      sel.dataset.prev = status;
      const row = sel.closest('tr');
      if (row) row.style.opacity = '0.65';
      setTimeout(() => { if (row) row.style.opacity = ''; }, 400);
    } catch (err) {
      sel.value = previous;
      SC.toast(err.message, 'error');
    } finally {
      sel.disabled = false;
    }
  });

  // Filter events
  document.getElementById('applyFilters').addEventListener('click', () => {
    filters.status = document.getElementById('filterStatus').value;
    filters.date = document.getElementById('filterDate').value;
    filters.search = document.getElementById('filterSearch').value.trim();
    load();
  });
  document.getElementById('clearFilters').addEventListener('click', () => {
    document.getElementById('filterStatus').value = '';
    document.getElementById('filterDate').value = '';
    document.getElementById('filterSearch').value = '';
    filters.status = filters.date = filters.search = '';
    load();
  });
  document.getElementById('filterSearch').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('applyFilters').click();
  });

  load();
});
