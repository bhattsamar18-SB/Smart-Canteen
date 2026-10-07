/* Admin sales & analytics - KPIs + Chart.js charts with date filtering */
document.addEventListener('DOMContentLoaded', async () => {
  const user = await Admin.init();
  if (!user) return;

  const TEAL = '#0f766e';
  const AMBER = '#f59e0b';
  const charts = {};

  Chart.defaults.font.family = "'Inter', sans-serif";
  Chart.defaults.color = '#64748b';

  function rangeParams() {
    const p = new URLSearchParams();
    const from = document.getElementById('fromDate').value;
    const to = document.getElementById('toDate').value;
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    return p.toString();
  }

  function makeChart(id, config) {
    if (charts[id]) charts[id].destroy();
    charts[id] = new Chart(document.getElementById(id), config);
  }

  function lineOptions(yMoney) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { callback: (v) => (yMoney ? '₹' + v : v) }
        },
        x: { grid: { display: false } }
      }
    };
  }

  async function loadKPIs() {
    try {
      const s = await SC.api('/api/analytics/summary');
      document.getElementById('kpiToday').textContent = SC.money(s.todayRevenue);
      document.getElementById('kpiWeek').textContent = SC.money(s.weekRevenue);
      document.getElementById('kpiMonth').textContent = SC.money(s.monthRevenue);
      document.getElementById('kpiOrders').textContent = s.totalOrders;
      document.getElementById('kpiAvg').textContent = SC.money(Math.round(s.avgOrderValue));
    } catch (err) {
      SC.toast(err.message, 'error');
    }
  }

  async function loadCharts() {
    const qs = rangeParams();
    try {
      const [daily, popular, category] = await Promise.all([
        SC.api('/api/analytics/daily' + (qs ? '?' + qs : '')),
        SC.api('/api/analytics/popular'),
        SC.api('/api/analytics/category')
      ]);

      const labels = daily.data.map((d) => d.label.slice(5)); // MM-DD

      makeChart('salesChart', {
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
        options: lineOptions(true)
      });

      makeChart('ordersChart', {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: daily.data.map((d) => d.orders),
            backgroundColor: AMBER,
            borderRadius: 6
          }]
        },
        options: lineOptions(false)
      });

      const pop = popular.items.slice(0, 7);
      makeChart('popularChart', {
        type: 'bar',
        data: {
          labels: pop.map((p) => p.name),
          datasets: [{ data: pop.map((p) => p.quantity), backgroundColor: TEAL, borderRadius: 6 }]
        },
        options: {
          indexAxis: 'y',
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { x: { beginAtZero: true, ticks: { stepSize: 1 } }, y: { grid: { display: false } } }
        }
      });

      const palette = [TEAL, AMBER, '#0ea5e9', '#8b5cf6', '#ef4444', '#14b8a6'];
      makeChart('categoryChart', {
        type: 'doughnut',
        data: {
          labels: category.categories.map((c) => c.category),
          datasets: [{
            data: category.categories.map((c) => c.revenue),
            backgroundColor: palette,
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'right', labels: { boxWidth: 14, padding: 12 } },
            tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ₹${ctx.raw}` } }
          }
        }
      });
    } catch (err) {
      SC.toast(err.message, 'error');
    }
  }

  document.getElementById('applyRange').addEventListener('click', loadCharts);
  document.querySelectorAll('.quick-range').forEach((btn) => {
    btn.addEventListener('click', () => {
      const days = Number(btn.dataset.days);
      const to = new Date();
      const from = new Date(to.getTime() - (days - 1) * 86400000);
      const iso = (d) => d.toISOString().slice(0, 10);
      document.getElementById('fromDate').value = iso(from);
      document.getElementById('toDate').value = iso(to);
      loadCharts();
    });
  });

  await loadKPIs();
  await loadCharts();
});
