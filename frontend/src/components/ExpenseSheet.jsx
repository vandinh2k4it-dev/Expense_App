import React, { useState } from 'react';
import { api } from '../api.js';
import { catsOf, digits, fmtInput, todayISO } from '../utils.js';

const QUICK = [10000, 20000, 50000, 100000];
const QUICK_IN = [100000, 500000, 1000000, 5000000];

const fmtQuick = (n) => (n >= 1000000 ? `${n / 1000000}tr` : `${n / 1000}k`);

export default function ExpenseSheet({ initial, onClose, onSaved }) {
  const editing = !!initial?.id;
  const [type, setType] = useState(initial?.type === 'income' ? 'income' : 'expense');
  const [title, setTitle] = useState(initial?.title || '');
  const [amount, setAmount] = useState(initial?.amount ? fmtInput(String(initial.amount)) : '');
  const [category, setCategory] = useState(initial?.category || 'food');
  const [date, setDate] = useState(initial?.spent_on || todayISO());
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const isIn = type === 'income';
  const cats = catsOf(type);

  function switchType(t) {
    if (t === type) return;
    setType(t);
    setCategory(catsOf(t)[0].id);
  }

  const addQuick = (n) => setAmount(fmtInput(String((+digits(amount) || 0) + n)));

  async function save(e) {
    e.preventDefault();
    setErr('');
    if (!title.trim()) return setErr(isIn ? 'Nhập nguồn thu' : 'Nhập nội dung bạn đã chi');
    if (!digits(amount)) return setErr('Nhập số tiền');
    setBusy(true);
    try {
      const body = { title: title.trim(), amount: +digits(amount), category, spent_on: date, type };
      if (editing) await api.update(initial.id, body);
      else await api.create(body);
      onSaved(editing ? 'Đã cập nhật' : isIn ? 'Đã thêm khoản thu' : 'Đã thêm khoản chi');
    } catch (e2) {
      setErr(e2.message);
      setBusy(false);
    }
  }

  async function del() {
    if (!confirm('Xóa giao dịch này?')) return;
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
        <div className="seg typeseg">
          <button type="button" className={!isIn ? 'on' : ''} onClick={() => switchType('expense')}>Chi tiêu</button>
          <button type="button" className={isIn ? 'on in' : ''} onClick={() => switchType('income')}>Thu nhập</button>
        </div>
        {err && <div className="err">{err}</div>}

        <div className="field">
          <label>Số tiền (đ)</label>
          <input className={'input amount-input' + (isIn ? ' in' : '')} inputMode="numeric" placeholder="0" value={amount} onChange={(e) => setAmount(fmtInput(e.target.value))} autoFocus={!editing} />
          <div className="quick">
            {(isIn ? QUICK_IN : QUICK).map((n) => (
              <button type="button" key={n} onClick={() => addQuick(n)}>+{fmtQuick(n)}</button>
            ))}
            <button type="button" onClick={() => setAmount('')}>Xóa</button>
          </div>
        </div>

        <div className="field">
          <label>{isIn ? 'Nguồn thu' : 'Đã mua / ăn / làm gì?'}</label>
          <input className="input" placeholder={isIn ? 'VD: Lương tháng 9, được mẹ cho…' : 'VD: Cơm trưa, đổ xăng, cà phê…'} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>

        <div className="field">
          <label>Danh mục</label>
          <div className="cats">
            {cats.map((c) => (
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

        <button className="btn" disabled={busy}>
          {busy ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : isIn ? 'Lưu khoản thu' : 'Lưu khoản chi'}
        </button>
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
