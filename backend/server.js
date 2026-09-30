require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL && !/localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL)
    ? { rejectUnauthorized: false }
    : false,
});

const origins = (process.env.CORS_ORIGIN || '*').split(',').map((s) => s.trim());
app.use(cors({ origin: origins.includes('*') ? true : origins }));
app.use(express.json());

async function initDb() {
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

app.get('/', (_req, res) => res.json({ ok: true, name: 'expense-api' }));
app.get('/health', (_req, res) => res.json({ ok: true }));

// ---------- Auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || username.trim().length < 3) return res.status(400).json({ error: 'Tên đăng nhập tối thiểu 3 ký tự' });
  if (!password || password.length < 6) return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự' });
  const name = username.trim().toLowerCase();
  const hash = await bcrypt.hash(password, 10);
  try {
    const r = await pool.query(
      'INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username',
      [name, hash]
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
  res.json({ token, user: { id: u.id, username: u.username } });
}));

// ---------- Expenses ----------
// GET /api/expenses?from=YYYY-MM-DD&to=YYYY-MM-DD&category=food&q=text&min=&max=
app.get('/api/expenses', auth, wrap(async (req, res) => {
  const { from, to, category, q, min, max } = req.query;
  const params = [req.user.id];
  let sql = 'SELECT id, to_char(spent_on, \'YYYY-MM-DD\') AS spent_on, title, amount::float8 AS amount, category FROM expenses WHERE user_id = $1';
  if (isDate(from)) { params.push(from); sql += ` AND spent_on >= $${params.length}`; }
  if (isDate(to)) { params.push(to); sql += ` AND spent_on <= $${params.length}`; }
  if (category && category !== 'all') { params.push(category); sql += ` AND category = $${params.length}`; }
  if (q) { params.push(`%${q}%`); sql += ` AND title ILIKE $${params.length}`; }
  if (min !== undefined && min !== '' && !isNaN(+min)) { params.push(+min); sql += ` AND amount >= $${params.length}`; }
  if (max !== undefined && max !== '' && !isNaN(+max)) { params.push(+max); sql += ` AND amount <= $${params.length}`; }
  sql += ' ORDER BY spent_on DESC, id DESC LIMIT 2000';
  const r = await pool.query(sql, params);
  res.json(r.rows);
}));

app.post('/api/expenses', auth, wrap(async (req, res) => {
  const { spent_on, title, amount, category } = req.body || {};
  if (!isDate(spent_on)) return res.status(400).json({ error: 'Ngày không hợp lệ' });
  if (!title || !title.trim()) return res.status(400).json({ error: 'Thiếu nội dung' });
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt < 0) return res.status(400).json({ error: 'Số tiền không hợp lệ' });
  const r = await pool.query(
    `INSERT INTO expenses (user_id, spent_on, title, amount, category)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, to_char(spent_on, 'YYYY-MM-DD') AS spent_on, title, amount::float8 AS amount, category`,
    [req.user.id, spent_on, title.trim(), amt, category || 'other']
  );
  res.json(r.rows[0]);
}));

app.put('/api/expenses/:id', auth, wrap(async (req, res) => {
  const { spent_on, title, amount, category } = req.body || {};
  if (!isDate(spent_on)) return res.status(400).json({ error: 'Ngày không hợp lệ' });
  if (!title || !title.trim()) return res.status(400).json({ error: 'Thiếu nội dung' });
  const amt = Math.round(Number(amount));
  if (!Number.isFinite(amt) || amt < 0) return res.status(400).json({ error: 'Số tiền không hợp lệ' });
  const r = await pool.query(
    `UPDATE expenses SET spent_on=$1, title=$2, amount=$3, category=$4
     WHERE id=$5 AND user_id=$6
     RETURNING id, to_char(spent_on, 'YYYY-MM-DD') AS spent_on, title, amount::float8 AS amount, category`,
    [spent_on, title.trim(), amt, category || 'other', req.params.id, req.user.id]
  );
  if (!r.rows[0]) return res.status(404).json({ error: 'Không tìm thấy' });
  res.json(r.rows[0]);
}));

app.delete('/api/expenses/:id', auth, wrap(async (req, res) => {
  await pool.query('DELETE FROM expenses WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
  res.json({ ok: true });
}));

// ---------- Stats ----------
// GET /api/stats/summary?from=&to=  -> tổng, theo ngày, theo danh mục
app.get('/api/stats/summary', auth, wrap(async (req, res) => {
  const { from, to } = req.query;
  if (!isDate(from) || !isDate(to)) return res.status(400).json({ error: 'Thiếu from/to' });
  const p = [req.user.id, from, to];
  const [total, byDay, byCat] = await Promise.all([
    pool.query('SELECT COALESCE(SUM(amount),0)::float8 AS total, COUNT(*)::int AS count FROM expenses WHERE user_id=$1 AND spent_on BETWEEN $2 AND $3', p),
    pool.query(`SELECT to_char(spent_on,'YYYY-MM-DD') AS day, SUM(amount)::float8 AS total, COUNT(*)::int AS count
                FROM expenses WHERE user_id=$1 AND spent_on BETWEEN $2 AND $3 GROUP BY spent_on ORDER BY spent_on`, p),
    pool.query(`SELECT category, SUM(amount)::float8 AS total, COUNT(*)::int AS count
                FROM expenses WHERE user_id=$1 AND spent_on BETWEEN $2 AND $3 GROUP BY category ORDER BY total DESC`, p),
  ]);
  res.json({ ...total.rows[0], byDay: byDay.rows, byCategory: byCat.rows });
}));

// GET /api/stats/months?year=2026 -> tổng theo từng tháng trong năm
app.get('/api/stats/months', auth, wrap(async (req, res) => {
  const year = parseInt(req.query.year, 10) || new Date().getFullYear();
  const r = await pool.query(
    `SELECT EXTRACT(MONTH FROM spent_on)::int AS month, SUM(amount)::float8 AS total, COUNT(*)::int AS count
     FROM expenses WHERE user_id=$1 AND EXTRACT(YEAR FROM spent_on)=$2
     GROUP BY 1 ORDER BY 1`,
    [req.user.id, year]
  );
  res.json(r.rows);
}));

initDb()
  .then(() => app.listen(PORT, () => console.log(`API chạy tại cổng ${PORT}`)))
  .catch((e) => {
    console.error('Không khởi tạo được DB:', e.message);
    process.exit(1);
  });
