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
| E1-T01 audit | task_5bc8b77ac2bb | ctx_06ba749985ad | audit | agy gemini-4-hydrogen-medium | term_c0e1d281-0343-4f86-89b2-acdc2e85980d | 5175 | 15/11 |
| E2-T02 backend scaffold | task_d9771f1c3922 | ctx_c61acecefa03 | coder | codex gpt-5.6-sol medium | term_7aebd674-4c89-4b96-a7ed-a252d874ed4b | 5176/6176 | 15/11 |
| E2-T03 contracts | task_df036da6268b | ctx_0b058a392f07 | coder | codex gpt-5.6-sol medium | term_8496bbf3-4ca1-4a51-aa61-e01436af0e3d | 5177 | 15/11 |

E2-T01 (Lead): **xong**, `docs/product/API.md` đã merge vào integration/mvp (`7e65016`). Review chéo (CX) xếp sau E2-T02. Ghi chú: sandbox Codex chặn cache npm ngoài worktree; đã báo worker đặt `npm_config_cache` trong worktree. Codex hỏi cập nhật 0.169 lúc khởi động → chọn Skip (không cài gì).

## Chờ
| Task | Phụ thuộc | Lý do chờ |
|---|---|---|
| E1-T02..T05 | E1-T01 | Lead tạo sau khi có báo cáo audit |
| E2-T03, E2-T04 | E2-T01 (+E2-T02) | |
| E2-T05, E2-T06 | E2-T02 | |
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
