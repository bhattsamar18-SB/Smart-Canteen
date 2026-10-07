/* My Orders - list of the logged-in student's orders */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await SC.requireAuth();
  if (!user) return;

  const list = document.getElementById('ordersList');
  const empty = document.getElementById('emptyState');

  try {
    const data = await SC.api('/api/orders');
    const orders = data.orders;

    if (!orders.length) {
      empty.hidden = false;
      return;
    }

    list.innerHTML = orders.map((o) => {
      const itemsTxt = o.items.map((i) => `${i.food_name} ×${i.quantity}`).join(', ');
      return `
      <div class="panel p-0 overflow-hidden">
        <div class="p-3 p-md-4">
          <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
            <div>
              <div class="d-flex align-items-center gap-2 flex-wrap">
                <b class="fs-5">${SC.esc(o.token_number)}</b>
                ${SC.statusBadge(o.order_status)}
                <span class="text-secondary" style="font-size:.85rem">Order #${o.id}</span>
              </div>
              <div class="text-secondary" style="font-size:.88rem">
                ${SC.fmtDate(o.created_at)} · ${SC.fmtTime(o.created_at)} · Pickup ${SC.fmtTime(o.pickup_time)}
              </div>
            </div>
            <div class="text-end">
              <div class="fs-5 fw-bold text-primary">${SC.money(o.total_amount)}</div>
              <span class="badge bg-light text-dark border" style="font-size:.72rem">${SC.esc((o.payment_method || '').toUpperCase())}</span>
            </div>
          </div>
          <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div style="font-size:.9rem;color:var(--ink-soft);max-width:70%">
              <i class="bi bi-bag me-1"></i>${SC.esc(itemsTxt)}
            </div>
            <a href="/tracking?id=${o.id}" class="btn btn-sm ${o.order_status === 'completed' || o.order_status === 'cancelled' ? 'btn-outline-secondary' : 'btn-primary'}">
              <i class="bi bi-geo-alt me-1"></i>${o.order_status === 'completed' || o.order_status === 'cancelled' ? 'View' : 'Track'}
            </a>
          </div>
        </div>
      </div>`;
    }).join('');
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><div class="big">😕</div><h5>Could not load your orders</h5><p>${SC.esc(err.message)}</p></div>`;
  }
});
