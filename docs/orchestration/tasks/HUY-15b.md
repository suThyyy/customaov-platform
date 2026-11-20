# HUY-15b – Giao diện thao tác Open Room (Linear HUY-15, phần 2/3)

- Coder: agy `gemini-4-hydrogen-medium` · Reviewer: Codex (khác hãng) · Kiểm chứng thật: Lead (HUY-15c)
- Nhánh `feat/huy-15-room-mutations` (tiếp tục sau commit `3d77a78` của HUY-15a) · Worktree `.worktrees/HUY-15-room`
- Cổng dev: 5199 (`npm run dev -- --port 5199 --strictPort` trong `base-frontend-web`). Không dùng 5173/5174/5180/5181/5182.

## Bước 0 – Graphify (bắt buộc, trước khi đọc code)
```bash
graphify update . --no-cluster && graphify cluster-only . --no-label --no-viz
graphify query "SupabaseRoomView useOpenRoom useOpenRoomActions openRoomPermissions" --budget 1500
```
Trước khi grep hay đọc rộng, dùng `graphify query/path/explain`. **Không** chạy `extract` hay `label` (2 lệnh này gọi LLM). Không commit `graphify-out/`.

## ⚠ Hàng rào
- **KHÔNG gọi mạng tới Supabase.** Không tạo/đọc `.env.local`. Test dùng mock hook/adapter. Lead sẽ tự thử trên Production.
- Không sửa `src/api/supabase/roomMutations.ts` hay `roomActions.ts`. Nếu thiếu API, ghi vào báo cáo; Lead sẽ quyết.
- Không đọc/ghi ngoài `D:\CustomAOV\base-workspace`. Không push.
- Đọc `AGENTS.md` (mục Thiết kế, bẫy đã gặp). Giữ nháy đơn, không chấm phẩy, không format lại cả file, không comment code cũ.

## Có sẵn (HUY-14 + HUY-15a)
- `useOpenRoom(roomId)` trả `{snapshot,status,connection,retry}` (realtime).
- `useOpenRoomActions(roomId, snapshot)` trả các action:
  - `close`, `leave`, `addPlayer(name)`, `kick(memberId)`, `requeue(memberId)`;
  - `continueQueue`, `prepare`, `saveLineup(players)`, `replace(memberId)`, `start`, `end`;
  - `pending` theo từng action.

  Mỗi action trả `{ok,data}|{ok:false,error}`; `error.message` là tiếng Việt, hiện được ngay.
- `openRoomPermissions(snapshot, userId)`: cờ cho từng action, theo vai trò × pha (`idle → preparing → active → ended`).
- `joinOpenRoom(inviteCode, displayName)`, `createOpenRoom()`, `swapLineupPlayers(lineup,a,b)`.
- `SupabaseRoomView.tsx` hiện chỉ đọc (Waiting/Selected). Chỉ hiện khi `VITE_DATA_SOURCE=supabase` (roomView của adapter).
- Hợp đồng: `docs/product/SUPABASE_CONTRACTS.md` (mục "RPC ghi").

## Việc (chỉ ở chế độ supabase; mock/api giữ nguyên)
1. **Tạo phòng:** ở chế độ supabase, `/rooms/new` hiện một thẻ đơn giản "Tạo phòng mở" (nút vàng duy nhất). Bấm gọi `createOpenRoom()` rồi điều hướng tới `/rooms/<id>`. Wizard cũ chỉ dùng cho mock/api.
2. **Vào bằng link mời:** route `/join/:inviteCode`, đi qua RequireAuth.
   - Form gồm "Tên hiển thị" (≤ 40 ký tự, mặc định tên hồ sơ).
   - Gọi `joinOpenRoom` rồi điều hướng tới phòng.
   - Lỗi thì hiện `error.message`.

   Trong phòng, chủ phòng thấy link mời và nút "Sao chép link mời". Lấy mã mời từ snapshot; nếu snapshot không có thì ghi vào báo cáo.
3. **Hàng chờ (Waiting) và đội hình (Selected):**
   - Chủ phòng có menu ⋯ trên từng người: "Mời ra khỏi phòng" (kick), "Đưa về cuối hàng chờ" (requeue), "Thay người" (replace, chỉ khi `preparing`).
   - Kick và requeue phải có hộp xác nhận.
   - Chủ phòng có ô "Thêm người chơi" (tên giả lập, không phải tài khoản) → `addPlayer`.
   - Thành viên có nút "Vào hàng chờ" (`continueQueue`) và "Rời phòng" (`leave`, có xác nhận).
   - Chủ phòng có "Đóng phòng" (xác nhận).
4. **Đội hình 5v5 khi `preparing`:**
   - Hiện Team A / Team B.
   - "Đổi chỗ": chọn 1 người mỗi đội → `swapLineupPlayers` → `saveLineup`.
   - "Chia ngẫu nhiên": chia 10 người thành 2 đội, mỗi đội 5 (đảo ngẫu nhiên là đủ, `skill_mode: 'random'`) → `saveLineup`.
5. **Điều khiển vòng:**
   - Nút theo pha: "Chuẩn bị vòng" (`prepare`, khi idle/ended; nhãn "Vòng tiếp theo" khi ended), "Bắt đầu" (`start`), "Kết thúc" (`end`).
   - Hiện pha hiện tại + số vòng.
   - "Next" chưa có nhập Match ID/kết quả ở backend. **Không** làm form kết quả; chỉ ghi chú nhỏ "Lưu kết quả trận: sắp có".
6. **Trạng thái và lỗi:**
   - Mọi nút: ẩn hoặc disable theo `openRoomPermissions`; disable + nhãn đang xử lý khi `pending`.
   - Lỗi hiện toast (`useToast`) bằng `error.message`. `version_conflict` hiện "Phòng vừa thay đổi, đã tải lại." (hook đã refetch).
   - Mất kết nối realtime (`connection`): giữ banner hiện có của HUY-14.
7. **Thiết kế:** theo `AGENTS.md`.
   - Mỗi khung nhìn tối đa 1 nút vàng đặc: đó là nút hành động chính của pha, các nút khác dùng outline/ghost.
   - Con của flex có `min-w-0`; tên dài không phá layout.
   - 375px không cuộn ngang. Spacing đúng thang.
8. **Test (Vitest + Testing Library, mock `useOpenRoom`/`useOpenRoomActions`):**
   - chủ phòng vs thành viên vs khán giả thấy đúng nút theo từng pha;
   - kick có xác nhận, rồi gọi đúng memberId;
   - swap gọi `saveLineup` với đội đã đổi;
   - lỗi hiện toast;
   - `/join/:code` gọi `joinOpenRoom` và điều hướng;
   - `/rooms/new` ở chế độ supabase gọi `createOpenRoom`.

   Test cũ (`RoomDetail.test.tsx`…) không được sửa kỳ vọng hay bỏ.

## Ghi chú học tập
Thêm vào `docs/ui-refactor/BUG_NOTES.md` một mục "HUY-15b – Ghi chú triển khai", tiếng Việt, cho người mới:
- cấu trúc component đã tách;
- cách nút đọc quyền từ `openRoomPermissions`;
- vì sao không tự sửa state cục bộ mà chờ refetch/realtime;
- cách kiểm.

## Verify (ghi output vào cuối mục ghi chú)
1. Ở gốc worktree: `npm run build`, `npm run lint` (0 lỗi), `npm test`. Web ≥ 192 test (không giảm), api 170, contracts 89, team-core 15. Nếu runner api treo trên Windows thì chạy theo file và ghi rõ.
2. Dev 5199 ở chế độ **mock**:
   - `node scripts/e2e-auth.mjs http://localhost:5199`: đạt;
   - `node scripts/screenshot.mjs huy15b http://localhost:5199`: 40/40 (giao diện mock không đổi).
3. Tắt tiến trình của mình theo đúng PID. `git status` sạch.

Commit:
- `feat(web): HUY-15b giao diện thao tác Open Room`;
- `docs: ghi chú HUY-15b`.

Sau đó `orca orchestration send --type worker_done --outcome succeeded|failed`, kèm danh sách API còn thiếu nếu có.
