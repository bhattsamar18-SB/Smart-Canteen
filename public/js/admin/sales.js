/* Sales management - date range report, KPIs, payment/vendor breakdown, CSV export */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await Admin.init();
  if (!user) return;

  const TEAL = '#0f766e';
  const AMBER = '#f59e0b';
  const METHOD_LABELS = { upi: 'UPI', wallet: 'Wallet', card: 'Card', cod: 'Cash on Delivery' };
  const PALETTE = { upi: TEAL, wallet: AMBER, card: '#0ea5e9', cod: '#8b5cf6' };

  let report = null;      // last API response
  let txRows = [];        // filtered transactions for table/CSV
  let trendChart = null;

  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = '#64748b';

  const iso = (d) => d.toISOString().slice(0, 10);

  function rangeQuery() {
    const p = new URLSearchParams();
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p.toString();
  }

  // ---- KPI cards + breakdowns ----
  function renderSummary(r) {
    const s = r.summary;
    document.getElementById('kpiGross').textContent = SC.money(Math.round(s.gross));
    document.getElementById('kpiTax').textContent = SC.money(Math.round(s.taxCollected));
    document.getElementById('kpiOrders').textContent = s.orders;
    document.getElementById('kpiAvg').textContent = SC.money(Math.round(s.avgOrderValue));
    document.getElementById('kpiRefund').textContent = SC.money(Math.round(s.refundAmount));
    document.getElementById('kpiUnpaid').textContent = SC.money(Math.round(s.unpaidAmount));

    // Payment methods with share bars
    const payHost = document.getElementById('payBreakdown');
    const total = r.byPayment.reduce((a, p) => a + p.amount, 0);
    if (!r.byPayment.length) {
      payHost.innerHTML = '<div class="text-secondary small">No payments in this range.</div>';
    } else {
      payHost.innerHTML = r.byPayment.map((p) => {
        const pct = total ? Math.round((p.amount / total) * 100) : 0;
        const color = PALETTE[p.method] || '#64748b';
        return `
        <div>
          <div class="d-flex justify-content-between small mb-1">
            <span><span class="badge me-1" style="background:${color}">&nbsp;</span>${METHOD_LABELS[p.method] || SC.esc(p.method)} · ${p.orders} order${p.orders === 1 ? '' : 's'}</span>
            <b>${SC.money(Math.round(p.amount))}</b>
          </div>
          <div class="progress" style="height:7px">
            <div class="progress-bar" style="width:${pct}%;background:${color}"></div>
          </div>
        </div>`;
      }).join('');
    }

    // Collection status: paid vs pending (COD)
    const paid = total - s.unpaidAmount;
    const paidPct = total ? Math.round((paid / total) * 100) : 0;
    document.getElementById('statusBreakdown').innerHTML = `
      <div>
        <div class="d-flex justify-content-between small mb-1">
          <span><i class="bi bi-check-circle-fill text-success me-1"></i>Collected</span>
          <b>${SC.money(Math.round(paid))}</b>
        </div>
        <div class="progress" style="height:9px">
          <div class="progress-bar bg-success" style="width:${paidPct}%"></div>
        </div>
      </div>
      <div>
        <div class="d-flex justify-content-between small mb-1">
          <span><i class="bi bi-clock-history text-warning me-1"></i>Pending (${s.unpaidOrders} order${s.unpaidOrders === 1 ? '' : 's'})</span>
          <b>${SC.money(Math.round(s.unpaidAmount))}</b>
        </div>
        <div class="progress" style="height:9px">
          <div class="progress-bar bg-warning" style="width:${100 - paidPct}%"></div>
        </div>
      </div>
      <div class="small text-secondary pt-1">
        <i class="bi bi-x-circle text-danger me-1"></i>Cancelled: ${s.cancelledOrders} order${s.cancelledOrders === 1 ? '' : 's'} · ${SC.money(Math.round(s.refundAmount))} refunded
      </div>`;

    // Vendor table (admin scope only)
    const panel = document.getElementById('vendorPanel');
    if (r.scope === 'canteen' && r.byVendor.length) {
      panel.hidden = false;
      document.getElementById('vendorBody').innerHTML = r.byVendor.map((v) => `
        <tr>
          <td class="fw-semibold">${SC.esc(v.vendor)}</td>
          <td class="text-end">${v.orders}</td>
          <td class="text-end fw-semibold">${SC.money(Math.round(v.amount))}</td>
        </tr>`).join('');
    } else {
      panel.hidden = true;
    }
  }

  // ---- Trend chart (revenue per day) ----
  async function renderTrend() {
    const qs = rangeQuery();
    try {
      const daily = await SC.api('/api/analytics/daily' + (qs ? '?' + qs : ''), { silent: true });
      const labels = daily.data.map((d) => d.label.slice(5));
      if (trendChart) trendChart.destroy();
      trendChart = new Chart(document.getElementById('trendChart'), {
        type: 'line',
        data: {
          labels,
          datasets: [{
            data: daily.data.map((d) => d.revenue),
            borderColor: TEAL,
            backgroundColor: 'rgba(15,118,110,0.12)',
            fill: true,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: TEAL
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { callback: (v) => '₹' + v } },
            x: { grid: { display: false } }
          }
        }
      });
    } catch (err) {
      SC.toast(err.message, 'error');
    }
  }

  // ---- Transactions table ----
  function renderTransactions() {
    const term = document.getElementById('txSearch').value.trim().toLowerCase();
    txRows = (report.transactions || []).filter((t) => {
      if (!term) return true;
      return String(t.token_number || '').toLowerCase().includes(term)
        || String(t.customer_name || '').toLowerCase().includes(term)
        || String(t.id).includes(term);
    });

    const body = document.getElementById('txBody');
    if (!txRows.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty-mini">No transactions in this date range.</td></tr>';
      document.getElementById('txMeta').textContent = '';
      return;
    }

    const showVendorShare = report.scope === 'vendor';
    body.innerHTML = txRows.map((t) => {
      const amount = showVendorShare ? t.vendor_amount : t.total_amount;
      const payCls = t.payment_status === 'paid' ? 'st-completed' : 'st-pending';
      return `
      <tr>
        <td class="text-nowrap">${SC.fmtDate(t.created_at)}<div class="text-secondary" style="font-size:.75rem">${SC.fmtTime(t.created_at)}</div></td>
        <td class="fw-semibold">#${SC.esc(t.token_number)}</td>
        <td>${SC.esc(t.customer_name)}</td>
        <td>${Number(t.item_count) || 0}</td>
        <td class="text-end fw-semibold">${SC.money(Math.round(amount))}</td>
        <td><span class="badge bg-light text-dark border" style="font-size:.72rem">${METHOD_LABELS[t.payment_method] || SC.esc(t.payment_method)}</span></td>
        <td><span class="badge-status ${payCls}">${SC.esc(t.payment_status)}</span></td>
        <td>${SC.statusBadge(t.order_status)}</td>
      </tr>`;
    }).join('');

    document.getElementById('txMeta').textContent =
      `${txRows.length} transaction${txRows.length === 1 ? '' : 's'} shown` +
      (showVendorShare ? ' · amounts are your items’ share (incl. GST)' : '');
  }

  // ---- CSV export of the visible transactions ----
  document.getElementById('exportCsv').addEventListener('click', () => {
    if (!txRows.length) return SC.toast('Nothing to export.', 'warning');
    const showVendorShare = report.scope === 'vendor';
    const head = ['Order ID', 'Date', 'Token', 'Customer', 'Items', 'Amount', 'Method', 'Payment Status', 'Order Status'];
    const escCell = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
    const lines = [head.join(',')];
    txRows.forEach((t) => {
      lines.push([
        t.id, t.created_at, t.token_number, t.customer_name, t.item_count,
        showVendorShare ? t.vendor_amount : t.total_amount,
        t.payment_method, t.payment_status, t.order_status
      ].map(escCell).join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `sales-report-${iso(new Date())}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
    SC.toast('Sales report exported');
  });

  // ---- Load everything for the selected range ----
  async function load() {
    try {
      const qs = rangeQuery();
      report = await SC.api('/api/analytics/sales' + (qs ? '?' + qs : ''), { silent: true });
      renderSummary(report);
      renderTransactions();
      await renderTrend();
    } catch (err) {
      SC.toast(err.message, 'error');
    }
  }

  // ---- Controls ----
  document.getElementById('applyRange').addEventListener('click', load);
  document.getElementById('txSearch').addEventListener('input', () => {
    if (report) renderTransactions();
  });
  document.querySelectorAll('.quick-range').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = btn.dataset.range;
      const to = new Date();
      let from;
      if (r === 'month') {
        from = new Date(to.getFullYear(), to.getMonth(), 1);
      } else {
        from = new Date(to.getTime() - (Number(r) - 1) * 86400000);
      }
      document.getElementById('fromDate').value = iso(from);
      document.getElementById('toDate').value = iso(to);
      load();
    });
  });

  await load();
});
