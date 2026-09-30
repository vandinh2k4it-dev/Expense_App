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
  const dayTotal = sum?.byDay.find((d) => d.day === today)?.total || 0;
  const weekTotal = sum ? sum.byDay.filter((d) => d.day >= weekStart && d.day <= today).reduce((a, d) => a + d.total, 0) : 0;
  // tuần có thể kéo sang tháng trước → cộng bù từ danh sách gần đây
  const weekFromRecent = recent ? recent.filter((e) => e.spent_on >= weekStart).reduce((a, e) => a + e.amount, 0) : weekTotal;

  return (
    <div className="page">
      <div className="topbar">
        <div>
          <div className="hello">Xin chào, {user.username} 👋</div>
          <h1 className="title">Chi tiêu của bạn</h1>
        </div>
        <div className="avatar">{user.username[0]?.toUpperCase()}</div>
      </div>

      {err && <div className="err">{err}</div>}

      <div className="hero">
        <small>Tổng chi tháng {now.getMonth() + 1}</small>
        <div className="big">{sum ? fmtVND(sum.total) : '—'}</div>
        <div className="row">
          <div className="pill"><small>Hôm nay</small><b>{fmtVND(dayTotal)}</b></div>
          <div className="pill"><small>Tuần này</small><b>{fmtVND(weekFromRecent)}</b></div>
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
