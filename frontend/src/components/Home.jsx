import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { GroupedList } from './ExpenseList.jsx';
import { addDays, endOfMonth, fmtVND, startOfMonth, startOfWeek, toISO, todayISO } from '../utils.js';

export default function Home({ user, refreshKey, onEdit }) {
  const [sum, setSum] = useState(null);
  const [recent, setRecent] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const now = new Date();
    setErr('');
    Promise.all([
      api.summary(toISO(startOfMonth(now)), toISO(endOfMonth(now))),
      api.list({ from: toISO(addDays(now, -6)), to: todayISO() }),
    ])
      .then(([s, r]) => { if (alive) { setSum(s); setRecent(r); } })
      .catch((e) => alive && setErr(e.message));
    return () => { alive = false; };
  }, [refreshKey]);

  const now = new Date();
  const today = todayISO();
  const weekStart = toISO(startOfWeek(now));
  const spent = (list, pred) => (list || []).filter((e) => e.type !== 'income' && pred(e)).reduce((a, e) => a + e.amount, 0);
  const dayExpense = spent(recent, (e) => e.spent_on === today);
  const weekExpense = spent(recent, (e) => e.spent_on >= weekStart);
  const balance = sum ? sum.income - sum.expense : 0;

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div className="hello">Xin chào, {user.username} 👋</div>
          <h1 className="title">Thu chi của bạn</h1>
        </div>
        <div className="avatar">{user.username[0]?.toUpperCase()}</div>
      </div>

      {err && <div className="err">{err}</div>}

      <div className="hero">
        <small>Số dư tháng {now.getMonth() + 1}</small>
        <div className="big">{sum ? fmtVND(balance) : '—'}</div>
        <div className="row">
          <div className="pill"><small>⬇ Thu nhập</small><b>{sum ? '+' + fmtVND(sum.income) : '—'}</b></div>
          <div className="pill"><small>⬆ Chi tiêu</small><b>{sum ? '-' + fmtVND(sum.expense) : '—'}</b></div>
        </div>
        <div className="row small">
          <div className="pill"><small>Chi hôm nay</small><b>{fmtVND(dayExpense)}</b></div>
          <div className="pill"><small>Chi tuần này</small><b>{fmtVND(weekExpense)}</b></div>
        </div>
      </div>

      <div className="section-title">Gần đây <span>7 ngày qua</span></div>
      {recent === null && !err ? (
        <div className="loading"><span className="spin" /></div>
      ) : (
        <GroupedList items={recent || []} onEdit={onEdit} />
      )}
    </div>
  );
}
