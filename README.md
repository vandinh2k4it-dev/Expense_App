# Sổ Chi Tiêu – web app mobile

Ghi thu nhập và chi tiêu hằng ngày (nhập tay nội dung + số tiền), tự cộng tổng và số dư theo ngày / tuần / tháng, lọc kiểu MoMo (loại thu/chi, khoảng thời gian, danh mục, tìm kiếm).

- **frontend/**: React + Vite → deploy **Vercel**
- **backend/**: Node + Express → deploy **Render** (free)
- **Database**: Postgres → **Neon** (free). Không dùng SQLite vì ổ đĩa của Render free bị xóa khi restart.

## Chạy thử trên máy

```bash
# backend
cd backend
cp .env.example .env      # điền DATABASE_URL (Neon) và JWT_SECRET
npm install
npm run dev               # http://localhost:4000

# frontend (terminal khác)
cd frontend
cp .env.example .env      # VITE_API_URL=http://localhost:4000
npm install
npm run dev
```

Bảng dữ liệu tự tạo khi backend khởi động lần đầu.

## Deploy

### 1) Đẩy code lên GitHub
Tạo repo mới, đẩy cả thư mục này lên (giữ nguyên `frontend/` và `backend/`).

### 2) Database – Neon
1. Đăng ký https://neon.tech → tạo project.
2. Copy **Connection string** (dạng `postgresql://...?sslmode=require`) → đây là `DATABASE_URL`.

### 3) Backend – Render
1. https://render.com → **New → Web Service** → chọn repo GitHub.
2. Cấu hình:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free
3. Thêm **Environment Variables**:
   - `DATABASE_URL` = chuỗi Neon ở bước 2
   - `JWT_SECRET` = một chuỗi ngẫu nhiên dài
   - `CORS_ORIGIN` = `*` khi test, sau đó đổi thành domain Vercel (VD `https://ten-app.vercel.app`)
4. Deploy xong sẽ có URL dạng `https://ten-app.onrender.com`. Mở `/health` để kiểm tra.

> Render free tự "ngủ" sau ~15 phút không dùng, lần mở đầu có thể chờ 30–60 giây. App đã tự gọi đánh thức server khi mở.

### 4) Frontend – Vercel
1. https://vercel.com → **Add New → Project** → chọn cùng repo.
2. **Root Directory**: `frontend` (Framework: Vite, tự nhận).
3. **Environment Variables**: `VITE_API_URL` = URL Render ở bước 3 (không có dấu `/` cuối).
4. Deploy. Sau đó quay lại Render, đặt `CORS_ORIGIN` = domain Vercel.

### 5) Dùng như app trên điện thoại
Mở link Vercel bằng Safari/Chrome → **Thêm vào Màn hình chính**.

## API nhanh

| Method | Đường dẫn | Mô tả |
|---|---|---|
| POST | `/api/auth/register`, `/api/auth/login` | Đăng ký / đăng nhập (JWT) |
| GET | `/api/expenses?from&to&category&q&min&max` | Danh sách + lọc |
| POST / PUT / DELETE | `/api/expenses[/:id]` | Thêm / sửa / xóa |
| GET | `/api/stats/summary?from&to` | Tổng, theo ngày, theo danh mục |
| GET | `/api/stats/months?year=` | Tổng theo từng tháng |
