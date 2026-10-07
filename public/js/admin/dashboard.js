/* Admin dashboard - stats, recent orders, low stock */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await Admin.init();
  if (!user) return;

  // Stat cards
  try {
    const s = await SC.api('/api/analytics/summary');
    document.getElementById('statOrders').textContent = s.todayOrders;
    document.getElementById('statRevenue').textContent = SC.money(s.todayRevenue);
    document.getElementById('statPending').textContent = s.pendingOrders;
    document.getElementById('statLow').textContent = s.lowStockItems;
  } catch (err) {
    SC.toast(err.message, 'error');
  }

  // Recent orders
  try {
    const data = await SC.api('/api/orders?scope=all');
    const rows = data.orders.slice(0, 7);
    document.getElementById('recentOrders').innerHTML = rows.length ? rows.map((o) => `
      <tr>
        <td><b>${SC.esc(o.token_number)}</b></td>
        <td>${SC.esc(o.customer_name)}</td>
        <td class="text-secondary" style="max-width:220px">${SC.esc(o.items.map((i) => `${i.food_name} ×${i.quantity}`).join(', '))}</td>
        <td class="fw-semibold">${SC.money(o.total_amount)}</td>
        <td class="text-secondary">${SC.fmtTime(o.created_at)}</td>
        <td>${SC.statusBadge(o.order_status)}</td>
      </tr>`).join('') : '<tr><td colspan="6" class="empty-mini">No orders yet 🍽️</td></tr>';
  } catch (err) {
    document.getElementById('recentOrders').innerHTML = `<tr><td colspan="6" class="empty-mini">${SC.esc(err.message)}</td></tr>`;
  }

  // Low stock list
  try {
    const inv = await SC.api('/api/inventory');
    const low = inv.items.filter((i) => i.stock_status !== 'ok');
    document.getElementById('lowStockList').innerHTML = low.length ? low.map((i) => `
      <div class="d-flex justify-content-between align-items-center py-2 border-bottom">
        <div>
          <b style="font-size:.92rem">${SC.esc(i.name)}</b>
          <div class="text-secondary" style="font-size:.78rem">Min ${i.minimum_stock}</div>
        </div>
        <span class="badge-status ${i.stock_status === 'out' ? 'st-out' : 'st-low'}">
          ${i.stock_status === 'out' ? 'Out of stock' : `Low · ${i.stock}`}
        </span>
      </div>`).join('') : '<div class="empty-mini">All items are sufficiently stocked ✅</div>';
  } catch (err) {
    document.getElementById('lowStockList').innerHTML = `<div class="empty-mini">${SC.esc(err.message)}</div>`;
  }
});
