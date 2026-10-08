/* E2E smoke test for Smart Canteen (run: node e2e.test.js) */
const BASE = 'http://localhost:1311';
let pass = 0, fail = 0;
function ok(cond, label) {
  if (cond) { pass++; console.log('  PASS  ' + label); }
  else { fail++; console.log('  FAIL  ' + label); }
}

function client() {
  let cookie = '';
  async function call(path, { method = 'GET', body } = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json', ...(cookie ? { cookie } : {}) },
      body: body ? JSON.stringify(body) : undefined
    });
    const sc = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
    sc.forEach((c) => { cookie = c.split(';')[0]; });
    const setc = res.headers.get('set-cookie');
    if (setc) cookie = setc.split(';')[0];
    let data = null;
    try { data = await res.json(); } catch (e) {}
    return { status: res.status, data };
  }
  return call;
}

const stamp = Date.now();

(async () => {
  // ---------- 1. Health + pages ----------
  console.log('\n-- Pages --');
  for (const p of ['/', '/menu', '/login', '/profile', '/admin', '/admin/sales',
                   '/admin/orders', '/admin/analytics', '/admin/users']) {
    const r = await fetch(BASE + p);
    ok(r.status === 200, `GET ${p} -> 200`);
  }

  // ---------- 2. Admin login + seed data ----------
  console.log('\n-- Admin --');
  const admin = client();
  let r = await admin('/api/auth/login', { method: 'POST', body: { email: 'admin@smartcanteen.com', password: 'admin123' } });
  ok(r.status === 200 && r.data.user.role === 'admin', 'admin login');
  ok(r.data.user.status === 'active', 'admin session carries status');

  r = await admin('/api/food');
  ok(r.status === 200 && r.data.items.length >= 19, `admin sees all food items (${r.data.items.length})`);
  ok(r.data.items.every((i) => i.vendor_id === null), 'seed menu is house-owned (no demo vendors)');

  // ---------- 3. Vendor signup (multi-vendor) + scoping ----------
  console.log('\n-- Vendor signup & scoping --');
  const vendor = client(); // vendor A
  const vendorAEmail = `test.vendor.a.${stamp}@example.com`;
  r = await vendor('/api/auth/register', {
    method: 'POST',
    body: { name: 'Test Vendor A', email: vendorAEmail, password: 'test1234', shop_name: 'Test Grill', role: 'vendor' }
  });
  ok(r.status === 201 && r.data.user.role === 'vendor', 'vendor A registers');
  ok(!!r.data.user.shop_name, 'vendor session carries shop_name');

  r = await vendor('/api/food', { method: 'POST', body: { name: 'Test Roll', price: 45, category: 'Snacks', stock: 10, minimum_stock: 3, available: true, description: 'e2e item' } });
  ok(r.status === 201 && r.data.item.vendor_shop === 'Test Grill', 'vendor item owned by their shop');
  const rollId = r.data.item.id;
  r = await vendor('/api/food', { method: 'POST', body: { name: 'Grill Sandwich', price: 55, category: 'Snacks', stock: 8, minimum_stock: 3, available: true } });
  const grillId = r.data.item.id;

  r = await vendor('/api/food?mine=1');
  ok(r.status === 200 && r.data.items.length === 2, `mine=1 -> only own items (${r.data.items.length})`);
  ok(r.data.items.every((i) => i.vendor_shop === 'Test Grill'), 'mine=1 rows all belong to Test Grill');

  const vendorB = client(); // vendor B
  const vendorBEmail = `test.vendor.b.${stamp}@example.com`;
  r = await vendorB('/api/auth/register', {
    method: 'POST',
    body: { name: 'Test Vendor B', email: vendorBEmail, password: 'test1234', shop_name: 'Second Kitchen', role: 'vendor' }
  });
  ok(r.status === 201, 'vendor B registers');
  r = await vendorB('/api/food', { method: 'POST', body: { name: 'Second Special', price: 60, category: 'Meals', stock: 5, minimum_stock: 2, available: true } });
  ok(r.status === 201, 'vendor B creates own item');
  r = await vendorB('/api/food?mine=1');
  ok(r.data.items.length === 1 && r.data.items[0].vendor_shop === 'Second Kitchen', 'vendor B sees only their own item');

  // admin now sees vendor shop names on the menu
  r = await admin('/api/food');
  ok(r.data.items.some((i) => i.vendor_shop === 'Test Grill'), 'food rows include vendor shop name');

  // vendor cannot edit or restock house items (id 1 = Masala Dosa, vendor_id NULL)
  r = await vendor('/api/food/1', { method: 'PUT', body: { name: 'Masala Dosa', price: 55, category: 'Breakfast', stock: 25, minimum_stock: 5, available: true } });
  ok(r.status === 403, 'vendor cannot edit house item (403)');
  r = await vendor('/api/inventory/1', { method: 'PUT', body: { stock: 50, reason: 'test' } });
  ok(r.status === 403, 'vendor cannot update house item stock (403)');

  // vendor inventory scoped to own items
  r = await vendor('/api/inventory');
  const ownIds = (await vendor('/api/food?mine=1')).data.items.map((i) => i.id);
  ok(r.data.items.length === ownIds.length && r.data.items.every((i) => ownIds.includes(i.id)),
    `vendor inventory scoped to own items (${r.data.items.length})`);

  // vendor cannot touch vendor B's item
  r = await vendor('/api/food/' + grillId, { method: 'PUT', body: { name: 'Grill Sandwich', price: 70, category: 'Snacks', stock: 8, minimum_stock: 3, available: true } });
  ok(r.status === 200, 'vendor can edit own item');
  const secondItemId = (await vendorB('/api/food?mine=1')).data.items[0].id;
  r = await vendor('/api/food/' + secondItemId, { method: 'PUT', body: { name: 'Second Special', price: 99, category: 'Meals', stock: 5, minimum_stock: 2, available: true } });
  ok(r.status === 403, 'vendor cannot edit another vendor item (403)');

  // vendor analytics scoped
  r = await vendor('/api/analytics/sales');
  ok(r.status === 200 && r.data.scope === 'vendor', 'vendor sales report scope=vendor');
  r = await admin('/api/analytics/sales');
  ok(r.status === 200 && r.data.scope === 'canteen', 'admin sales report scope=canteen');

  // analytics series + breakdowns (regression: alias bug broke daily/weekly/monthly)
  for (const kind of ['daily', 'weekly', 'monthly']) {
    r = await admin('/api/analytics/' + kind);
    ok(r.status === 200 && Array.isArray(r.data.data), `admin analytics ${kind} -> 200`);
  }
  r = await admin('/api/analytics/summary');
  ok(r.status === 200 && typeof r.data.totalOrders === 'number', 'admin analytics summary -> 200');
  r = await admin('/api/analytics/popular');
  ok(r.status === 200 && Array.isArray(r.data.items), 'admin analytics popular -> 200');
  r = await admin('/api/analytics/category');
  ok(r.status === 200 && Array.isArray(r.data.categories), 'admin analytics category -> 200');
  for (const kind of ['daily', 'weekly', 'monthly']) {
    r = await vendor('/api/analytics/' + kind);
    ok(r.status === 200 && Array.isArray(r.data.data), `vendor analytics ${kind} -> 200`);
  }
  r = await vendor('/api/analytics/summary');
  ok(r.status === 200 && typeof r.data.totalOrders === 'number', 'vendor analytics summary -> 200');
  r = await vendor('/api/analytics/popular');
  ok(r.status === 200 && Array.isArray(r.data.items), 'vendor analytics popular -> 200');
  r = await vendor('/api/analytics/category');
  ok(r.status === 200 && Array.isArray(r.data.categories), 'vendor analytics category -> 200');

  // ---------- 4. Student signup + order flow (COD) ----------
  console.log('\n-- Student order (COD) --');
  const student = client();
  const studentEmail = `test.student.${stamp}@example.com`;
  r = await student('/api/auth/register', {
    method: 'POST',
    body: { name: 'Rahul Sharma', email: studentEmail, password: 'student123', student_id: 'STU-2024-001', role: 'student' }
  });
  ok(r.status === 201 && r.data.user.role === 'student', 'student registers');

  r = await student('/api/food?search=Idli&available=true');
  const idli = r.data.items.find((i) => i.name === 'Idli Sambar');
  const idliStockBefore = idli.stock;
  const rollStockBefore = (await student('/api/food?search=Test Roll')).data.items.find((i) => i.name === 'Test Roll').stock;

  r = await student('/api/orders', {
    method: 'POST',
    body: {
      items: [{ food_item_id: idli.id, quantity: 2 }, { food_item_id: rollId, quantity: 1 }],
      customer: { name: 'Rahul Sharma', mobile: '9876543210' },
      pickup_time: '12:30',
      payment_method: 'cod'
    }
  });
  ok(r.status === 201, 'COD order placed (201)');
  const order = r.data.order;
  const expectedTotal = Math.round((idli.price * 2 + 45) * 1.05 * 100) / 100;
  ok(Math.abs(order.total_amount - expectedTotal) < 0.01,
    `GST total correct (${order.total_amount} vs ${expectedTotal})`);
  ok(order.payment_status === 'pending', 'COD order starts payment_status=pending');
  ok(order.token_number.includes('-'), 'token generated: ' + order.token_number);

  r = await student('/api/food?search=Idli');
  ok(r.data.items.find((i) => i.name === 'Idli Sambar').stock === idliStockBefore - 2, 'stock deducted for house item');
  r = await student('/api/food?search=Test Roll');
  ok(r.data.items.find((i) => i.name === 'Test Roll').stock === rollStockBefore - 1, 'stock deducted for vendor item');

  // stock validation: order more than available
  r = await student('/api/orders', {
    method: 'POST',
    body: { items: [{ food_item_id: rollId, quantity: 999 }], customer: { name: 'X', mobile: '9876543210' }, payment_method: 'upi' }
  });
  ok(r.status >= 400, `oversell rejected (${r.status})`);

  // ---------- 5. Vendor sees the order + completes it ----------
  console.log('\n-- Vendor order handling --');
  r = await vendor('/api/orders?scope=all');
  ok(!!r.data.orders.find((o) => o.id === order.id), 'vendor A sees order containing their item');
  r = await vendorB('/api/orders?scope=all');
  ok(!r.data.orders.find((o) => o.id === order.id), 'vendor B does not see the order');

  r = await vendorB(`/api/orders/${order.id}/status`, { method: 'PUT', body: { status: 'preparing' } });
  ok(r.status === 403, 'unrelated vendor cannot update status (403)');

  for (const s of ['confirmed', 'preparing', 'ready', 'completed']) {
    r = await vendor(`/api/orders/${order.id}/status`, { method: 'PUT', body: { status: s } });
    if (r.status !== 200) ok(false, 'status -> ' + s);
  }
  ok(true, 'owning vendor moved order to completed');
  ok(r.data.order.payment_status === 'paid', 'COD order flipped to paid on completion');

  // cancel restocks inventory
  const rollNow = (await student('/api/food?search=Test Roll')).data.items.find((i) => i.name === 'Test Roll').stock;
  r = await student('/api/orders', {
    method: 'POST',
    body: { items: [{ food_item_id: rollId, quantity: 2 }], customer: { name: 'X', mobile: '9876543210' }, payment_method: 'upi' }
  });
  const o2 = r.data.order;
  r = await vendor(`/api/orders/${o2.id}/status`, { method: 'PUT', body: { status: 'cancelled' } });
  ok(r.status === 200, 'vendor cancels order');
  const rollAfterCancel = (await student('/api/food?search=Test Roll')).data.items.find((i) => i.name === 'Test Roll').stock;
  ok(rollAfterCancel === rollNow, 'cancel restocked inventory');

  // ---------- 6. Sales endpoint numbers ----------
  console.log('\n-- Sales --');
  r = await admin('/api/analytics/sales');
  ok(r.status === 200 && typeof r.data.summary.gross === 'number' && r.data.transactions.length > 0,
    `admin sales: gross=${r.data.summary.gross}, tx=${r.data.transactions.length}`);
  ok(r.data.byPayment.length > 0, 'payment breakdown present: ' + r.data.byPayment.map((p) => p.method).join(','));
  ok(r.data.byVendor.length > 0, `per-vendor breakdown present (${r.data.byVendor.length} vendors)`);
  const codPaid = r.data.transactions.find((t) => t.id === order.id);
  ok(codPaid && codPaid.payment_status === 'paid', 'completed COD tx shows paid in sales');
  r = await admin('/api/analytics/sales?from=2000-01-01&to=2000-01-02');
  ok(r.status === 200 && r.data.transactions.length === 0, 'empty range returns 0 transactions');
  r = await vendor('/api/analytics/sales');
  ok(r.data.transactions.every((t) => t.vendor_amount !== undefined), 'vendor tx include vendor_amount');

  // ---------- 7. Profile ----------
  console.log('\n-- Profile --');
  r = await student('/api/auth/profile', { method: 'PUT', body: { name: 'Rahul S.', email: studentEmail, student_id: 'STU-2021-001' } });
  ok(r.status === 200 && r.data.user.name === 'Rahul S.', 'student updates name');
  r = await student('/api/auth/profile', { method: 'PUT', body: { current_password: 'wrongpass', password: 'newpass1' } });
  ok(r.status === 400, 'wrong current password rejected (400)');
  r = await student('/api/auth/profile', { method: 'PUT', body: { current_password: 'student123', password: 'student123' } });
  ok(r.status === 200, 'password change with correct current password');
  r = await student('/api/auth/profile', { method: 'PUT', body: { email: 'not-an-email' } });
  ok(r.status === 400, 'invalid email rejected (400)');
  r = await student('/api/auth/profile', { method: 'PUT', body: { shop_name: 'Hack Shop' } });
  ok(r.status === 200 && !r.data.user.shop_name, 'students cannot set shop_name');
  r = await vendor('/api/auth/profile', { method: 'PUT', body: { shop_name: 'Test Grill & Co' } });
  ok(r.status === 200 && r.data.user.shop_name === 'Test Grill & Co', 'vendor updates shop name');
  await vendor('/api/auth/profile', { method: 'PUT', body: { shop_name: 'Test Grill' } }); // restore

  // ---------- 8. Auth guards ----------
  console.log('\n-- Guards --');
  const anon = client();
  r = await anon('/api/analytics/summary');
  ok(r.status === 401, 'anon blocked from analytics (401)');
  r = await anon('/api/orders?scope=all');
  ok(r.status === 401, 'anon blocked from orders (401)');
  r = await student('/api/analytics/summary');
  ok(r.status === 403, 'student blocked from analytics (403)');
  r = await student('/api/food', { method: 'POST', body: { name: 'Hack', price: 1, category: 'Snacks' } });
  ok(r.status === 403, 'student blocked from creating food (403)');
  r = await anon('/api/users');
  ok(r.status === 401, 'anon blocked from user management (401)');
  r = await vendor('/api/users');
  ok(r.status === 403, 'vendor blocked from user management (403)');
  r = await student('/api/users');
  ok(r.status === 403, 'student blocked from user management (403)');

  // ---------- 9. User management (administrator) ----------
  console.log('\n-- User management --');
  r = await admin('/api/users');
  ok(r.status === 200 && r.data.users.length >= 4, `admin lists all accounts (${r.data.users.length})`);
  ok(r.data.stats.total >= 4 && r.data.stats.admins >= 1, `stats computed (total=${r.data.stats.total}, admins=${r.data.stats.admins})`);
  ok(!JSON.stringify(r.data.users).includes('$2a$'), 'password hashes never returned');

  r = await admin('/api/users?role=vendor');
  ok(r.status === 200 && r.data.users.every((u) => u.role === 'vendor'), 'role filter works');
  r = await admin(`/api/users?search=${vendorAEmail}`);
  ok(r.status === 200 && r.data.users.length === 1, 'search filter works');

  // create a user
  const gateEmail = `gate.user.${stamp}@example.com`;
  r = await admin('/api/users', { method: 'POST', body: { name: 'Gate User', email: gateEmail, password: 'test1234', role: 'student', student_id: 'STU-999' } });
  ok(r.status === 201 && r.data.user.role === 'student', 'admin creates student account');
  const gateId = r.data.user.id;
  r = await admin('/api/users', { method: 'POST', body: { name: 'Dup', email: gateEmail, password: 'test1234' } });
  ok(r.status === 409, 'duplicate email rejected (409)');
  r = await admin('/api/users', { method: 'POST', body: { name: 'No Shop', email: `noshop.${stamp}@x.com`, password: 'test1234', role: 'vendor' } });
  ok(r.status === 400, 'vendor without shop_name rejected (400)');
  r = await admin('/api/users', { method: 'POST', body: { name: 'Weak', email: `weak.${stamp}@x.com`, password: 'abc' } });
  ok(r.status === 400, 'weak password rejected (400)');

  // the created account can sign in
  const gate = client();
  r = await gate('/api/auth/login', { method: 'POST', body: { email: gateEmail, password: 'test1234' } });
  ok(r.status === 200 && r.data.user.id === gateId, 'created account signs in');

  // restrict -> login blocked, live session blocked, /me returns null
  r = await admin(`/api/users/${gateId}`, { method: 'PUT', body: { status: 'restricted' } });
  ok(r.status === 200 && r.data.user.status === 'restricted', 'admin restricts account');
  r = await gate('/api/auth/login', { method: 'POST', body: { email: gateEmail, password: 'test1234' } });
  ok(r.status === 403 && /restricted/i.test(r.data.message), 'restricted account cannot sign in (403)');
  r = await gate('/api/auth/profile', { method: 'PUT', body: { name: 'Nope' } });
  ok(r.status === 403, 'existing session of restricted account blocked (403)');
  r = await gate('/api/auth/me');
  ok(r.status === 200 && r.data.user === null, 'restricted session is signed out (/me -> null)');

  // restore -> can sign in again
  r = await admin(`/api/users/${gateId}`, { method: 'PUT', body: { status: 'active' } });
  ok(r.status === 200 && r.data.user.status === 'active', 'admin restores account');
  r = await gate('/api/auth/login', { method: 'POST', body: { email: gateEmail, password: 'test1234' } });
  ok(r.status === 200, 'restored account signs in again');

  // role changes
  r = await admin(`/api/users/${gateId}`, { method: 'PUT', body: { role: 'vendor', shop_name: 'Gate Kitchen' } });
  ok(r.status === 200 && r.data.user.role === 'vendor', 'admin changes role to vendor');
  r = await gate('/api/auth/login', { method: 'POST', body: { email: gateEmail, password: 'test1234' } });
  ok(r.data.user.role === 'vendor' && r.data.user.shop_name === 'Gate Kitchen', 'role change visible after login');
  r = await admin(`/api/users/${gateId}`, { method: 'PUT', body: { role: 'student' } });
  ok(r.status === 200 && r.data.user.role === 'student', 'admin changes role back to student');

  // validation + safety rules
  r = await admin(`/api/users/${gateId}`, { method: 'PUT', body: { role: 'superuser' } });
  ok(r.status === 400, 'invalid role rejected (400)');
  r = await admin(`/api/users/${gateId}`, { method: 'PUT', body: { status: 'banned' } });
  ok(r.status === 400, 'invalid status rejected (400)');
  r = await admin(`/api/users/${999999}`, { method: 'PUT', body: { name: 'Ghost' } });
  ok(r.status === 404, 'unknown user update -> 404');
  r = await admin('/api/users', { method: 'PUT', body: { status: 'restricted' } }); // no :id -> 404 route
  ok(r.status === 404, 'missing id -> 404');
  const adminId = r.data && r.data.user ? r.data.user.id : null;
  r = await admin('/api/auth/me');
  const selfId = r.data.user.id;
  r = await admin(`/api/users/${selfId}`, { method: 'PUT', body: { role: 'vendor' } });
  ok(r.status === 400, 'admin cannot change own role (400)');
  r = await admin(`/api/users/${selfId}`, { method: 'PUT', body: { status: 'restricted' } });
  ok(r.status === 400, 'admin cannot restrict self (400)');
  r = await admin(`/api/users/${selfId}`, { method: 'DELETE' });
  ok(r.status === 400, 'admin cannot delete self (400)');

  // delete
  r = await admin(`/api/users/${999999}`, { method: 'DELETE' });
  ok(r.status === 404, 'unknown user delete -> 404');
  r = await admin(`/api/users/${gateId}`, { method: 'DELETE' });
  ok(r.status === 200, 'admin deletes account');
  r = await gate('/api/auth/login', { method: 'POST', body: { email: gateEmail, password: 'test1234' } });
  ok(r.status === 401, 'deleted account cannot sign in (401)');
  r = await gate('/api/auth/me');
  ok(r.data.user === null, 'deleted account session signed out (/me -> null)');

  console.log(`\n===== ${pass} passed, ${fail} failed =====`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('FATAL', e); process.exit(2); });
