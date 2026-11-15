# STATE – cập nhật 2026-11-15 08:00 bởi claude

> Khung và quy tắc: `docs/orchestration/ORCHESTRATION.md` mục 6. Chỉ Lead hiện tại ghi file này, commit lên nhánh `orch/lead`.

- Giai đoạn: **Chờ Owner duyệt PRD + ROADMAP** (lần dừng duy nhất trước khi code)
- Run id: **`run_0ed5066ec040`** (objective: "customAOV MVP – roadmap theo docs/product/ROADMAP.md")
- Lead hiện tại: **claude** (`claude-opus-5-5`) · session: `orca_session_id:claude_b751cb81_b646_4942_8df5_07b9de54bd8c`
- Checkout Lead: thư mục gốc `base-workspace`, nhánh `orch/lead`
- Nhánh tích hợp: `integration/mvp` (rẽ từ `main` @ `05de009`)

## Lệnh tiếp quản Lead (Owner tự chạy khi cần)

Điều kiện: ORCHESTRATION.md mục 7.2 (Lead không phản hồi quá 15 phút **và** dòng trên ghi `Lead hiện tại: claude`). Mở terminal ở thư mục gốc `base-workspace`, chạy đúng lệnh sau:

```bash
orca agent launch --agent codex --model gpt-5.6-sol --effort medium --focus --prompt "Bạn là Lead dự phòng của customAOV, tiếp quản vì Lead Claude đã dừng. Làm đúng docs/orchestration/ORCHESTRATION.md mục 7.2: đọc AGENTS.md, docs/orchestration/ORCHESTRATION.md, docs/orchestration/STATE.md, docs/product/ROADMAP.md; chạy 'orca skills get orchestration --full'; chạy 'orca orchestration run-use --id run_0ed5066ec040'; đối chiếu run-show, worker-list, task-list, inbox; ghi 'Lead hiện tại: codex' vào STATE.md và commit lên orch/lead; rồi 'orca orchestration check' và điều phối tiếp. Giữ mọi điểm dừng ở mục 8."
```

Muốn trả quyền cho Claude: báo Codex ghi "đang bàn giao cho claude" rồi dừng. Sau đó trong phiên Claude chạy `orca orchestration run-use --id run_0ed5066ec040`.

## Đang chạy
| Task | Task id Orca | Dispatch | Vai trò | Agent/model | Terminal | Cổng | Bắt đầu |
|---|---|---|---|---|---|---|---|
| E1-T02 review | task_67dab5e10356 | ctx_9c3a86723815 | reviewer | codex gpt-5.6-sol medium (sandbox cũ: không tự commit/báo được) | term_a85e7270-364f-4c96-9eb2-d1f8b46457e5 | 5175 | 15/11 |
| E2-T03 contracts | task_df036da6268b | ctx_0b058a392f07 | coder | codex gpt-5.6-sol medium (sandbox cũ: Lead commit thay) | term_8496bbf3-4ca1-4a51-aa61-e01436af0e3d | 5177 | 15/11 |
| E2-T04 DB | task_b88e0a5ef19c | ctx_3a4df9061d91 (retry của ctx_937145fefa55) | coder | agy gemini-4-hydrogen-medium | term_f7858633-d0f9-4a6c-9c85-1d1478450f7c | 6178 | 15/11 |

**Đã xong**
- E1-T01 audit: báo cáo đã merge.
- E1-T02 code: commit `b127f4e`, chờ review.
- E2-T01: Lead làm, `API.md` đã merge.
- E2-T02: review PASS (agy hydrogen-medium), đã merge vào integration/mvp `0669d40`.

**Ghi chú vận hành**
- Lần dispatch đầu của E2-T04 thất bại: Orca kẹt ở trạng thái `agent-trust-workspace` dù agy đã sẵn sàng. Lead đóng terminal, mở terminal mới (thư mục đã được tin nên không hỏi lại) rồi `--retry-of` (lần 2/3 của chuỗi).

## Chờ
| Task | Phụ thuộc | Lý do chờ |
|---|---|---|
| E1-T05 hồi quy E1 + merge main | E1-T02 review | |
| E2-T05 script gốc, E2-T06 rule backend | E2-T03 | Đợi slot trống (tối đa 3 worker) |
| Review E2-T01 (API.md) | – | Gộp vào review E2-T03 (đối chiếu contracts với API.md) |
| E3+ | xem ROADMAP | |

## Gate đang mở
Không có (Owner trao toàn quyền 15/11).

## Đếm Copilot
0/20 lượt.

## Quyết định gần nhất
- 15/11 Owner duyệt PRD + ROADMAP và trao toàn quyền. Worktree đặt trong `.worktrees/`. Mọi worker launch qua terminal kèm cờ tự duyệt (xem DECISIONS.md).
- 08:00 Soạn PRD + ROADMAP trên `orch/lead`; dừng chờ duyệt.
- 07:55 Tạo Run `run_0ed5066ec040`.
- 07:50 Merge `task/T00-orchestration-docs` → `main` (`05de009`) theo lệnh Owner; tạo `integration/mvp`, `orch/lead`.
- 07:45 Chụp bộ `baseline` 32 ảnh (8 route × 4 khổ, đều ok); e2e-auth đạt.
- 07:40 Copilot CLI: đăng nhập `suThyyy`, chỉ `--model auto` (→ GPT-5.6 Luna); id cụ thể đều "not available".
- 07:35 `gpt-5.6-sol` tồn tại, probe medium OK; `-c service_tier=default` được chấp nhận.
- 07:35 Gemini CLI chưa cài → bỏ qua. OpenCode bỏ theo lệnh Owner.

## Model tạm ngưng
| Agent/model | Từ lúc | Lý do | Thử lại sau |
|---|---|---|---|
| – | | | |

## Cần xác minh ở task đầu tiên
- Worker Codex/Copilot chạy qua `orca terminal create` + `worker-start --terminal` có nhận preamble và gửi `worker_done` không (ORCHESTRATION.md mục 4.3).
- `check --peek --terminal <lead>` từ terminal khác, và thư chuyển về Codex sau `run-use` (mục 7.2).
