/* ============================================================
   Smart Canteen - shopping cart (localStorage) + offcanvas UI
   ============================================================ */
const Cart = {
  KEY: 'sc_cart',

  get() {
    try {
      const list = JSON.parse(localStorage.getItem(Cart.KEY)) || [];
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  },

  save(list) {
    localStorage.setItem(Cart.KEY, JSON.stringify(list));
    Cart.render();
    document.dispatchEvent(new CustomEvent('sc:cart-changed'));
  },

  count() {
    return Cart.get().reduce((sum, i) => sum + i.qty, 0);
  },

  subtotal() {
    return Cart.get().reduce((sum, i) => sum + i.price * i.qty, 0);
  },

  tax() {
    return Math.round(Cart.subtotal() * 0.05); // 5% GST
  },

  total() {
    return Cart.subtotal() + Cart.tax();
  },

  add(item, qty = 1) {
    const list = Cart.get();
    const found = list.find((i) => i.id === item.id);
    if (found) found.qty = Math.min(99, found.qty + qty);
    else list.push({ id: item.id, name: item.name, price: Number(item.price), image: item.image, qty });
    Cart.save(list);
    SC.toast(`${item.name} added to cart`);
  },

  setQty(id, qty) {
    let list = Cart.get();
    const found = list.find((i) => i.id === id);
    if (!found) return;
    found.qty = Math.max(1, Math.min(99, qty));
    Cart.save(list);
  },

  remove(id) {
    const list = Cart.get();
    const item = list.find((i) => i.id === id);
    Cart.save(list.filter((i) => i.id !== id));
    if (item) SC.toast(`${item.name} removed`, 'info');
  },

  clear() {
    Cart.save([]);
  },

  // ---- Offcanvas markup ----
  ensureOffcanvas() {
    if (document.getElementById('cartOffcanvas')) return;
    document.body.insertAdjacentHTML('beforeend', `
      <div class="offcanvas offcanvas-end" tabindex="-1" id="cartOffcanvas">
        <div class="offcanvas-header">
          <h5 class="offcanvas-title"><i class="bi bi-bag-fill text-primary me-2"></i>Your Cart
            <span class="badge bg-primary rounded-pill ms-1" id="cartHeadCount">0</span></h5>
          <button type="button" class="btn-close" data-bs-dismiss="offcanvas"></button>
        </div>
        <div class="offcanvas-body d-flex flex-column">
          <div id="cartItems" class="flex-grow-1" style="overflow-y:auto"></div>
          <div id="cartFooter"></div>
        </div>
      </div>`);
    Cart.render();
  },

  render() {
    Cart.ensureOffcanvas();
    const itemsEl = document.getElementById('cartItems');
    const footerEl = document.getElementById('cartFooter');
    const list = Cart.get();

    // badges
    const count = Cart.count();
    document.querySelectorAll('.cart-count').forEach((b) => {
      b.textContent = count;
      b.hidden = count === 0;
    });
    const head = document.getElementById('cartHeadCount');
    if (head) head.textContent = count;

    if (!list.length) {
      itemsEl.innerHTML = `
        <div class="empty-state">
          <div class="big">🛒</div>
          <h5>Your cart is empty</h5>
          <p>Browse the menu and add something delicious.</p>
          <a href="/menu" class="btn btn-primary">Browse Menu</a>
        </div>`;
      footerEl.innerHTML = '';
      return;
    }

    itemsEl.innerHTML = list.map((i) => `
      <div class="cart-line">
        <img src="${SC.esc(i.image)}" alt="${SC.esc(i.name)}" onerror="this.src='/assets/food/burger.svg'">
        <div class="meta">
          <div class="name">${SC.esc(i.name)}</div>
          <div class="unit">${SC.money(i.price)} each</div>
          <div class="qty mt-2">
            <button type="button" data-step="-1" aria-label="decrease">−</button>
            <input type="text" inputmode="numeric" value="${i.qty}" data-cart-qty="${i.id}">
            <button type="button" data-step="1" aria-label="increase">+</button>
          </div>
        </div>
        <div class="text-end">
          <div class="fw-bold">${SC.money(i.price * i.qty)}</div>
          <button class="remove mt-2" data-cart-remove="${i.id}" title="Remove"><i class="bi bi-trash3"></i></button>
        </div>
      </div>`).join('');

    footerEl.innerHTML = `
      <div class="bill-row"><span>Subtotal</span><span>${SC.money(Cart.subtotal())}</span></div>
      <div class="bill-row"><span>GST (5%)</span><span>${SC.money(Cart.tax())}</span></div>
      <div class="bill-row total"><span>Total</span><span>${SC.money(Cart.total())}</span></div>
      <a href="/checkout" class="btn btn-primary w-100 mt-3 btn-lg">Proceed to Checkout</a>
      <button class="btn btn-link text-secondary w-100 mt-1" data-cart-clear>Clear cart</button>`;
  }
};

// ---- Cart UI events ----
document.addEventListener('click', (e) => {
  const remove = e.target.closest('[data-cart-remove]');
  if (remove) { Cart.remove(Number(remove.dataset.cartRemove)); return; }
  if (e.target.closest('[data-cart-clear]')) {
    SC.confirm('Remove all items from your cart?').then((ok) => { if (ok) { Cart.clear(); SC.toast('Cart cleared', 'info'); } });
    return;
  }
});

document.addEventListener('change', (e) => {
  const input = e.target.closest('[data-cart-qty]');
  if (input) {
    const qty = parseInt(input.value, 10);
    Cart.setQty(Number(input.dataset.cartQty), Number.isFinite(qty) ? qty : 1);
  }
});

// Generic "Add to cart" buttons: data-add-id, data-add-name, data-add-price, data-add-image
document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-add-id]');
  if (!btn) return;
  const qtyInput = document.querySelector(`[data-qty-for="${btn.dataset.addId}"]`);
  const qty = qtyInput ? Math.max(1, parseInt(qtyInput.value, 10) || 1) : 1;
  Cart.add(
    { id: Number(btn.dataset.addId), name: btn.dataset.addName, price: Number(btn.dataset.addPrice), image: btn.dataset.addImage },
    qty
  );
});

document.addEventListener('DOMContentLoaded', () => {
  Cart.ensureOffcanvas();
  Cart.render();
});
