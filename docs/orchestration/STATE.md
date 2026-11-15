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
| E3-T01 sửa rate limit (review FAIL lần 1) | task_64c77fc6fb5a | ctx_a58c9ebedd1c | coder | agy **Gemini 3.8 Flash high** (Orca mở lại bằng model mặc định) | term_817c10cc3f13e08d8614321f30be4c7f | 6181 |
| E3-T02 review | task_bd8b8be5ab35 | ctx_240269d4c2a9 | reviewer | agy gemini-4-hydrogen-medium (thay SN do hết quota) | term_1cb25d5d-44dc-4501-aad2-fe991b5b6d04 | 5182 |
| E5-T04a bracket engine | task_fa48606ed753 | ctx_cf323c57c23e | coder | agy gemini-4-hydrogen-high (thay OP do hết quota) | term_15407b4a-9b0b-4cbd-a39d-6d2f20f7e6b3 | – |

Đã merge vào integration: **E3-T01b** (`47b0d34`). E3-T02 code xong (`c226e32`), đang review.

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
| codex gpt-5.6-sol | 09:00 | Còn ~21% hạn mức 5 giờ. Chỉ dùng cho review quan trọng trước 12:19. | 12:19 |
| agy claude-sonnet-5-5 / claude-opus-5-5 | 09:05 | "Individual quota reached", reset sau ~3h15m | ~12:20 |

Nguồn còn dùng được tới ~12:20:
- coder: agy Gemini (flash / hydrogen-medium / hydrogen-high);
- reviewer cho code Gemini (phải khác Google): Lead (Claude) cho task nhỏ/vừa, Codex cho review quan trọng (quota thấp), Copilot (≤20 lượt) dự phòng cuối.

Giờ trong file này lấy theo đồng hồ máy (`date`).

## Ghi chú vận hành
- Prompt khởi động: agy hỏi tin thư mục → Enter (Orca có thể kẹt `agent-trust-workspace` → đóng và mở lại terminal); Codex hỏi update → "2" Skip; Codex hỏi hooks → "2" Trust.
- **Đừng dùng `taskkill /IM node.exe`** để tắt server. Tắt bằng TaskStop của chính lệnh nền hoặc theo PID.
- Cổng 5174 đang bị PID 37208 (không phải Lead) giữ.
