import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../api.js';
import { GroupedList } from './ExpenseList.jsx';
import {
  WD_SHORT, addDays, addMonths, catOf, dayLabel, endOfMonth, fmtShort, fmtVND, fromISO,
  monthLabel, startOfMonth, startOfWeek, toISO, todayISO, weekLabel,
} from '../utils.js';

const MODES = [
  { id: 'day', label: 'Ngày' },
  { id: 'week', label: 'Tuần' },
  { id: 'month', label: 'Tháng' },
];

export default function Stats({ refreshKey, onEdit }) {
  const [mode, setMode] = useState('week');
  const [cursor, setCursor] = useState(new Date());
  const [sum, setSum] = useState(null);
  const [dayItems, setDayItems] = useState([]);
  const [err, setErr] = useState('');

  const { from, to, label } = useMemo(() => {
    if (mode === 'day') return { from: toISO(cursor), to: toISO(cursor), label: dayLabel(toISO(cursor)) };
    if (mode === 'week') { const s = startOfWeek(cursor); return { from: toISO(s), to: toISO(addDays(s, 6)), label: 'Tuần ' + weekLabel(s) }; }
    return { from: toISO(startOfMonth(cursor)), to: toISO(endOfMonth(cursor)), label: monthLabel(cursor) };
  }, [mode, cursor]);

  useEffect(() => {
    let alive = true;
    setErr('');
    setSum(null);
    Promise.all([api.summary(from, to), api.list({ from, to })])
      .then(([s, l]) => { if (alive) { setSum(s); setDayItems(l); } })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [from, to, refreshKey]);

  const step = (dir) => {
    if (mode === 'day') setCursor(addDays(cursor, dir));
    else if (mode === 'week') setCursor(addDays(cursor, 7 * dir));
    else setCursor(addMonths(cursor, dir));
  };
  const atFuture = to >= todayISO() && from <= todayISO();

  // dữ liệu cột
  const bars = useMemo(() => {
    if (!sum || mode === 'day') return [];
    const map = new Map(sum.byDay.map((d) => [d.day, d.total]));
    const out = [];
    let d = fromISO(from);
    const end = fromISO(to);
    while (d <= end) {
      const iso = toISO(d);
      out.push({
        iso,
        value: map.get(iso) || 0,
        label: mode === 'week' ? WD_SHORT[(d.getDay() + 6) % 7] : String(d.getDate()),
      });
      d = addDays(d, 1);
    }
    return out;
  }, [sum, mode, from, to]);

  const max = Math.max(1, ...bars.map((b) => b.value));
  const days = bars.length || 1;
  const avg = sum ? sum.total / (mode === 'day' ? 1 : days) : 0;
  const catMax = Math.max(1, ...(sum?.byCategory.map((c) => c.total) || [1]));

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div className="hello">Phân tích chi tiêu</div>
          <h1 className="title">Thống kê</h1>
        </div>
      </div>

      <div className="seg">
        {MODES.map((m) => (
          <button key={m.id} className={mode === m.id ? 'on' : ''} onClick={() => setMode(m.id)}>{m.label}</button>
        ))}
      </div>

      <div className="nav">
        <button onClick={() => step(-1)}>‹</button>
        <div>{label}</div>
        <button onClick={() => step(1)} disabled={atFuture}>›</button>
      </div>

      {err && <div className="err">{err}</div>}

      <div className="card pad">
        <div className="total-box">
          <small>Tổng chi</small>
          <div className="big">{sum ? fmtVND(sum.total) : '—'}</div>
          {sum && mode !== 'day' && <small>Trung bình {fmtVND(avg)}/ngày · {sum.count} giao dịch</small>}
          {sum && mode === 'day' && <small>{sum.count} giao dịch</small>}
        </div>

        {mode !== 'day' && sum && (
          <div className={'bars' + (mode === 'month' ? ' dense' : '')}>
            {bars.map((b, i) => {
              const h = b.value ? Math.max(4, (b.value / max) * 100) : 0;
              const showLabel = mode === 'week' || i === 0 || (i + 1) % 5 === 0;
              return (
                <button
                  key={b.iso}
                  className="bar"
                  onClick={() => { setCursor(fromISO(b.iso)); setMode('day'); }}
                  title={`${b.iso}: ${fmtVND(b.value)}`}
                >
                  {mode === 'week' && b.value > 0 && <em>{fmtShort(b.value)}</em>}
                  <i className={b.value ? '' : 'zero'} style={{ height: b.value ? h + '%' : 3 }} />
                  <span>{showLabel ? b.label : ' '}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {sum && sum.byCategory.length > 0 && (
        <>
          <div className="section-title">Theo danh mục</div>
          <div className="card pad">
            {sum.byCategory.map((c) => {
              const cat = catOf(c.category);
              return (
                <div className="cat-row" key={c.category}>
                  <div className="ico" style={{ background: cat.color + '26' }}>{cat.icon}</div>
                  <div className="grow">
                    <div className="top">
                      <span>{cat.label}</span>
                      <span>{fmtVND(c.total)} <small style={{ color: 'var(--muted)', fontWeight: 500 }}>· {Math.round((c.total / (sum.total || 1)) * 100)}%</small></span>
                    </div>
                    <div className="track"><i style={{ width: (c.total / catMax) * 100 + '%', background: cat.color }} /></div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <div className="section-title">Chi tiết <span>{dayItems.length} khoản</span></div>
      {sum === null && !err ? <div className="loading"><span className="spin" /></div> : <GroupedList items={dayItems} onEdit={onEdit} />}
    </div>
  );
}
