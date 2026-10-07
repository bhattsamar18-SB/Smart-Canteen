/* Admin menu management - add / edit / delete food items */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await Admin.init();
  if (!user) return;

  const body = document.getElementById('menuBody');
  const form = document.getElementById('itemForm');
  const modalEl = document.getElementById('itemModal');
  const modal = bootstrap.Modal.getOrCreateInstance(modalEl);
  let editId = null;

  // Vendors only manage their own items; admins see the whole menu.
  const mine = user.role === 'vendor' ? '?mine=1' : '';

  async function load() {
    try {
      const data = await SC.api('/api/food' + mine);
      document.getElementById('itemMeta').textContent = `${data.items.length} item${data.items.length === 1 ? '' : 's'} on the menu`;

      if (!data.items.length) {
        body.innerHTML = '<tr><td colspan="7" class="empty-mini">No items yet — add your first one.</td></tr>';
        return;
      }

      body.innerHTML = data.items.map((i) => {
        const stockCls = i.stock <= 0 ? 'st-out' : i.stock <= i.minimum_stock ? 'st-low' : 'st-ok';
        const stockTxt = i.stock <= 0 ? 'Out of stock' : i.stock <= i.minimum_stock ? `Low · ${i.stock}` : i.stock;
        return `
        <tr>
          <td><img class="thumb-sm" src="${SC.esc(i.image || '/assets/food/burger.svg')}" alt="" onerror="this.src='/assets/food/burger.svg'"></td>
          <td>
            <div class="fw-semibold">${SC.esc(i.name)}</div>
            <div class="text-secondary" style="font-size:.78rem;max-width:300px">${SC.esc(i.description || '')}</div>
            ${i.vendor_shop ? `<div class="text-secondary" style="font-size:.72rem"><i class="bi bi-shop"></i> ${SC.esc(i.vendor_shop)}</div>` : ''}
          </td>
          <td><span class="badge bg-light text-dark border" style="font-size:.72rem">${SC.esc(i.category)}</span></td>
          <td class="fw-semibold">${SC.money(i.price)}</td>
          <td><span class="badge-status ${stockCls}">${stockTxt}</span></td>
          <td>
            <div class="form-check form-switch m-0">
              <input class="form-check-input" type="checkbox" data-available-for="${i.id}" ${i.available ? 'checked' : ''}>
            </div>
          </td>
          <td class="text-end text-nowrap">
            <button class="btn btn-sm btn-outline-primary me-1" data-edit="${i.id}" title="Edit"><i class="bi bi-pencil"></i></button>
            <button class="btn btn-sm btn-outline-danger" data-delete="${i.id}" data-name="${SC.esc(i.name)}" title="Delete"><i class="bi bi-trash3"></i></button>
          </td>
        </tr>`;
      }).join('');
    } catch (err) {
      body.innerHTML = `<tr><td colspan="7" class="empty-mini">${SC.esc(err.message)}</td></tr>`;
    }
  }

  // ---- Add / Edit modal ----
  document.getElementById('addBtn').addEventListener('click', () => {
    editId = null;
    document.getElementById('itemModalTitle').textContent = 'Add Food Item';
    form.reset();
    document.getElementById('itemAvailable').checked = true;
    document.getElementById('itemMin').value = 5;
    form.classList.remove('was-validated');
    updatePreview();
    modal.show();
  });

  body.addEventListener('click', async (e) => {
    const editBtn = e.target.closest('[data-edit]');
    if (editBtn) {
      const id = editBtn.dataset.edit;
      const data = await SC.api('/api/food/' + id);
      const i = data.item;
      editId = i.id;
      document.getElementById('itemModalTitle').textContent = 'Edit Food Item';
      document.getElementById('itemName').value = i.name;
      document.getElementById('itemDesc').value = i.description || '';
      document.getElementById('itemPrice').value = i.price;
      document.getElementById('itemCategory').value = i.category;
      document.getElementById('itemStock').value = i.stock;
      document.getElementById('itemMin').value = i.minimum_stock;
      document.getElementById('itemImage').value = i.image || '';
      document.getElementById('itemAvailable').checked = !!i.available;
      document.getElementById('itemFile').value = '';
      form.classList.remove('was-validated');
      updatePreview();
      modal.show();
      return;
    }

    const delBtn = e.target.closest('[data-delete]');
    if (delBtn) {
      const ok = await SC.confirm(`Delete "${delBtn.dataset.name}" from the menu? This cannot be undone.`);
      if (!ok) return;
      try {
        await SC.api('/api/food/' + delBtn.dataset.delete, { method: 'DELETE' });
        SC.toast('Item deleted');
        load();
      } catch (err) {
        SC.toast(err.message, 'error');
      }
    }
  });

  // availability toggle
  body.addEventListener('change', async (e) => {
    const toggle = e.target.closest('[data-available-for]');
    if (!toggle) return;
    const id = toggle.dataset.availableFor;
    toggle.disabled = true;
    try {
      const { item } = await SC.api('/api/food/' + id);
      await SC.api('/api/food/' + id, {
        method: 'PUT',
        body: {
          name: item.name, description: item.description, price: item.price,
          category: item.category, image: item.image, stock: item.stock,
          minimum_stock: item.minimum_stock, available: toggle.checked
        }
      });
      SC.toast(`Item marked ${toggle.checked ? 'available' : 'unavailable'}`);
    } catch (err) {
      toggle.checked = !toggle.checked;
      SC.toast(err.message, 'error');
    } finally {
      toggle.disabled = false;
    }
  });

  // image preview + file -> data URL
  function updatePreview() {
    const src = document.getElementById('itemImage').value.trim();
    const wrap = document.getElementById('itemPreviewWrap');
    wrap.hidden = !src;
    if (src) document.getElementById('itemPreview').src = src;
  }
  document.getElementById('itemImage').addEventListener('input', updatePreview);
  document.getElementById('itemFile').addEventListener('change', () => {
    const file = document.getElementById('itemFile').files[0];
    if (!file) return;
    if (file.size > 400 * 1024) {
      SC.toast('Please choose an image under 400 KB.', 'error');
      document.getElementById('itemFile').value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      document.getElementById('itemImage').value = reader.result;
      updatePreview();
    };
    reader.readAsDataURL(file);
  });

  // ---- Save ----
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const payload = {
      name: document.getElementById('itemName').value.trim(),
      description: document.getElementById('itemDesc').value.trim(),
      price: Number(document.getElementById('itemPrice').value),
      category: document.getElementById('itemCategory').value,
      stock: Number(document.getElementById('itemStock').value),
      minimum_stock: Number(document.getElementById('itemMin').value || 0),
      image: document.getElementById('itemImage').value.trim(),
      available: document.getElementById('itemAvailable').checked
    };

    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    try {
      if (editId) {
        await SC.api('/api/food/' + editId, { method: 'PUT', body: payload });
        SC.toast('Item updated');
      } else {
        await SC.api('/api/food', { method: 'POST', body: payload });
        SC.toast('Item added to the menu');
      }
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
