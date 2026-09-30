import React, { useCallback, useEffect, useState } from 'react';
import { getToken, setToken, setUnauthorizedHandler, api } from './api.js';
import Auth from './components/Auth.jsx';
import Home from './components/Home.jsx';
import History from './components/History.jsx';
import Stats from './components/Stats.jsx';
import ExpenseSheet from './components/ExpenseSheet.jsx';
import ProfileSheet from './components/ProfileSheet.jsx';
import { Avatar, userName } from './components/Avatar.jsx';

function loadUser() {
  try { return getToken() ? JSON.parse(localStorage.getItem('user')) : null; } catch { return null; }
}

export default function App() {
  const [user, setUser] = useState(loadUser);
  const [tab, setTab] = useState('home');
  const [sheet, setSheet] = useState(null); // null | {} (mới) | expense (sửa)
  const [profileOpen, setProfileOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [toast, setToast] = useState('');

  const logout = useCallback(() => {
    setToken('');
    localStorage.removeItem('user');
    setUser(null);
  }, []);

  const storeUser = useCallback((u) => {
    try { localStorage.setItem('user', JSON.stringify(u)); } catch { /* ảnh quá lớn cho localStorage: bỏ qua */ }
    setUser(u);
  }, []);

  useEffect(() => { setUnauthorizedHandler(logout); }, [logout]);
  // đánh thức server free (Render ngủ sau ~15 phút không dùng)
  useEffect(() => { api.ping().catch(() => {}); }, []);
  // đồng bộ hồ sơ (tên + ảnh) từ server mỗi lần mở app
  const hasUser = !!user;
  useEffect(() => {
    if (!hasUser) return;
    api.me().then(storeUser).catch(() => {});
  }, [hasUser, storeUser]);

  if (!user) return <Auth onDone={setUser} />;

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(''), 1800);
  };
  const saved = (msg) => {
    setSheet(null);
    setRefreshKey((k) => k + 1);
    flash(msg);
  };

  const tabs = [
    { id: 'home', icon: '🏠', label: 'Trang chủ' },
    { id: 'history', icon: '🧾', label: 'Thu chi' },
    { id: 'add' },
    { id: 'stats', icon: '📊', label: 'Thống kê' },
    { id: 'me', icon: '👤', label: 'Tôi' },
  ];

  return (
    <div className="app">
      {tab === 'home' && <Home user={user} refreshKey={refreshKey} onEdit={setSheet} onProfile={() => setTab('me')} />}
      {tab === 'history' && <History refreshKey={refreshKey} onEdit={setSheet} />}
      {tab === 'stats' && <Stats refreshKey={refreshKey} onEdit={setSheet} />}
      {tab === 'me' && (
        <div className="page">
          <div className="topbar"><h1 className="title">Tài khoản</h1></div>
          <div className="card pad profile-card">
            <Avatar user={user} size={84} />
            <b className="pname">{userName(user)}</b>
            <div className="hello muted">@{user.username}</div>
            <button className="btn" style={{ marginTop: 16 }} onClick={() => setProfileOpen(true)}>Chỉnh sửa hồ sơ</button>
          </div>
          <button className="btn danger" style={{ marginTop: 14 }} onClick={logout}>Đăng xuất</button>
        </div>
      )}

      <nav className="tabbar">
        {tabs.map((t) =>
          t.id === 'add' ? (
            <button key="add" className="fab" aria-label="Thêm giao dịch" onClick={() => setSheet({})}>+</button>
          ) : (
            <button key={t.id} className={'tab' + (tab === t.id ? ' on' : '')} onClick={() => setTab(t.id)}>
              <span className="i">{t.icon}</span>
              {t.label}
            </button>
          )
        )}
      </nav>

      {sheet && <ExpenseSheet initial={sheet} onClose={() => setSheet(null)} onSaved={saved} />}
      {profileOpen && (
        <ProfileSheet
          user={user}
          onClose={() => setProfileOpen(false)}
          onSaved={(u) => { storeUser(u); setProfileOpen(false); flash('Đã lưu hồ sơ'); }}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
