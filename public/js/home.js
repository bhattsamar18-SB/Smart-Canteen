/* Home page - loads top-selling items into the "Popular right now" grid */
document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('popularGrid');
  if (!grid) return;
  try {
    const data = await SC.api('/api/food?sort=popular');
    const items = data.items.filter((i) => i.available && i.stock > 0).slice(0, 4);
    if (!items.length) {
      grid.innerHTML = '<div class="empty-state"><div class="big">🍽️</div><h5>Menu coming right up</h5></div>';
      return;
    }
    grid.innerHTML = items.map(foodCard).join('');
  } catch (err) {
    grid.innerHTML = `<div class="empty-state"><div class="big">😕</div><h5>Could not load the menu</h5><p>${SC.esc(err.message)}</p></div>`;
  }
});
