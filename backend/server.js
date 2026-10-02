require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

// Pool nhỏ: trên Vercel mỗi instance chỉ cần vài kết nối, đóng sớm để không giữ kết nối của Neon.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false,
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
});
pool.on('error', (e) => console.error('Pool error:', e.message)); // kết nối nhàn rỗi bị Neon đóng: không làm sập app

const origins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
app.use(cors({ origin: origins.includes('*') ? true : origins }));
app.use(express.json({ limit: '1mb' }));

app.get('/', (_req, res) => res.json({ ok: true, name: 'expense-api' }));
// /health không đụng tới database: luôn trả lời nhanh
app.get('/health', (_req, res) => res.json({ ok: true }));

// Khởi tạo / nâng cấp bảng: chạy lười, đúng một lần cho mỗi instance, và bỏ qua nếu DB đã đủ.
// (Trên serverless mỗi lần khởi động lạnh không cần chạy lại cả loạt ALTER TABLE.)
let dbReady = null;
function ensureDb() {
  if (!dbReady) {
    dbReady = initDb().catch((e) => {
      dbReady = null; // lần gọi sau thử lại
      throw e;
    });
  }
  return dbReady;
}
app.use((req, res, next) => {
  ensureDb().then(() => next(), (e) => {
    console.error('Không khởi tạo được DB:', e.message);
    res.status(503).json({ error: 'Cơ sở dữ liệu chưa sẵn sàng, thử lại sau ít giây' });
  });
});

async function isSchemaCurrent() {
  const r = await pool.query(`
    SELECT
      to_regclass('public.users') IS NOT NULL AS has_users,
      to_regclass('public.expenses') IS NOT NULL AS has_expenses,
      (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = 'public'
           AND ((table_name = 'expenses' AND column_name = 'type')
             OR (table_name = 'users' AND column_name IN ('display_name', 'avatar')))) AS new_cols
  `);
  const s = r.rows[0];
  return s.has_users && s.has_expenses && Number(s.new_cols) === 3;
}

async function initDb() {
  if (await isSchemaCurrent()) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS expenses (
      id SERIAL PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      spent_on DATE NOT NULL,
      title TEXT NOT NULL,
      amount BIGINT NOT NULL CHECK (amount >= 0),
      category TEXT NOT NULL DEFAULT 'other',
      created_at TIMESTAMPTZ DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses(user_id, spent_on);
    -- Thu nhập: dữ liệu cũ tự động là 'expense'
    ALTER TABLE expenses ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'expense';
    -- Hồ sơ: tên hiển thị + ảnh đại diện (data URL đã nén ở client)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar TEXT;
  `);
}

function auth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Chưa đăng nhập' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Phiên đăng nhập hết hạn' });
  }
}

const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Lỗi máy chủ' });
});

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s || '');
const TYPES = ['expense', 'income'];
const normType = (t) => (TYPES.includes(t) ? t : 'expense');
const COLS = `id, to_char(spent_on, 'YYYY-MM-DD') AS spent_on, title, amount::float8 AS amount, category, type`;
const USER_COLS = 'id, username, display_name, avatar';
const AVATAR_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
const AVATAR_MAX = 400000; // ~300KB ảnh sau khi nén

// Trả về { value } nếu hợp lệ, hoặc { error }
function cleanName(v) {
  if (v === null || v === undefined) return { value: null };
  if (typeof v !== 'string') return { error: 'Tên hiển thị không hợp lệ' };
  const s = v.trim().replace(/\s+/g, ' ');
  if (s.length > 40) return { error: 'Tên hiển thị tối đa 40 ký tự' };
  return { value: s || null };
}
function cleanAvatar(v) {
  if (v === null || v === undefined || v === '') return { value: null };
  if (typeof v !== 'string' || v.length > AVATAR_MAX || !AVATAR_RE.test(v)) return { error: 'Ảnh đại diện không hợp lệ hoặc quá lớn' };
  return { value: v };
}

// ---------- Auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || username.trim().length < 3) return res.status(400).json({ error: 'Tên đăng nhập tối thiểu 3 ký tự' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự' });
  const nm = cleanName(req.body.display_name);
  if (nm.error) return res.status(400).json({ error: nm.error });
  const av = cleanAvatar(req.body.avatar);
  if (av.error) return res.status(400).json({ error: av.error });
  const name = username.trim().toLowerCase();
  const hash = await bcrypt.hash(password, 10);
  try {
    const r = await pool.query(
      `INSERT INTO users (username, password_hash, display_name, avatar) VALUES ($1, $2, $3, $4) RETURNING ${USER_COLS}`,
      [name, hash, nm.value, av.value]
    );
    const user = r.rows[0];
    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: '90d' });
    res.json({ token, user });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'Tên đăng nhập đã tồn tại' });
    throw e;
  }
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  const r = await pool.query('SELECT * FROM users WHERE username = $1', [(username || '').trim().toLowerCase()]);
  const u = r.rows[0];
  if (!u || !(await bcrypt.compare(password || '', u.password_hash))) {
    return res.status(401).json({ error: 'Sai tên đăng nhập hoặc mật khẩu' });
  }
  const token = jwt.sign({ id: u.id, username: u.username }, JWT_SECRET, { expiresIn: '90d' });
  res.json({ token, user: { id: u.id, username: u.username, display_name: u.display_name, avatar: u.avatar } });
}));

// ---------- Hồ sơ ----------
app.get('/api/me', auth, wrap(async (req, res) => {
  const r = await pool.query(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [req.user.id]);
  if (!r.rows[0]) return res.status(401).json({ error: 'Tài khoản không tồn tại' });
  res.json(r.rows[0]);
}));

// PUT /api/me { display_name?, avatar? }  (avatar: null để xóa ảnh)
app.put('/api/me', auth, wrap(async (req, res) => {
  const body = req.body || {};
  const sets = [];
  const params = [];
  if ('display_name' in body) {
    const nm = cleanName(body.display_name);
    if (nm.error) return res.status(400).json({ error: nm.error });
    params.push(nm.value); sets.push(`display_name = $${params.length}`);
  }
  if ('avatar' in body) {
    const av = cleanAvatar(body.avatar);
    if (av.error) return res.status(400).json({ error: av.error });
    params.push(av.value); sets.push(`avatar = $${params.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'Không có gì để cập nhật' });
  params.push(req.user.id);
  const r = await pool.query(`UPDATE users SET ${sets.join(', ')} WHERE id = $${params.length} RETURNING ${USER_COLS}`, params);
  res.json(r.rows[0]);
}));

// ---------- Giao dịch (chi + thu) ----------
// GET /api/expenses?from&to&type=expense|income&category&q&min&max
app.get('/api/expenses', auth, wrap(async (req, res) => {
  const { from, to, type, category, q, min, max } = req.query;
  const params = [req.user.id];
  let sql = `SELECT ${COLS} FROM expenses WHERE user_id = $1`;
  if (isDate(from)) { params.push(from); sql += ` AND spent_on >= $${params.length}`; }
  if (isDate(to)) { params.push(to); sql += ` AND spent_on <= $${params.length}`; }
  if (TYPES.includes(type)) { params.push(type); sql += ` AND type = $${params.length}`; }
  if (category && category !== 'all') { params.push(category); sql += ` AND category = $${params.length}`; }
  if (q) { params.push(`%${q}%`); sql += ` AND title ILIKE $${params.length}`; }
  if (min !== undefined && min !== '' && !isNaN(+min)) { params.push(+min); sql += ` AND amount >= $${params.length}`; }
  if (max !== undefined && max !== '' && !isNaN(+max)) { params.push(+max); sql += ` AND amount <= $${params.length}`; }
  sql += ' ORDER BY spent_on DESC, id DESC LIMIT 2000';
  const r = await pool.query(sql, params);
  res.json(r.rows);
}));

function readBody(req, res) {
  const { spent_on, title, amount, category } = req.body || {};
  const type = normType(req.body?.type);
  if (!isDate(spent_on)) { res.status(400).json({ error: 'Ngày không hợp lệ' }); return null; }
  if (!title || !title.trim()) { res.status(400).json({ error: 'Thiếu nội dung' }); return null; }
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt < 0) { res.status(400).json({ error: 'Số tiền không hợp lệ' }); return null; }
  return { spent_on, title: title.trim(), amt, type, category: category || (type === 'income' ? 'other_in' : 'other') };
}

app.post('/api/expenses', auth, wrap(async (req, res) => {
  const b = readBody(req, res);
  if (!b) return;
  const r = await pool.query(
    `INSERT INTO expenses (user_id, spent_on, title, amount, category, type)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING ${COLS}`,
    [req.user.id, b.spent_on, b.title, b.amt, b.category, b.type]
  );
  res.json(r.rows[0]);
}));

app.put('/api/expenses/:id', auth, wrap(async (req, res) => {
  const b = readBody(req, res);
  if (!b) return;
  const r = await pool.query(
    `UPDATE expenses SET spent_on=$1, title=$2, amount=$3, category=$4, type=$5
     WHERE id=$6 AND user_id=$7 RETURNING ${COLS}`,
    [b.spent_on, b.title, b.amt, b.category, b.type, req.params.id, req.user.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json(r.rows[0]);
}));

app.delete('/api/expenses/:id', auth, wrap(async (req, res) => {
  await pool.query('DELETE FROM expenses WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ---------- Thống kê ----------
const SUM_EXP = `COALESCE(SUM(amount) FILTER (WHERE type='expense'),0)::float8`;
const SUM_INC = `COALESCE(SUM(amount) FILTER (WHERE type='income'),0)::float8`;

// GET /api/stats/summary?from&to -> { expense, income, count, byDay[{day,expense,income,count}], byCategory[{type,category,total,count}] }
app.get('/api/stats/summary', auth, wrap(async (req, res) => {
  const { from, to } = req.query;
  if (!isDate(from) || !isDate(to)) return res.status(400).json({ error: 'Thiếu from/to' });
  const p = [req.user.id, from, to];
  const [total, byDay, byCat] = await Promise.all([
    pool.query(`SELECT ${SUM_EXP} AS expense, ${SUM_INC} AS income, COUNT(*)::int AS count
                FROM expenses WHERE user_id=$1 AND spent_on BETWEEN $2 AND $3`, p),
    pool.query(`SELECT to_char(spent_on,'YYYY-MM-DD') AS day, ${SUM_EXP} AS expense, ${SUM_INC} AS income, COUNT(*)::int AS count
                FROM expenses WHERE user_id=$1 AND spent_on BETWEEN $2 AND $3 GROUP BY spent_on ORDER BY spent_on`, p),
    pool.query(`SELECT type, category, SUM(amount)::float8 AS total, COUNT(*)::int AS count
                FROM expenses WHERE user_id=$1 AND spent_on BETWEEN $2 AND $3 GROUP BY type, category ORDER BY total DESC`, p),
  ]);
  res.json({ ...total.rows[0], byDay: byDay.rows, byCategory: byCat.rows });
}));

// GET /api/stats/months?year=2026 -> thu/chi theo từng tháng
app.get('/api/stats/months', auth, wrap(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const r = await pool.query(
    `SELECT EXTRACT(MONTH FROM spent_on)::int AS month, ${SUM_EXP} AS expense, ${SUM_INC} AS income, COUNT(*)::int AS count
     FROM expenses WHERE user_id=$1 AND EXTRACT(YEAR FROM spent_on)=$2
     GROUP BY 1 ORDER BY 1`,
    [req.user.id, year]
  );
  res.json(r.rows);
}));

// Lỗi chung (vd: body quá lớn) trả về JSON thay vì HTML
app.use((err, _req, res, _next) => {
  if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu gửi lên quá lớn (ảnh đại diện quá nặng)' });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Dữ liệu không hợp lệ' });
  console.error(err);
  res.status(500).json({ error: 'Lỗi máy chủ' });
});

// Chạy trực tiếp (npm start / Render / máy bạn): mở cổng như trước.
// Trên Vercel file này chỉ được require từ api/index.js, không mở cổng.
if (require.main === module) {
  ensureDb()
    .then(() => app.listen(PORT, () => console.log(`API chạy tại cổng ${PORT}`)))
    .catch((e) => {
      console.error('Không khởi tạo được DB:', e.message);
      process.exit(1);
    });
}

module.exports = app;
