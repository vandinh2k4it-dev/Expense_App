# Sổ Chi Tiêu – web app mobile

Ghi thu nhập và chi tiêu hằng ngày (nhập tay nội dung + số tiền), tự cộng tổng và số dư theo ngày / tuần / tháng, lọc kiểu MoMo (loại thu/chi, khoảng thời gian, danh mục, tìm kiếm).

- **frontend/**: React + Vite → deploy **Vercel** (project 1)
- **backend/**: Node + Express chạy dạng **Vercel Functions** → deploy **Vercel** (project 2, cùng repo)
- **Database**: Postgres → **Neon** (free)

Cả hai project cùng nằm trên Vercel Hobby (miễn phí), không còn server "ngủ 30–60 giây" như Render free. `backend/server.js` vẫn chạy được kiểu cũ (`npm start`, Render, máy cá nhân) nếu bạn cần.

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

Bảng dữ liệu tự tạo / tự nâng cấp ở lần gọi API đầu tiên.

## Deploy

### 1) Đẩy code lên GitHub
Một repo chứa cả `frontend/` và `backend/`.

### 2) Database – Neon
1. https://neon.tech → tạo project. **Ghi nhớ khu vực (Region)** vì bước 3 cần khớp.
2. Lấy **Connection string**. Nên dùng chuỗi **Pooled connection** (host có chữ `-pooler`), hợp với serverless. Dạng `postgresql://...?sslmode=require` → đây là `DATABASE_URL`.

### 3) Backend – Vercel Functions
1. https://vercel.com → **Add New → Project** → chọn repo.
2. **Root Directory**: `backend` · **Framework Preset**: Other. Để trống Build/Output Command.
3. **Environment Variables**:
   - `DATABASE_URL` = chuỗi Neon ở bước 2
   - `JWT_SECRET` = chuỗi ngẫu nhiên dài (dùng lại chuỗi cũ nếu muốn giữ đăng nhập hiện tại)
   - `CORS_ORIGIN` = `*` khi test, sau đó đổi thành domain frontend (VD `https://ten-app.vercel.app`)
4. Deploy. Mở `https://<tên-project-backend>.vercel.app/health` → thấy `{"ok":true}` là xong. Dùng domain chính của project (không dùng link riêng của từng lần deploy).

**Khu vực chạy hàm (quan trọng cho tốc độ):** hàm nên đặt gần database. Mặc định Vercel chạy ở Washington D.C. (`iad1`), hợp với Neon `us-east`. Nếu Neon của bạn ở Singapore, thêm vào `backend/vercel.json`:

```json
{
  "regions": ["sin1"],
  "rewrites": [{ "source": "/(.*)", "destination": "/api/index.js" }]
}
```

Nếu deploy báo lỗi về `regions`, bỏ dòng đó đi.

### 4) Frontend – Vercel
1. **Add New → Project** → chọn cùng repo.
2. **Root Directory**: `frontend` (Framework: Vite, tự nhận).
3. **Environment Variables**: `VITE_API_URL` = URL backend ở bước 3 (không có dấu `/` cuối).
4. Deploy. Đổi `VITE_API_URL` sau này thì phải **Redeploy** vì giá trị được nhúng lúc build.

### 5) Dùng như app trên điện thoại
Mở link frontend bằng Safari/Chrome → **Thêm vào Màn hình chính**.

### Phương án dự phòng: Render
Nếu muốn chạy backend trên Render: Root Directory `backend`, Build `npm install`, Start `npm start`, cùng 3 biến môi trường như trên. Render free tự ngủ sau ~15 phút; dùng https://cron-job.org gọi `/health` mỗi 10 phút để giữ thức.

## API nhanh

| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/health` | Kiểm tra sống, không đụng database |
| POST | `/api/auth/register`, `/api/auth/login` | Đăng ký (kèm tên hiển thị, ảnh đại diện) / đăng nhập (JWT) |
| GET / PUT | `/api/me` | Xem / sửa hồ sơ (tên hiển thị, ảnh đại diện) |
| GET | `/api/expenses?from&to&type&category&q&min&max` | Danh sách + lọc |
| POST / PUT / DELETE | `/api/expenses[/:id]` | Thêm / sửa / xóa |
| GET | `/api/stats/summary?from&to` | Tổng thu/chi, theo ngày, theo danh mục |
| GET | `/api/stats/months?year=` | Thu/chi theo từng tháng |
