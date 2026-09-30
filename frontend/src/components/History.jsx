import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { GroupedList } from './ExpenseList.jsx';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, addDays, endOfMonth, addMonths, fmtVND, startOfMonth, toISO, todayISO } from '../utils.js';

const RANGES = [
  { id: 'today', label: 'Hôm nay' },
  { id: '7d', label: '7 ngày' },
  { id: 'month', label: 'Tháng này' },
  { id: 'lastmonth', label: 'Tháng trước' },
  { id: 'all', label: 'Tất cả' },
];
const TYPES = [
  { id: 'all', label: 'Tất cả' },
  { id: 'expense', label: '⬆ Chi tiêu' },
  { id: 'income', label: '⬇ Thu nhập' },
];

function rangeDates(id) {
  const now = new Date();
  if (id === 'today') return { from: todayISO(), to: todayISO() };
  if (id === '7d') return { from: toISO(addDays(now, -6)), to: todayISO() };
  if (id === 'month') return { from: toISO(startOfMonth(now)), to: toISO(endOfMonth(now)) };
  if (id === 'lastmonth') { const m = addMonths(now, -1); return { from: toISO(startOfMonth(m)), to: toISO(endOfMonth(m)) }; }
  return {};
}

export default function History({ refreshKey, onEdit }) {
  const [range, setRange] = useState('month');
  const [type, setType] = useState('all');
  const [category, setCategory] = useState('all');
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');

  const cats = type === 'income' ? INCOME_CATEGORIES : type === 'expense' ? EXPENSE_CATEGORIES : [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

  useEffect(() => {
    let alive = true;
    setErr('');
    const t = setTimeout(() => {
      api.list({ ...rangeDates(range), type: type === 'all' ? '' : type, category, q: q.trim() })
        .then((r) => alive && setItems(r))
        .catch((e) => alive && setErr(e.message));
    }, q ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [range, type, category, q, refreshKey]);

  const { expense, income } = useMemo(() => {
    let expense = 0, income = 0;
    for (const e of items || []) {
      if (e.type === 'income') income += e.amount;
      else expense += e.amount;
    }
    return { expense, income };
  }, [items]);

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div className="hello">Lịch sử giao dịch</div>
          <h1 className="title">Sổ thu chi</h1>
        </div>
      </div>

      <div className="search">
        <span>🔍</span>
        <input placeholder="Tìm theo nội dung…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="chips">
        {TYPES.map((t) => (
          <button key={t.id} className={'chip' + (type === t.id ? ' on' : '')} onClick={() => { setType(t.id); setCategory('all'); }}>{t.label}</button>
        ))}
      </div>
      <div className="chips">
        {RANGES.map((r) => (
          <button key={r.id} className={'chip' + (range === r.id ? ' on' : '')} onClick={() => setRange(r.id)}>{r.label}</button>
        ))}
      </div>
      <div className="chips">
        <button className={'chip' + (category === 'all' ? ' on' : '')} onClick={() => setCategory('all')}>Mọi danh mục</button>
        {cats.map((c) => (
          <button key={c.id} className={'chip' + (category === c.id ? ' on' : '')} onClick={() => setCategory(c.id)}>{c.icon} {c.label}</button>
        ))}
      </div>

      {err && <div className="err">{err}</div>}

      <div className="card pad summary-line">
        <div>
          <small>{items ? `${items.length} giao dịch` : 'Đang tải…'}</small>
        </div>
        <div className="sums">
          {income > 0 && <b className="in">+{fmtVND(income)}</b>}
          {expense > 0 && <b>-{fmtVND(expense)}</b>}
          {items && income === 0 && expense === 0 && <b>0đ</b>}
        </div>
      </div>

      {items === null && !err ? <div className="loading"><span className="spin" /></div> : <GroupedList items={items || []} onEdit={onEdit} />}
    </div>
  );
}
