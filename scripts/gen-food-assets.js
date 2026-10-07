// Generates the placeholder food images used by the menu (public/assets/food/*.svg)
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'public', 'assets', 'food');
fs.mkdirSync(dir, { recursive: true });

const items = [
  ['dosa', '🥞', '#FDE68A', '#F59E0B'],
  ['idli', '🍙', '#FEF3C7', '#F59E0B'],
  ['paratha', '🫓', '#FDE68A', '#EA580C'],
  ['omelette', '🍳', '#FDE68A', '#F97316'],
  ['samosa', '🥟', '#FEE2E2', '#EF4444'],
  ['sandwich', '🥪', '#FECACA', '#F97316'],
  ['pavbhaji', '🍛', '#FED7AA', '#EA580C'],
  ['burger', '🍔', '#FECACA', '#DC2626'],
  ['fries', '🍟', '#FDE68A', '#F59E0B'],
  ['pizza', '🍕', '#FEE2E2', '#EA580C'],
  ['thali', '🍽️', '#FED7AA', '#C2410C'],
  ['friedrice', '🍚', '#FEF3C7', '#D97706'],
  ['paneerroll', '🌯', '#FDE68A', '#EA580C'],
  ['tea', '🍵', '#CCFBF1', '#0D9488'],
  ['coldcoffee', '🧋', '#CFFAFE', '#0891B2'],
  ['juice', '🧃', '#FDE68A', '#F97316'],
  ['lassi', '🥤', '#FDE68A', '#EAB308'],
  ['cake', '🍰', '#FCE7F3', '#DB2777'],
  ['icecream', '🍨', '#FCE7F3', '#EC4899']
];

for (const [name, emoji, c1, c2] of items) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" width="400" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><circle cx="60" cy="50" r="90" fill="#ffffff" opacity="0.18"/><circle cx="350" cy="260" r="110" fill="#ffffff" opacity="0.14"/><circle cx="320" cy="60" r="40" fill="#ffffff" opacity="0.16"/><circle cx="200" cy="150" r="92" fill="#ffffff" opacity="0.35"/><text x="200" y="150" font-size="96" text-anchor="middle" dominant-baseline="central">${emoji}</text></svg>\n`;
  fs.writeFileSync(path.join(dir, `${name}.svg`), svg);
}
console.log(`Wrote ${items.length} food images to public/assets/food`);
