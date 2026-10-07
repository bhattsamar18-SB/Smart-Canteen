/* Checkout - order summary, customer form, slots, simulated payment */
document.addEventListener('DOMContentLoaded', async () => {
  const view = document.getElementById('checkoutView');
  const loginPrompt = document.getElementById('loginPrompt');
  const emptyCart = document.getElementById('emptyCart');

  const user = await SC.requireAuth();
  if (!user) return; // redirect handled by requireAuth

  // Prefill customer info
  document.getElementById('custName').value = user.name || '';
  document.getElementById('custSid').value = user.student_id || '';

  function render() {
    const items = Cart.get();
    const empty = items.length === 0;
    emptyCart.hidden = !empty;
    view.hidden = empty;
    if (empty) return;

    document.getElementById('summaryLines').innerHTML = items.map((i) => `
      <div class="summary-line">
        <span>${SC.esc(i.name)} <span class="text-secondary">× ${i.qty}</span></span>
        <b>${SC.money(i.price * i.qty)}</b>
      </div>`).join('');
    document.getElementById('sumSub').textContent = SC.money(Cart.subtotal());
    document.getElementById('sumTax').textContent = SC.money(Cart.tax());
    document.getElementById('sumTotal').textContent = SC.money(Cart.total());
    updatePayBtn();
  }

  // Button text follows the chosen payment method (COD pays at the counter).
  function selectedMethod() {
    const el = document.querySelector('input[name="payment"]:checked');
    return el ? el.value : 'upi';
  }
  function updatePayBtn() {
    const total = SC.money(Cart.total());
    const cod = selectedMethod() === 'cod';
    document.getElementById('payBtnText').textContent = cod
      ? `Place Order · Pay ${total} at Counter`
      : `Pay ${total} & Place Order`;
  }
  document.getElementById('checkoutForm').addEventListener('change', (e) => {
    if (e.target.name === 'payment') updatePayBtn();
  });

  // ---- Pickup slots ----
  const slotWrap = document.getElementById('slotWrap');
  function buildSlots() {
    const slots = [];
    const now = new Date();
    const asap = new Date(now.getTime() + 15 * 60000);
    slots.push({ v: fmt24(asap), label: `As soon as possible (≈ ${fmt12(asap)})` });
    // next few rounded slots
    const next = new Date(now);
    next.setMinutes(Math.ceil((now.getMinutes() + 20) / 15) * 15, 0, 0);
    for (let i = 0; i < 3; i++) {
      const t = new Date(next.getTime() + i * 15 * 60000);
      slots.push({ v: fmt24(t), label: fmt12(t) });
    }
    slotWrap.innerHTML = slots.map((s, i) => `
      <label class="slot-pill">
        <input type="radio" name="slot" value="${s.v}" ${i === 0 ? 'checked' : ''}>
        <span>${SC.esc(s.label)}</span>
      </label>`).join('');
  }
  function fmt24(d) { return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function fmt12(d) {
    const h = d.getHours() % 12 || 12;
    return `${h}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`;
  }
  buildSlots();

  render();
  document.addEventListener('sc:cart-changed', render);

  // ---- Submit ----
  const form = document.getElementById('checkoutForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (!form.checkValidity()) {
      form.classList.add('was-validated');
      SC.toast('Please fix the highlighted fields.', 'error');
      return;
    }

    const items = Cart.get();
    if (!items.length) { render(); return; }

    const payload = {
      items: items.map((i) => ({ food_item_id: i.id, quantity: i.qty })),
      customer: {
        name: document.getElementById('custName').value.trim(),
        student_id: document.getElementById('custSid').value.trim(),
        mobile: document.getElementById('custMobile').value.trim()
      },
      pickup_time: document.querySelector('input[name="slot"]:checked').value,
      payment_method: document.querySelector('input[name="payment"]:checked').value
    };

    const btn = document.getElementById('payBtn');
    btn.disabled = true;
    try {
      const data = await SC.api('/api/orders', { method: 'POST', body: payload });
      const order = data.order;
      Cart.clear();
      SC.toast('Order placed successfully!');

      // Fill confirmation
      document.getElementById('confToken').textContent = order.token_number;
      document.getElementById('confPickup').textContent = SC.fmtTime(order.pickup_time);
      document.getElementById('confTotal').textContent = SC.money(order.total_amount);
      document.getElementById('confStatus').textContent = 'Order Received';
      document.getElementById('trackBtn').href = '/tracking?id=' + order.id;

      view.hidden = true;
      loginPrompt.hidden = true;
      emptyCart.hidden = true;
      document.getElementById('confirmView').hidden = false;
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      SC.toast(err.message, 'error');
      if (/log in/i.test(err.message)) SC.requireAuth();
      else render(); // stock may have changed - refresh summary
    } finally {
      btn.disabled = false;
    }
  });
});
