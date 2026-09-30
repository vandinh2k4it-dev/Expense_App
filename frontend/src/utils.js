export const CATEGORIES = [
  { id: 'food', label: 'Ăn uống', icon: '🍜', color: '#ff8a4c' },
  { id: 'shopping', label: 'Mua sắm', icon: '🛍️', color: '#ff5c8a' },
  { id: 'transport', label: 'Di chuyển', icon: '🛵', color: '#3fa9f5' },
  { id: 'bills', label: 'Hóa đơn', icon: '🧾', color: '#8b7bff' },
  { id: 'fun', label: 'Giải trí', icon: '🎮', color: '#22c3a6' },
  { id: 'health', label: 'Sức khỏe', icon: '💊', color: '#f2c94c' },
  { id: 'other', label: 'Khác', icon: '✨', color: '#9aa3b2' },
];
export const catOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[CATEGORIES.length - 1];

export const fmtVND = (n) => new Intl.NumberFormat('vi-VN').format(Math.round(n || 0)) + 'đ';
export const fmtShort = (n) => {
  n = Math.round(n || 0);
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + ' tỷ';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'tr';
  if (n >= 1e3) return Math.round(n / 1e3) + 'k';
  return String(n);
};

const pad = (n) => String(n).padStart(2, '0');
export const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const todayISO = () => toISO(new Date());
export const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const startOfWeek = (d) => { const x = new Date(d); const wd = (x.getDay() + 6) % 7; x.setDate(x.getDate() - wd); x.setHours(0, 0, 0, 0); return x; };
export const startOfMonth = (d) => new Date(d.getFullYear(), d.getMonth(), 1);
export const endOfMonth = (d) => new Date(d.getFullYear(), d.getMonth() + 1, 0);
export const addMonths = (d, n) => new Date(d.getFullYear(), d.getMonth() + n, 1);

const WD = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
export const WD_SHORT = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export function dayLabel(iso) {
  const t = todayISO();
  const d = fromISO(iso);
  const dm = `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  if (iso === t) return `Hôm nay · ${dm}`;
  if (iso === toISO(addDays(new Date(), -1))) return `Hôm qua · ${dm}`;
  return `${WD[d.getDay()]} · ${dm}`;
}

export const monthLabel = (d) => `Tháng ${d.getMonth() + 1}/${d.getFullYear()}`;

export function weekLabel(start) {
  const end = addDays(start, 6);
  return `${pad(start.getDate())}/${pad(start.getMonth() + 1)} – ${pad(end.getDate())}/${pad(end.getMonth() + 1)}`;
}

export function groupByDay(items) {
  const map = new Map();
  for (const e of items) {
    if (!map.has(e.spent_on)) map.set(e.spent_on, { day: e.spent_on, total: 0, items: [] });
    const g = map.get(e.spent_on);
    g.total += e.amount;
    g.items.push(e);
  }
  return [...map.values()].sort((a, b) => (a.day < b.day ? 1 : -1));
}

export const digits = (s) => String(s || '').replace(/\D/g, '');
export const fmtInput = (s) => { const d = digits(s); return d ? new Intl.NumberFormat('vi-VN').format(+d) : ''; };
