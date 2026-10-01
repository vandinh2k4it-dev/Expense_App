import React, { useEffect, useState } from 'react';
import { api, cached } from '../api.js';
import { GroupedList } from './ExpenseList.jsx';
import { Avatar, userName } from './Avatar.jsx';
import { addDays, endOfMonth, fmtVND, startOfMonth, startOfWeek, toISO, todayISO } from '../utils.js';

function ranges() {
  const now = new Date();
  return {
    monthFrom: toISO(startOfMonth(now)),
    monthTo: toISO(endOfMonth(now)),
    recent: { from: toISO(addDays(now, -6)), to: todayISO() },
  };
}

export default function Home({ user, refreshKey, onEdit, onProfile }) {
  // Hiện ngay dữ liệu lần trước (nếu có), rồi cập nhật khi server trả lời
  const [sum, setSum] = useState(() => { const r = ranges(); return cached.summary(r.monthFrom, r.monthTo); });
  const [recent, setRecent] = useState(() => cached.list(ranges().recent));
  const [err, setErr] = useState('');

  useEffect(() => {
    let alive = true;
    const r = ranges();
    setErr('');
    Promise.all([api.summary(r.monthFrom, r.monthTo), api.list(r.recent)])
      .then(([s, l]) => { if (alive) { setSum(s); setRecent(l); } })
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
          <div className="hello">Xin chào, {userName(user)} 👋</div>
          <h1 className="title">Thu chi của bạn</h1>
        </div>
        <button className="avatar-btn" onClick={onProfile} aria-label="Hồ sơ"><Avatar user={user} size={44} /></button>
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
