# MORNING REPORT – customAOV

> Lead cập nhật cuối mỗi epic và mỗi khi dừng. Mới nhất ở trên.

## 15/11/2026 ~10:00 – E2 xong và đã merge `main`; E3 đang chạy

**Epic E2 (nền backend): XONG, đã merge `main`** (`35b74ed`; tag `epic-2-before` = `ef16a9a`).

| Task | Nội dung | Coder | Review |
|---|---|---|---|
| E2-T01 | API.md + mục 9 bổ sung bảo mật/đồng thời | Lead | cross-review agy |
| E2-T02 | Fastify 5 scaffold | codex | agy |
| E2-T03 | `@customaov/contracts` (86 test) | codex | agy |
| E2-T04 | Drizzle + PGlite + migration + seed khớp mock | agy hydrogen | codex FAIL lần 1 (thiếu CHECK, log lộ DATABASE_URL) → sửa → PASS |
| E2-T05 | script gốc | agy flash | Lead |
| E2-T06 | rule backend viết lại theo stack thật | agy flash | Lead FAIL lần 1 (lệch API.md §9) → sửa → PASS |

Kiểm tra trước merge: build, lint 0 lỗi, test 15+86+33+17, e2e-auth, screenshot 32/32, API `/health` OK.

**E3 đang chạy:** T01 auth API (agy sonnet), T01b schema/contracts theo §9 (agy hydrogen), T02 tầng dữ liệu FE (codex).

**Quyết định mới:**
- Lead tự review task B1 nhỏ của coder khác hãng.
- Đổi schema theo API.md §9 (cột `active`, partial unique index, `is_bye`): làm ở E3-T01b.
- Codex sắp cạn hạn mức 5 giờ nên chuyển task B2 sang agy claude-sonnet.

**Sự cố nhỏ:**
- Lead dùng lệnh tắt process node quá rộng (`pkill`/`taskkill`) để tắt server smoke test. Đã kiểm: chỉ tắt dev server của chính Lead, server 5174 (PID 37208) và các worker vẫn chạy. Đã ghi chú để không lặp lại.

**Quota ước tính:** Codex còn ~21% (reset 12:19). agy dùng nhiều nhưng chưa báo giới hạn. Copilot 0/20.

## 15/11/2026 ~09:00 – E1 xong và đã merge `main`; E2 đang chạy

**Epic**
- **E1 (rà soát 8 route + sửa P0): XONG, đã merge `main`** (`ef16a9a`; tag `epic-1-before` để quay lại).
  - Audit (agy hydrogen-medium): 1 P0, 5 P1, 4 P2.
  - Đã sửa P0 (lệch số người phòng AOV-1025/1027) và 3 P1 giao diện @375 (agy claude-sonnet; review PASS bởi codex).
  - 2 P1 dữ liệu + 4 P2 để backlog.
- **E2 (nền backend):** T01 thiết kế API, T02 scaffold Fastify, T03 contracts zod đã merge vào `integration/mvp`. T04 (DB Drizzle + PGlite + seed) đang review. T05, T06 đang chạy.

**Đã merge vào `main`:** `05de009` (docs điều phối, theo lệnh Owner) và `ef16a9a` (epic E1, kèm E2-T01/T02 đã review).
Kiểm tra trước merge: build, lint (0 lỗi), test (33 web + 15 team-core + 5 api), e2e-auth, screenshot 32/32.

**Quyết định Lead tự đưa ra** (chi tiết ở `DECISIONS.md`):
- Worktree đặt trong `.worktrees/` (không ghi ngoài repo).
- Codex chạy không sandbox: sandbox chặn git commit và Orca. Phạm vi ghi kiểm bằng review `git diff --stat`.
- E1 gộp P0 + P1 vào một task.
- API.md bổ sung mục 9 theo review chéo:
  - phòng private trả bản giới hạn;
  - CSRF ký HMAC gắn phiên;
  - rate limit theo IP+username;
  - partial unique index (đổi schema);
  - bye/TBD trong nhánh.
- Lead dùng cổng 5190 để verify (5174 bị process khác giữ).

**Lỗi / vướng chưa giải quyết**
- "Continue automatically when limits reset": orca CLI không có lệnh bật. **Owner cần bật tay trong Orca nếu muốn.**
- Orca đôi khi kẹt trạng thái "trust workspace" khi mở agy. Đã có cách xử lý (mở lại terminal).
- Codex hỏi cập nhật 0.163 → 0.169 mỗi lần khởi động; Lead chọn Skip (không tự cài).
- Cổng 5174 đang bị một process (PID 37208) giữ; không rõ của ai, Lead không đụng tới.

**Quota ước tính đã dùng**
- Codex gpt-5.6-sol: 4 phiên (2 code, 1 review, 1 review đang chạy).
- agy: hydrogen-medium 4 phiên; claude-sonnet 1; flash 2 đang chạy.
- Claude (Lead): đáng kể (một phiên dài).
- Copilot: 0/20.

**Owner cần làm khi quay lại:** bật "Continue automatically when limits reset" nếu muốn; xem tag `epic-1-before` nếu cần quay lại.
