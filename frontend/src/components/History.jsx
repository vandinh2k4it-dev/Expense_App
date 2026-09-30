import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { GroupedList } from './ExpenseList.jsx';
import { CATEGORIES, addDays, endOfMonth, addMonths, fmtVND, startOfMonth, toISO, todayISO } from '../utils.js';

const RANGES = [
  { id: 'today', label: 'Hôm nay' },
  { id: '7d', label: '7 ngày' },
  { id: 'month', label: 'Tháng này' },
  { id: 'lastmonth', label: 'Tháng trước' },
  { id: 'all', label: 'Tất cả' },
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
  const [category, setCategory] = useState('all');
  const [q, setQ] = useState('');
  const [items, setItems] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    setErr('');
    const t = setTimeout(() => {
      api.list({ ...rangeDates(range), category, q: q.trim() })
        .then((r) => alive && setItems(r))
        .catch((e) => alive && setErr(e.message));
    }, q ? 300 : 0);
    return () => { alive = false; clearTimeout(t); };
  }, [range, category, q, refreshKey]);

  const total = useMemo(() => (items || []).reduce((a, e) => a + e.amount, 0), [items]);

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div className="hello">Lịch sử giao dịch</div>
          <h1 className="title">Sổ chi tiêu</h1>
        </div>
      </div>

      <div className="search">
        <span>🔍</span>
        <input placeholder="Tìm theo nội dung…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      <div className="chips">
        {RANGES.map((r) => (
          <button key={r.id} className={'chip' + (range === r.id ? ' on' : '')} onClick={() => setRange(r.id)}>{r.label}</button>
        ))}
      </div>
      <div className="chips">
        <button className={'chip' + (category === 'all' ? ' on' : '')} onClick={() => setCategory('all')}>Tất cả</button>
        {CATEGORIES.map((c) => (
          <button key={c.id} className={'chip' + (category === c.id ? ' on' : '')} onClick={() => setCategory(c.id)}>{c.icon} {c.label}</button>
        ))}
      </div>

      {err && <div className="err">{err}</div>}

      <div className="card pad" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--muted)' }}>{items ? `${items.length} giao dịch` : 'Đang tải…'}</span>
        <b style={{ fontSize: 18 }}>{fmtVND(total)}</b>
      </div>

      {items === null && !err ? <div className="loading"><span className="spin" /></div> : <GroupedList items={items || []} onEdit={onEdit} />}
    </div>
  );
}
