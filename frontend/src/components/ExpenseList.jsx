import React from 'react';
import { catOf, dayLabel, fmtVND, groupByDay } from '../utils.js';

export function ExpenseItem({ e, onClick }) {
  const c = catOf(e.category);
  return (
    <button className="item" onClick={() => onClick(e)}>
      <div className="ico" style={{ background: c.color + '26' }}>{c.icon}</div>
      <div className="grow">
        <div className="t">{e.title}</div>
        <div className="s">{c.label}</div>
      </div>
      <div className="amt">-{fmtVND(e.amount)}</div>
    </button>
  );
}

export function GroupedList({ items, onEdit }) {
  const groups = groupByDay(items);
  if (!groups.length) {
    return (
      <div className="empty">
        <div className="em">🧾</div>
        Chưa có khoản chi nào
      </div>
    );
  }
  return groups.map((g) => (
    <div key={g.day}>
      <div className="day-head">
        <span>{dayLabel(g.day)}</span>
        <span>Tổng <b>{fmtVND(g.total)}</b></span>
      </div>
      <div className="card">
        {g.items.map((e) => <ExpenseItem key={e.id} e={e} onClick={onEdit} />)}
      </div>
    </div>
  ));
}
