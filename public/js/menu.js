/* Menu page - search, category filter, sorting, popular strip */
document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('foodGrid');
  const empty = document.getElementById('emptyState');
  const count = document.getElementById('resultCount');
  const search = document.getElementById('searchInput');
  const sort = document.getElementById('sortSelect');
  const pills = document.getElementById('catPills');

  let state = {
    category: new URLSearchParams(location.search).get('category') || '',
    search: '',
    sort: ''
  };
  let debounce = null;
  let allItems = [];

  // reflect URL category in pills
  pills.querySelectorAll('.cat-pill').forEach((p) => {
    p.classList.toggle('active', p.dataset.cat === state.category);
    p.addEventListener('click', () => {
      pills.querySelectorAll('.cat-pill').forEach((x) => x.classList.remove('active'));
      p.classList.add('active');
      state.category = p.dataset.cat;
      load();
    });
  });

  search.addEventListener('input', () => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.search = search.value.trim(); load(); }, 280);
  });
  sort.addEventListener('change', () => { state.sort = sort.value; load(); });
  document.getElementById('clearFilters').addEventListener('click', () => {
    state = { category: '', search: '', sort: '' };
    search.value = '';
    sort.value = '';
    pills.querySelectorAll('.cat-pill').forEach((x) => x.classList.toggle('active', x.dataset.cat === ''));
    load();
  });

  async function load() {
    try {
      const params = new URLSearchParams();
      if (state.category) params.set('category', state.category);
      if (state.search) params.set('search', state.search);
      if (state.sort) params.set('sort', state.sort);
      const data = await SC.api('/api/food?' + params.toString());
      allItems = data.items;

      const hasFilters = state.category || state.search || state.sort;
      count.textContent = `${data.items.length} item${data.items.length === 1 ? '' : 's'}`;
      grid.hidden = data.items.length === 0;
      empty.hidden = data.items.length !== 0;
      grid.innerHTML = data.items.map(foodCard).join('');

      // Popular strip only when no filters are active
      const strip = document.getElementById('popularStrip');
      if (!hasFilters) {
        const popular = [...allItems]
          .sort((a, b) => b.order_count - a.order_count)
          .filter((i) => i.order_count > 0 && i.available && i.stock > 0)
          .slice(0, 3);
        if (popular.length) {
          strip.hidden = false;
          document.getElementById('popularGrid').innerHTML = popular.map(foodCard).join('');
        } else strip.hidden = true;
      } else {
        strip.hidden = true;
      }
    } catch (err) {
      grid.innerHTML = `<div class="empty-state col-12"><div class="big">😕</div><h5>Could not load the menu</h5><p>${SC.esc(err.message)}</p></div>`;
    }
  }

  load();
});
