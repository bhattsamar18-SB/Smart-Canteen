/* Order tracking - polls the API so admin status changes show up live */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await SC.requireAuth();
  if (!user) return;

  const id = new URLSearchParams(location.search).get('id');
  const view = document.getElementById('trackView');
  const notFound = document.getElementById('notFound');

  if (!id) { notFound.hidden = false; return; }

  const STEPS = [
    { title: 'Order Placed', sub: 'Your order has been received by the canteen', icon: '1' },
    { title: 'Payment Confirmed', sub: 'Payment verified successfully', icon: '2' },
    { title: 'Preparing', sub: 'The kitchen is working on your food', icon: '3' },
    { title: 'Ready for Pickup', sub: 'Show your token at the pickup counter', icon: '4' },
    { title: 'Completed', sub: 'Enjoy your meal!', icon: '5' }
  ];
  const CURRENT = { pending: 1, confirmed: 2, preparing: 2, ready: 3, completed: 4 };

  let timer = null;

  async function refresh(silent = false) {
    try {
      const data = await SC.api('/api/orders/' + id, { silent });
      render(data.order);
    } catch (err) {
      clearInterval(timer);
      view.hidden = true;
      notFound.hidden = false;
      if (!silent) SC.toast(err.message, 'error');
    }
  }

  function render(order) {
    view.hidden = false;
    notFound.hidden = true;

    document.getElementById('tkToken').textContent = '#' + order.token_number;
    document.getElementById('tkStatus').innerHTML = SC.statusBadge(order.order_status);

    const cancelled = order.order_status === 'cancelled';
    document.getElementById('cancelAlert').classList.toggle('d-none', !cancelled);

    let cur = CURRENT[order.order_status];
    if (cur === undefined) cur = 0;
    if (order.order_status === 'completed') cur = STEPS.length; // all done

    document.getElementById('timeline').innerHTML = STEPS.map((s, i) => {
      let cls = 'pending';
      if (!cancelled) {
        if (i < cur) cls = 'done';
        else if (i === cur) cls = 'current';
      }
      const dot = cls === 'done' ? '<i class="bi bi-check-lg"></i>' : (cancelled ? '—' : s.icon);
      return `
        <li class="tl-item ${cls}">
          <span class="tl-dot">${dot}</span>
          <div class="tl-title">${s.title}</div>
          <div class="tl-sub">${s.sub}</div>
        </li>`;
    }).join('');

    document.getElementById('dkId').textContent = '#' + order.id;
    document.getElementById('dkTime').textContent = SC.fmtDate(order.created_at) + ', ' + SC.fmtTime(order.created_at);
    document.getElementById('dkPickup').textContent = SC.fmtTime(order.pickup_time);
    document.getElementById('dkPayment').textContent = String(order.payment_method || '').toUpperCase();
    document.getElementById('dkPayStatus').innerHTML = order.payment_status === 'paid'
      ? '<span class="badge-status st-ready">Paid</span>'
      : `<span class="badge-status st-pending">${SC.esc(order.payment_status)}</span>`;

    document.getElementById('dkItems').innerHTML = order.items.map((i) => `
      <div class="summary-line">
        <span>${SC.esc(i.food_name)} <span class="text-secondary">× ${i.quantity}</span></span>
        <b>${SC.money(i.price * i.quantity)}</b>
      </div>`).join('');
    document.getElementById('dkTotal').textContent = SC.money(order.total_amount);
  }

  document.getElementById('refreshBtn').addEventListener('click', () => refresh());
  await refresh();
  timer = setInterval(() => refresh(true), 4000);
});
