import React, { useState } from 'react';
import { api } from '../api.js';
import { CATEGORIES, digits, fmtInput, todayISO } from '../utils.js';

const QUICK = [10000, 20000, 50000, 100000];

export default function ExpenseSheet({ initial, onClose, onSaved }) {
  const editing = !!initial?.id;
  const [title, setTitle] = useState(initial?.title || '');
  const [amount, setAmount] = useState(initial ? fmtInput(String(initial.amount)) : '');
  const [category, setCategory] = useState(initial?.category || 'food');
  const [date, setDate] = useState(initial?.spent_on || todayISO());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const addQuick = (n) => setAmount(fmtInput(String((+digits(amount) || 0) + n)));

  async function save(e) {
    e.preventDefault();
    setErr('');
    if (!title.trim()) return setErr('Nhập nội dung bạn đã chi');
    if (!digits(amount)) return setErr('Nhập số tiền');
    setBusy(true);
    try {
      const body = { title: title.trim(), amount: +digits(amount), category, spent_on: date };
      if (editing) await api.update(initial.id, body);
      else await api.create(body);
      onSaved(editing ? 'Đã cập nhật' : 'Đã thêm khoản chi');
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm('Xóa khoản chi này?')) return;
    setBusy(true);
    try {
      await api.remove(initial.id);
      onSaved('Đã xóa');
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="sheet" onClick={(e) => e.stopPropagation()} onSubmit={save}>
        <div className="grab" />
        <h3>{editing ? 'Sửa khoản chi' : 'Thêm khoản chi'}</h3>
        {err && <div className="err">{err}</div>}

        <div className="field">
          <label>Số tiền (đ)</label>
          <input className="input amount-input" inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(fmtInput(e.target.value))} autoFocus={!editing} />
          <div className="quick">
            {QUICK.map((n) => (
              <button type="button" key={n} onClick={() => addQuick(n)}>+{n / 1000}k</button>
            ))}
            <button type="button" onClick={() => setAmount('')}>Xóa</button>
          </div>
        </div>

        <div className="field">
          <label>Đã mua / ăn / làm gì?</label>
          <input className="input" placeholder="VD: Cơm trưa, đổ xăng, cà phê…" value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="field">
          <label>Danh mục</label>
          <div className="cats">
            {CATEGORIES.map((c) => (
              <button type="button" key={c.id} className={'cat' + (category === c.id ? ' on' : '')} onClick={() => setCategory(c.id)}>
                <span>{c.icon}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Ngày</label>
          <input className="input" type="date" value={date} max="2100-12-31" onChange={(e) => setDate(e.target.value)} />
        </div>

        <button className="btn" disabled={busy}>{busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Lưu khoản chi'}</button>
        {editing && (
          <div className="btn-row">
            <button type="button" className="btn danger" onClick={del} disabled={busy}>Xóa</button>
            <button type="button" className="btn ghost" onClick={onClose}>Hủy</button>
          </div>
        )}
      </form>
    </div>
  );
}
