# CI/CD và triển khai CustomAOV trên Vercel

Dùng một Vercel Project kết nối với repo GitHub. Preview dành cho kiểm thử trên `dev`. Production phục vụ domain chính từ `main`.

| Thao tác | GitHub Actions | Vercel |
| --- | --- | --- |
| Mở hoặc cập nhật PR từ `feat/*` vào `dev` | Chạy job `verify` | |
| Merge hoặc push vào `dev` | Chạy job `verify` | Build và deploy Preview |
| Mở hoặc cập nhật PR từ `dev` vào `main` | Chạy job `verify` | |
| Merge PR vào `main` | Chạy lại job `verify` | Build và deploy Production |

Job `verify` chạy build, lint, typecheck, unit test và integration test. Sau khi Preview trên `dev` đã được kiểm thử, mở PR `dev` → `main` và đợi `verify` PASS trên PR trước khi merge. GitHub Actions và Vercel cùng nhận sự kiện push, vì vậy việc kiểm tra trước khi merge là bước chặn phát hành.

## Thiết lập ban đầu

1. Trong Vercel, kết nối repo GitHub, chọn **Root Directory** là gốc repo và **Production Branch** là `main`. [Vercel Git deployments](https://vercel.com/docs/git)
2. Dùng [`vercel.json` ở gốc repo](../vercel.json). File này chạy `npm ci`, build bằng `npm run build --workspace base-frontend-web`, xuất `base-frontend-web/dist` và cấu hình SPA rewrite để URL con tải lại được.
3. Trong **Settings → Environment Variables**, cấu hình riêng cho **Preview** và **Production**. Với bản demo, đặt `VITE_DATA_SOURCE=mock` cho cả hai. Với Supabase, đặt `VITE_DATA_SOURCE=supabase`, `VITE_SUPABASE_URL` và `VITE_SUPABASE_ANON_KEY` của môi trường tương ứng. Chạy lại deployment sau khi đổi biến.
4. Trên GitHub, quản trị viên bảo vệ `main` bằng **Require a pull request before merging** và **Require status checks to pass before merging**. Chọn job `verify` làm check bắt buộc. [GitHub branch protection](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
5. Sau khi merge cấu hình vào `dev`, kiểm tra Vercel hiển thị deployment **Preview** từ commit mới, rồi mở và tải lại trực tiếp `/tournaments`. Sau khi PR `dev` → `main` đạt yêu cầu, merge và kiểm tra commit của **Production** trên domain chính.

## Kiểm tra deployment bằng Vercel MCP

MCP cho phép Codex tra deployment và đọc log trong phạm vi quyền đã cấp. Git integration của Vercel tự chạy pipeline khi có thay đổi trên các nhánh đã cấu hình. Để kết nối MCP trên Windows, chạy lệnh dưới đây và hoàn tất OAuth nếu được yêu cầu. [Vercel MCP](https://vercel.com/docs/agent-resources/vercel-mcp)

```powershell
codex.cmd mcp add vercel --url https://mcp.vercel.com
codex.cmd mcp list
```

## Trạng thái triển khai

Cấu hình được đưa vào [PR #10](https://github.com/suThyyy/customaov-platform/pull/10). Build, lint/typecheck và test đã chạy thành công trên máy local. Kiểm tra trực tiếp Preview, Production và trạng thái bảo vệ `main` sau khi cấu hình được áp dụng.
