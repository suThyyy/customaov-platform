# STATE – cập nhật 2026-11-15 ~11:10 bởi claude — **TẠM DỪNG (Owner tắt máy)**

> Khung và quy tắc: `ORCHESTRATION.md` mục 6. Chỉ Lead hiện tại ghi file này, commit lên `orch/lead`.

- Giai đoạn: **Roadmap – E3/E4/E5 song song.** E1 và E2 đã merge `main`.
- Run id: **`run_0ed5066ec040`** (Orca giữ Run này; khi quay lại dùng tiếp, **không** tạo Run mới).
- Lead hiện tại: **claude** · Không có worker nào đang chạy.
- Checkout:
  - Lead: gốc `base-workspace` (nhánh `orch/lead`);
  - `.worktrees/integration` (`integration/mvp`): merge task + verify. Lead dùng cổng **5190** (web) / **6190** (api);
  - `.worktrees/main` (`main`): merge epic.
- `main` = `35b74ed` · tag `epic-1-before` = `05de009`, `epic-2-before` = `ef16a9a`
- `integration/mvp` = `feb6990`

## Việc đầu tiên khi quay lại (theo thứ tự)
1. **Verify integration**: E5-T01 đã merge (`feb6990`) nhưng **chưa chạy lại build/lint/test sau merge**. Lần merge có xung đột 1 dòng ở `app.ts`, Lead đã gộp tay. Chạy trong `.worktrees/integration`: `npm install && npm run build && npm run lint && npm test`.
2. Probe quota (ORCHESTRATION.md mục 2). Codex và agy Claude đã reset sau ~12:20 ngày 15/11.
3. **Làm tiếp 2 task đang dở.** WIP đã commit, chưa verify; Orca task để `blocked`:
   - **E3-T03 FE auth**: `task_285790b05819`, nhánh `task/E3-T03-fe-auth`, WIP `eccf855`, spec `tasks/E3-T03.md`. Dispatch cũ `ctx_0ace6070d612` đã abandon.
   - **E4-T02 room host API**: `task_89e34bd74fb7`, nhánh `task/E4-T02-room-host-api`, WIP `373fba3`, spec `tasks/E4-T02.md`. Dispatch cũ `ctx_f13ec7214a9d` đã abandon.
   - Cách giao lại:
     ```bash
     orca orchestration task-update --id <task> --status ready
     # tạo terminal theo ORCHESTRATION.md 4.3, rồi
     orca orchestration worker-start --task <task> --terminal <handle> --worktree path:D:/CustomAOV/base-workspace/.worktrees/<dir>
     ```
     Thư đầu cho worker: "Có WIP commit trên nhánh, đọc `git log`/`git diff integration/mvp...HEAD`, làm tiếp, chạy lệnh verify trong spec."
     Không dùng `--retry-of`, vì mỗi chuỗi đã dùng 2/3 lượt start.
4. Chưa giao:
   - **E3-T05** (nối hồ sơ FE; deps E3-T02, E3-T04 đã xong);
   - **E4-T03** (realtime WS; deps E4-T01, E4-T02);
   - **E5-T03** (đăng ký đội; deps E5-T01, E3-T03).
   E3 xong (T03 + T05) thì merge epic E3 → `main` (tag `epic-3-before`).

## Lệnh tiếp quản Lead (Owner tự chạy khi cần)

```bash
orca agent launch --agent codex --model gpt-5.6-sol --effort medium --focus --prompt "Bạn là Lead dự phòng của customAOV, tiếp quản vì Lead Claude đã dừng. Làm đúng docs/orchestration/ORCHESTRATION.md mục 7.2: đọc AGENTS.md, docs/orchestration/ORCHESTRATION.md, docs/orchestration/STATE.md, docs/orchestration/DECISIONS.md, docs/product/ROADMAP.md, docs/product/API.md; chạy 'orca skills get orchestration --full'; chạy 'orca orchestration run-use --id run_0ed5066ec040'; đối chiếu run-show, worker-list, task-list, inbox; ghi 'Lead hiện tại: codex' vào STATE.md và commit lên orch/lead; rồi làm theo mục 'Việc đầu tiên khi quay lại' trong STATE.md. Giữ hàng rào cứng trong DECISIONS.md."
```

## Trạng thái task
| Task | Trạng thái | Ghi chú |
|---|---|---|
| E1 (T01, T02) | **merged main** | |
| E2 (T01–T06) | **merged main** | |
| E3-T01 auth API | merged integration | review lần 1 FAIL (rate-limit key) → sửa → Lead PASS |
| E3-T01b schema §9 | merged integration | migration 0002 |
| E3-T02 FE data layer | merged integration | + Lead sửa nối `map.ts` (`800948a`) |
| E3-T03 FE auth | **WIP `eccf855`** | dừng giữa chừng |
| E3-T04 profile API | merged integration | |
| E3-T05 FE profile | chưa giao | |
| E4-T01 rooms API | merged integration | |
| E4-T02 room host API | **WIP `373fba3`** | dừng giữa chừng |
| E4-T03..T06 | chưa giao | |
| E5-T01 tournaments read API | merged integration (`feb6990`), **chưa verify sau merge** | |
| E5-T02a UI /tournaments/new | merged integration | phần nối API (E5-T02 còn lại) chưa làm |
| E5-T04a bracket engine | merged integration | |
| E5-T02 (API tạo giải), T03..T06, E6, E7 | chưa giao | |

## Đếm Copilot
0/20 lượt.

## Model tạm ngưng
| Agent/model | Từ lúc | Lý do | Thử lại sau |
|---|---|---|---|
| codex gpt-5.6-sol | 10:40 | Hết hạn mức | 12:19 ngày 15/11 (đã qua khi quay lại) |
| agy claude-sonnet / claude-opus | 09:05 | "Individual quota reached" | ~12:20 ngày 15/11 |

## Ghi chú vận hành
- Prompt khởi động:
  - agy hỏi tin thư mục → Enter. Orca có thể kẹt `agent-trust-workspace` → đóng và mở lại terminal.
  - Codex hỏi update → "2" Skip. Codex hỏi hooks → "2" Trust.
- agy hay hiện banner "esc to dismiss": gửi Esc trước `worker-start`. Sau khi start, nếu ô nhập còn "[Pasted text …]" thì gửi Enter.
- Khi Orca tự mở lại worker (`send` sau khi đã đóng terminal), agy chạy model mặc định và không có cờ tự duyệt. Đừng đóng terminal coder trước khi review xong.
- Xung đột `app.ts` khi merge các task backend song song là bình thường: mỗi task thêm 1 dòng `register…Routes`, giữ tất cả.
- **Đừng dùng `taskkill /IM node.exe`**. Tắt server bằng TaskStop hoặc theo PID. Kiểm tra cổng 5190 không còn vite cũ.
- Cổng 5174 bị PID 37208 (không phải Lead) giữ trong phiên 15/11.
