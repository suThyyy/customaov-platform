# DECISIONS – nhật ký quyết định

> Ghi mọi quyết định của Owner và quyết định Lead tự đưa ra (mới nhất ở dưới). Mỗi dòng: ngày · ai · quyết định · lý do.

## Owner – 15/11/2026 (duyệt PRD + ROADMAP)

- Duyệt PRD, ROADMAP, 10 thư viện ở PRD mục 6, route `/tournaments/new`, và empty state cho tướng/KDA ở hồ sơ.
- Auth cookie: bắt buộc `SameSite=Lax` + **CSRF token cho mọi request ghi**, rate-limit đăng nhập, không log mật khẩu/token.
- Ở E2, thay template jOOQ/Spring trong `base-backend-api/.agent/rules` bằng quy tắc thật của stack.
- Copilot: chỉ dùng khi agent khác cùng bậc không khả dụng, **tối đa 20 lượt** tới khi Owner quay lại.
- **Toàn quyền cho Lead** trong phạm vi repo: chọn/điều chỉnh task, đổi model, đổi schema DB, thêm thư viện cần thiết (ghi lý do vào ROADMAP), merge epic vào `main`. Quyết định sản phẩm mơ hồ thì chọn phương án an toàn, đơn giản nhất và ghi vào đây.
- Điều kiện merge vào `main`: reviewer khác hãng duyệt, và build/lint/test/e2e/screenshot đều pass. Trước mỗi lần merge tạo tag `epic-<n>-before`.
- Hàng rào cứng:
  - Không push, deploy, hay gửi code/dữ liệu ra ngoài.
  - Không tiêu tiền ngoài subscription.
  - Không đọc/ghi ngoài `D:\CustomAOV\base-workspace`.
  - Không sửa `_old_web_DO_NOT_EDIT/`, `web_backup_*/`.
  - Không viết lại lịch sử `main`.
  - Không làm yếu test.
- Worker chạy chế độ tự duyệt trong worktree của task, mỗi worker một cổng dev riêng (5175, 5176…).

## Lead

- 15/11 · Lead · **Worktree đặt trong `base-workspace/.worktrees/<id>-<slug>`** (gitignore), tạo bằng `git worktree add`, rồi Orca nhận qua `--worktree path:…` (đã bật `external-worktree-visibility show` cho repo). Lý do: `orca worktree create` đặt worktree ở thư mục do Orca quản lý, có thể nằm ngoài `base-workspace`, vi phạm hàng rào đọc/ghi.
- 15/11 · Lead · Mọi worker (Codex, Antigravity, Copilot) chạy qua `orca terminal create --command "<CLI + cờ tự duyệt>"` + `worker-start --terminal`, vì `--agent` của Orca không cho truyền cờ tự duyệt hay `service_tier`.
- 15/11 · Lead · Cổng dev: mỗi worker một cổng từ 5175 trở lên, Lead cấp theo slot đang trống và ghi trong `tasks/<id>.md` và `STATE.md`. Lead dùng 5174 để kiểm tra trước khi merge.
- 15/11 · Lead · CSRF: dùng mẫu double-submit token (cookie `csrf` không httpOnly + header `X-CSRF-Token`), tự viết, không thêm thư viện.
- 15/11 · Lead · Không bật được "Continue automatically when limits reset" qua `orca` CLI (CLI 1.4.258 không có lệnh settings nào cho mục này). Đã ghi vào MORNING_REPORT.
