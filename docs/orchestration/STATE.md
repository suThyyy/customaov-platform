# STATE – cập nhật 2026-11-15 ~10:00 bởi claude

> Khung và quy tắc: `ORCHESTRATION.md` mục 6. Chỉ Lead hiện tại ghi file này, commit lên `orch/lead`.

- Giai đoạn: **Roadmap – E3** (E1, E2 đã merge `main`)
- Run id: **`run_0ed5066ec040`**
- Lead hiện tại: **claude** (`claude-opus-5-5`) · session `orca_session_id:claude_b751cb81_b646_4942_8df5_07b9de54bd8c`
- Checkout:
  - Lead: gốc `base-workspace` (nhánh `orch/lead`);
  - `.worktrees/integration` (`integration/mvp`): merge task + verify, dev server Lead **5190**, API **6190**;
  - `.worktrees/main` (`main`): merge epic.
- `main` = `35b74ed` · tag `epic-1-before` = `05de009`, `epic-2-before` = `ef16a9a`
- `integration/mvp` = `d252038`

## Lệnh tiếp quản Lead (Owner tự chạy khi cần)

Điều kiện: ORCHESTRATION.md mục 7.2. Mở terminal ở thư mục gốc `base-workspace`:

```bash
orca agent launch --agent codex --model gpt-5.6-sol --effort medium --focus --prompt "Bạn là Lead dự phòng của customAOV, tiếp quản vì Lead Claude đã dừng. Làm đúng docs/orchestration/ORCHESTRATION.md mục 7.2: đọc AGENTS.md, docs/orchestration/ORCHESTRATION.md, docs/orchestration/STATE.md, docs/orchestration/DECISIONS.md, docs/product/ROADMAP.md, docs/product/API.md; chạy 'orca skills get orchestration --full'; chạy 'orca orchestration run-use --id run_0ed5066ec040'; đối chiếu run-show, worker-list, task-list, inbox; ghi 'Lead hiện tại: codex' vào STATE.md và commit lên orch/lead; rồi 'orca orchestration check' và điều phối tiếp. Giữ hàng rào cứng trong DECISIONS.md."
```

Lưu ý: lúc 10:00 Codex còn ~21% hạn mức 5 giờ (reset 12:19).

## Đang chạy
| Task | Task id | Dispatch | Vai trò | Agent/model | Terminal | Cổng |
|---|---|---|---|---|---|---|
| E3-T02 FE data layer | task_ccd564ea28a6 | ctx_37f9c25b45da | coder | codex gpt-5.6-sol | term_4ce16436-57d4-4cfe-a9dc-67d899aa7156 | 5180 |
| E3-T01 auth API | task_ee5be6bbd586 | ctx_9b36bd9144d6 | coder | agy claude-sonnet-5-5-medium | term_170763e0-c832-453f-8a6a-2baa8a54c241 | 6181 |
| E3-T01b API.md §9 → schema/contracts | task_7a92edac3799 | ctx_f48cec6c8eb9 | coder | agy gemini-4-hydrogen-medium | term_c7fdd96e-72db-45e8-a15f-d917c37d9569 | – |

## Tiếp theo (DAG)
| Task | Phụ thuộc | Coder dự kiến → reviewer |
|---|---|---|
| E3-T03 nối auth FE | E3-T01, E3-T02 | SN → HM (Codex còn ít quota) |
| E3-T04 API hồ sơ | E3-T01, E3-T01b | CX nếu đã reset, nếu không thì SN → HM |
| E3-T05 nối hồ sơ FE | E3-T02, E3-T04 | SN → CX/HM |
| E4-T01 API phòng | E3-T01, E3-T01b | CX → HM |
| E5-T01 API giải (đọc) | E3-T01, E3-T01b | CX → HM |

Reviewer cho E3-T02 (Codex): agy claude-sonnet (SN). E3-T01 (SN) → HM. E3-T01b (HM) → SN.

## Đếm Copilot
0/20 lượt.

## Model tạm ngưng / sắp cạn
| Agent/model | Từ lúc | Lý do | Thử lại sau |
|---|---|---|---|
| codex gpt-5.6-sol | 10:00 | Còn ~21% hạn mức 5 giờ. Không giao task mới cho Codex trước 12:19, trừ E3-T02 đang chạy. | 12:19 |

## Ghi chú vận hành
- Prompt khởi động: agy hỏi tin thư mục → Enter (Orca có thể kẹt `agent-trust-workspace` → đóng và mở lại terminal); Codex hỏi update → "2" Skip; Codex hỏi hooks → "2" Trust.
- **Đừng dùng `taskkill /IM node.exe`** để tắt server. Tắt bằng TaskStop của chính lệnh nền hoặc theo PID.
- Cổng 5174 đang bị PID 37208 (không phải Lead) giữ.
