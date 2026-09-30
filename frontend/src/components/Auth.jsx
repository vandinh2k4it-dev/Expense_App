import React, { useState } from 'react';
import { api, setToken } from '../api.js';

export default function Auth({ onDone }) {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const fn = mode === 'login' ? api.login : api.register;
      const { token, user } = await fn(username, password);
      setToken(token);
      localStorage.setItem('user', JSON.stringify(user));
      onDone(user);
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="auth" onSubmit={submit}>
      <div className="logo">💸</div>
      <h1>Sổ Chi Tiêu</h1>
      <p>{mode === 'login' ? 'Đăng nhập để xem chi tiêu của bạn' : 'Tạo tài khoản để bắt đầu ghi chép'}</p>
      {err && <div className="err">{err}</div>}
      <div className="field">
        <label>Tên đăng nhập</label>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" required />
      </div>
      <div className="field">
        <label>Mật khẩu</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required />
      </div>
      <button className="btn" disabled={busy}>{busy ? 'Đang xử lý…' : mode === 'login' ? 'Đăng nhập' : 'Đăng ký'}</button>
      <button type="button" className="link" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setErr(''); }}>
        {mode === 'login' ? 'Chưa có tài khoản? Đăng ký' : 'Đã có tài khoản? Đăng nhập'}
      </button>
    </form>
  );
}
