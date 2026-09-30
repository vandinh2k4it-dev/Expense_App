import React, { useCallback, useEffect, useState } from 'react';
import { getToken, setToken, setUnauthorizedHandler, api } from './api.js';
import Auth from './components/Auth.jsx';
import Home from './components/Home.jsx';
import History from './components/History.jsx';
import Stats from './components/Stats.jsx';
import ExpenseSheet from './components/ExpenseSheet.jsx';

function loadUser() {
  try { return getToken() ? JSON.parse(localStorage.getItem('user')) : null; } catch { return null; }
}

export default function App() {
  const [user, setUser] = useState(loadUser);
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(null); // null | {} (mới) | expense (sửa)
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState('');

  const logout = useCallback(() => {
    setToken('');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);
  // đánh thức server free (Render ngủ sau ~15 phút không dùng)
  useEffect(() => { api.ping().catch(() => {}); }, []);

  if (!user) return <Auth onDone={setUser} />;

  const saved = (msg) => {
    setSheet(null);
    setRefreshKey((k) => k + 1);
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  };

  const tabs = [
    { id: 'home', icon: '🏠', label: 'Trang chủ' },
    { id: 'history', icon: '🧾', label: 'Sổ chi' },
    { id: 'add' },
    { id: 'stats', icon: '📊', label: 'Thống kê' },
    { id: 'me', icon: '👤', label: 'Tôi' },
  ];

  return (
    <div className="app">
      {tab === 'home' && <Home user={user} refreshKey={refreshKey} onEdit={setSheet} />}
      {tab === 'history' && <History refreshKey={refreshKey} onEdit={setSheet} />}
      {tab === 'stats' && <Stats refreshKey={refreshKey} onEdit={setSheet} />}
      {tab === 'me' && (
        <div className="page">
          <div className="topbar"><h1 className="title">Tài khoản</h1></div>
          <div className="card pad" style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <div className="avatar" style={{ width: 52, height: 52, fontSize: 20 }}>{user.username[0]?.toUpperCase()}</div>
            <div>
              <b>{user.username}</b>
              <div className="hello">Dữ liệu được lưu trên máy chủ</div>
            </div>
          </div>
          <button className="btn danger" onClick={logout}>Đăng xuất</button>
        </div>
      )}

      <nav className="tabbar">
        {tabs.map((t) =>
          t.id === 'add' ? (
            <button key="add" className="fab" aria-label="Thêm khoản chi" onClick={() => setSheet({})}>+</button>
          ) : (
            <button key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
              <span className="i">{t.icon}</span>
              {t.label}
            </button>
          )
        )}
      </nav>

      {sheet && <ExpenseSheet initial={sheet} onClose={() => setSheet(null)} onSaved={saved} />}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
