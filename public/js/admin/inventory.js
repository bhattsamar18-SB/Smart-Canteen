/* Admin inventory - stock overview, manual updates, movement log */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await Admin.init();
  if (!user) return;

  const body = document.getElementById('invBody');
  const logList = document.getElementById('logList');
  const modal = bootstrap.Modal.getOrCreateInstance(document.getElementById('stockModal'));
  const form = document.getElementById('stockForm');

  async function load() {
    try {
      const data = await SC.api('/api/inventory');
      const items = data.items;

      document.getElementById('invTotal').textContent = items.length;
      document.getElementById('invLow').textContent = items.filter((i) => i.stock_status === 'low').length;
      document.getElementById('invOut').textContent = items.filter((i) => i.stock_status === 'out').length;

      if (!items.length) {
        body.innerHTML = '<tr><td colspan="6" class="empty-mini">No items in the menu yet.</td></tr>';
      } else {
        body.innerHTML = items.map((i) => {
          const badge = i.stock_status === 'out'
            ? '<span class="badge-status st-out">Out of Stock</span>'
            : i.stock_status === 'low'
              ? '<span class="badge-status st-low">Low Stock</span>'
              : '<span class="badge-status st-ok">In Stock</span>';
          const rowCls = i.stock_status === 'out' ? 'row-out' : i.stock_status === 'low' ? 'row-low' : '';
          return `
          <tr class="${rowCls}">
            <td>
              <div class="d-flex align-items-center gap-2">
                <img class="thumb-sm" src="${SC.esc(i.image || '/assets/food/burger.svg')}" alt="" onerror="this.style.display='none'">
                <div><div class="fw-semibold">${SC.esc(i.name)}</div><div class="text-secondary" style="font-size:.78rem">${SC.esc(i.category)}</div></div>
              </div>
            </td>
            <td><b class="${i.stock <= 0 ? 'text-danger' : ''}">${i.stock}</b></td>
            <td class="text-secondary">${i.minimum_stock}</td>
            <td>${badge}</td>
            <td class="text-secondary" style="white-space:nowrap">${SC.fmtDate(i.updated_at)}<br><span style="font-size:.78rem">${SC.fmtTime(i.updated_at)}</span></td>
            <td class="text-end">
              <button class="btn btn-sm btn-outline-primary" data-stock="${i.id}" data-name="${SC.esc(i.name)}" data-value="${i.stock}">
                <i class="bi bi-pencil-square me-1"></i>Update
              </button>
            </td>
          </tr>`;
        }).join('');
      }

      // movement log
      const logs = data.logs || [];
      logList.innerHTML = logs.length ? logs.map((l) => `
        <div class="d-flex justify-content-between align-items-start py-2 border-bottom" style="font-size:.86rem">
          <div>
            <b>${SC.esc(l.food_name || 'Deleted item')}</b>
            <div class="text-secondary" style="font-size:.78rem">${SC.esc(l.reason || '')}</div>
          </div>
          <div class="text-end">
            <b class="${l.quantity_change < 0 ? 'text-danger' : 'text-success'}">${l.quantity_change > 0 ? '+' : ''}${l.quantity_change}</b>
            <div class="text-secondary" style="font-size:.75rem">${SC.fmtDate(l.created_at)}</div>
          </div>
        </div>`).join('') : '<div class="empty-mini">No stock movements yet.</div>';
    } catch (err) {
      body.innerHTML = `<tr><td colspan="6" class="empty-mini">${SC.esc(err.message)}</td></tr>`;
    }
  }

  body.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-stock]');
    if (!btn) return;
    document.getElementById('stockId').value = btn.dataset.stock;
    document.getElementById('stockItemName').textContent = btn.dataset.name;
    document.getElementById('stockValue').value = btn.dataset.value;
    document.getElementById('stockReason').value = '';
    form.classList.remove('was-validated');
    modal.show();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const btn = document.getElementById('stockSave');
    btn.disabled = true;
    try {
      await SC.api('/api/inventory/' + document.getElementById('stockId').value, {
        method: 'PUT',
        body: {
          stock: Number(document.getElementById('stockValue').value),
          reason: document.getElementById('stockReason').value.trim() || 'Manual stock update'
        }
      });
      SC.toast('Stock updated');
      modal.hide();
      load();
    } catch (err) {
      SC.toast(err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  load();
});
