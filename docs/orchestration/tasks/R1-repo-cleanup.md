# R1 – Dọn repo trước khi push lên GitHub để làm việc nhóm

- Coder: agy `gemini-4-hydrogen-medium` · Reviewer: Lead hoặc Codex
- Nhánh `task/R1-repo-cleanup` · Worktree `.worktrees/R1-repo-cleanup` · rẽ từ **`main`**

## Mục tiêu
Bạn bè clone repo về thấy gọn, dễ hiểu, chạy được ngay. Repo không chứa file rác hay thông tin máy cá nhân.

## Việc
1. **`.gitignore` (gốc):** bổ sung các mục còn thiếu, giữ nguyên các mục cũ:
   - `.npm-cache/`, `coverage/`, `*.tsbuildinfo`;
   - `test-results/`, `playwright-report/`;
   - `.DS_Store`, `Thumbs.db`, `*.swp`, `.idea/`;
   - `**/.data/`;
   - `scripts/.ten-tam*.mjs`, `scripts/.*.mjs` (probe tạm).
   Giữ track: `.vscode/` (nếu có cấu hình dùng chung), `base.code-workspace`.
2. **Bỏ track file sinh ra:** chạy `git ls-files` để tìm file build/test bị commit nhầm (`dist/`, `*.tsbuildinfo`, `.data/`, ảnh screenshot, log, `.npm-cache`…). Bỏ track bằng `git rm --cached` (không xoá khỏi đĩa) và liệt kê trong báo cáo.
3. **Đường dẫn tuyệt đối → tương đối:** trong các file sau, thay `D:\CustomAOV\...`, `D:/CustomAOV/...`, `C:\Users\...` bằng đường dẫn tương đối tính từ gốc repo, hoặc mô tả chung. Chỉ đổi đường dẫn, giữ nguyên nội dung khác.
   - `docs/orchestration/ORCHESTRATION.md`
   - `docs/orchestration/DECISIONS.md`
   - `packages/team-core/HANDOFF.md`
   - `packages/team-core/PROGRESS.md`
   - `base-frontend-web/docs/PROGRESS.md`
   - `base-frontend-web/docs/SCREENS.md`
   Kiểm lại toàn repo: `git grep -nE "D:[/\\\\]CustomAOV|C:[/\\\\]Users"` phải rỗng.
4. **`CONTRIBUTING.md` (gốc, tiếng Việt, ngắn)**:
   - cấu trúc repo (trỏ `README.md`);
   - quy trình nhánh: `main` được bảo vệ; mỗi việc một nhánh `feat/…`, `fix/…`; mở Pull Request; cần 1 review và CI xanh mới merge;
   - lệnh kiểm tra trước khi mở PR: `npm run build && npm run lint && npm test`; với thay đổi UI thêm e2e và screenshot (theo README);
   - quy tắc code/UI: trỏ `AGENTS.md` (token, 1 nút vàng/khung nhìn…) và `base-backend-api/AGENTS.md`;
   - hợp đồng API: sửa `docs/product/API.md` và `packages/contracts` trước, rồi mới sửa code;
   - migration DB: dùng `drizzle-kit generate`, không sửa tay migration đã merge;
   - không commit `.env` hay secret;
   - tài liệu `docs/dac-ta`, `design-api`, `nghiep-vu`, `tich-hop`, `hdsd`, `json`, `pdf` và `HUONG-DAN-AP-DUNG.md` chỉ là **mẫu trình bày**;
   - `AGENTS.md`, `CLAUDE.md`, `docs/orchestration/` dành cho AI agent; người có thể bỏ qua.
5. **CI:** tạo `.github/workflows/ci.yml` chạy trên `pull_request` và `push` vào `main`:
   - Node 22, `npm ci`, `npm run build`, `npm run lint`, `npm test`;
   - cache npm qua `actions/setup-node` (`cache: npm`);
   - **không** chạy e2e/Playwright trong CI (cần server);
   - không thêm thư viện.
6. **README.md:** thêm 1 mục ngắn "Đóng góp" trỏ tới `CONTRIBUTING.md`. Không sửa phần khác.

## Không được
- Xoá tài liệu hay mã nguồn.
- Đổi code sản phẩm.
- Thêm thư viện.
- Sửa `_old_web_DO_NOT_EDIT/`, `web_backup_*/`.
- Push.

## Verify
- `npm ci && npm run build && npm run lint && npm test` ở gốc (exit 0).
- `git grep` đường dẫn tuyệt đối trả về rỗng.
- `git status` sạch sau khi commit.

Commit, rồi `orca orchestration send --type worker_done --outcome succeeded|failed`. Báo cáo kèm danh sách file đã bỏ track và file đã sửa.
