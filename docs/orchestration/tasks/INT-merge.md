# INT – Codex làm integrator: merge nhánh task đã PASS review vào `integration/mvp`

- Worker: Codex `gpt-5.6-sol` · Worktree `.worktrees/integration` (đang checkout `integration/mvp`). **Chỉ** làm trong worktree này.
- Lead gửi danh sách nhánh cần merge qua thư. Lần đầu: **`task/E4-T04-fe-rooms`** (review PASS).

## Mỗi nhánh làm đúng quy trình
1. `git merge --no-ff <nhánh> -m "Merge <nhánh> (review PASS: <reviewer>)"`.
2. Nếu xung đột thì gộp sao cho **giữ chức năng của cả hai phía**:
   - `base-backend-api/src/app.ts`: giữ mọi dòng import và `register…Routes`;
   - `docs/ui-refactor/CHANGELOG-UI.md`: giữ mọi mục, ngăn bằng `---`;
   - `base-frontend-web/src/api/*` (types/hooks/map/http/mock/index): hợp nhất các hàm/kiểu của cả hai nhánh, không xoá của bên nào;
   - test: **không** xoá hay nới assertion. Nếu test vỡ do kết hợp hai nhánh (ví dụ mock fetch theo thứ tự) thì sửa phần dựng test cho đúng, giữ nguyên assertion, ghi lý do trong commit.
3. Ở gốc chạy `npm install && npm run build && npm run lint && npm test` (lint 0 lỗi, đúng 2 cảnh báo cũ). Test backend đã chạy tuần tự (`fileParallelism:false`).
4. Xanh thì commit merge, ghi rõ các chỗ đã gộp tay. Không xanh mà không tự sửa được trong phạm vi gộp thì `git merge --abort` và báo lại.
- **Không** push, không merge vào `main`, không sửa nhánh task.

## Báo cáo
Sau mỗi đợt gửi `orca orchestration send --type worker_done --outcome succeeded|failed`, kèm hash commit merge của từng nhánh và kết quả build/lint/test. Lead có thể gửi thêm nhánh bằng thư tiếp nối.
