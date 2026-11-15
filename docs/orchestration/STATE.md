# STATE – cập nhật 2026-11-15 ~09:00 bởi claude

> Khung và quy tắc: `ORCHESTRATION.md` mục 6. Chỉ Lead hiện tại ghi file này, commit lên `orch/lead`.

- Giai đoạn: **Roadmap – E2** (E1 đã merge vào main)
- Run id: **`run_0ed5066ec040`**
- Lead hiện tại: **claude** (`claude-opus-5-5`) · session `orca_session_id:claude_b751cb81_b646_4942_8df5_07b9de54bd8c`
- Checkout Lead: gốc `base-workspace` (nhánh `orch/lead`)
  - `.worktrees/integration`: checkout `integration/mvp`, dùng để merge task và verify (dev server Lead ở **5190**);
  - `.worktrees/main`: checkout `main`, dùng để merge epic.
- `integration/mvp` = `f7b8c7b` · `main` = `ef16a9a` (tag `epic-1-before` = `05de009`)

## Lệnh tiếp quản Lead (Owner tự chạy khi cần)

Điều kiện: ORCHESTRATION.md mục 7.2. Mở terminal ở thư mục gốc `base-workspace`:

```bash
orca agent launch --agent codex --model gpt-5.6-sol --effort medium --focus --prompt "Bạn là Lead dự phòng của customAOV, tiếp quản vì Lead Claude đã dừng. Làm đúng docs/orchestration/ORCHESTRATION.md mục 7.2: đọc AGENTS.md, docs/orchestration/ORCHESTRATION.md, docs/orchestration/STATE.md, docs/orchestration/DECISIONS.md, docs/product/ROADMAP.md, docs/product/API.md; chạy 'orca skills get orchestration --full'; chạy 'orca orchestration run-use --id run_0ed5066ec040'; đối chiếu run-show, worker-list, task-list, inbox; ghi 'Lead hiện tại: codex' vào STATE.md và commit lên orch/lead; rồi 'orca orchestration check' và điều phối tiếp. Giữ hàng rào cứng trong DECISIONS.md."
```

Trả quyền cho Claude: Codex ghi "đang bàn giao cho claude" rồi dừng; sau đó phiên Claude chạy `orca orchestration run-use --id run_0ed5066ec040`.

## Đang chạy
| Task | Task id | Dispatch | Vai trò | Agent/model | Terminal | Cổng |
|---|---|---|---|---|---|---|
| E2-T04 review | task_9128d6468f41 | ctx_98e9521f8018 | reviewer | codex gpt-5.6-sol (bypass sandbox) | term_45ad91c6-ddfc-43c3-9e7b-7c702e73d815 | – |
| E2-T05 root scripts | task_3cc192b04101 | ctx_83140d23dde2 | coder | agy gemini-3.8-flash-medium | term_a478a1b1-f0a7-44e6-a060-a18ac55a423c | 5179 |
| E2-T06 backend rules | task_8ced1acbfc16 | ctx_329054c8ec9d | coder | agy gemini-3.8-flash-medium | term_638bbf80-d4de-4862-b391-5a98f3db753d | – |

## Xong
- **E1:** T01 audit, T02 sửa P0 + 3 P1 (review PASS codex). **Đã merge main.** E1-T03/T04 bỏ. E1-T05 do Lead làm khi merge epic.
- **E2-T01** API.md (Lead). Review chéo trong E2-T03 review → bổ sung **mục 9**.
- **E2-T02** backend scaffold (codex; review PASS agy).
- **E2-T03** contracts (codex; review PASS agy).
- **E2-T04** DB (agy hydrogen, `bbf8bea`): đang review.

## Chờ / tiếp theo
| Task | Phụ thuộc | Ghi chú |
|---|---|---|
| Merge E2-T04, T05, T06 → integration | review | E2-T05 và E2-T06 cần review CX sau khi xong |
| Merge epic E2 → main | E2-T04..T06 | |
| E3-T01 auth API (+ contracts/schema theo API.md mục 9) | E2 | CX |
| E3-T02 FE data layer | E2-T03 | CX/SN |
| E3-T04 profile API | E3-T01 | CX |

## Đếm Copilot
0/20 lượt.

## Model tạm ngưng
| Agent/model | Từ lúc | Lý do | Thử lại sau |
|---|---|---|---|
| – | | | |

## Ghi chú vận hành
- Worker Codex khởi động trước 08:30 (sandbox workspace-write) không commit/báo được. Lead đã commit thay (E2-T02 `2fcff38`, E2-T03 `89d142e`). Từ E2-T04 review: bypass sandbox.
- Orca đôi khi kẹt `agent-trust-workspace` với agy. Cách xử lý: đóng terminal, mở lại (thư mục đã được tin), dùng `--retry-of` nếu dispatch đã fail.
- Prompt khởi động: agy hỏi tin thư mục → Enter; Codex hỏi update → "2" Skip; Codex hỏi hooks → "2" Trust.
