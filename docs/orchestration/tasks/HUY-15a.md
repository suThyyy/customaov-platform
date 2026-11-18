# HUY-15a – Adapter ghi (mutation) cho Open Room trên Supabase (Linear HUY-15, phần 1/3)

- Coder: Codex `gpt-5.6-sol` medium · Reviewer: Lead
- Nhánh `feat/huy-15-room-mutations` · Worktree `.worktrees/HUY-15-room` · rẽ từ `feat/huy-14-supabase-adapters` (`673f6e1`, PR #3 chưa merge, nhánh xếp chồng)
- Cổng nếu cần dev: web 5199. Không dùng 5173/5174/5180/5181/5182/6174.

## Bước 0 – Graphify (bắt buộc, trước khi đọc code)
Graph code dựng bằng AST, chạy offline và không gọi LLM. `graphify-out/` đã bị bỏ qua qua `.git/info/exclude`, đừng commit thư mục này.
```bash
graphify update . --no-cluster && graphify cluster-only . --no-label --no-viz
graphify query "supabase room snapshot realtime adapter" --budget 1500
graphify query "<câu hỏi của bạn>" --budget 1500   # dùng trước khi grep/đọc file rộng
```
Chỉ dùng `query`/`path`/`explain`. **Không** chạy `graphify extract`, `label` hay bất kỳ lệnh nào gọi LLM/API ngoài.

## ⚠ Hàng rào
- **KHÔNG gọi mạng tới Supabase.** Không tạo/đọc `.env.local`, không URL/key thật. Mọi test dùng client giả.
- Supabase thật là Production. Việc ghi thật chỉ làm khi có môi trường được duyệt, ở task HUY-15c (Lead).
- Chỉ được **đọc** trong `D:\ProjectCustom` (commit `595a24e`) các file sau:
  - `room-api-core.js`, `roomApi.js`, `room-controller.js`, `room-ui.js`, `randomizer-core.js`;
  - `db/migrations/*.sql`, `db/verification/*.sql`.
  Ngoài các file này, không đọc/ghi ngoài `D:\CustomAOV\base-workspace`.
- Không push. Không sửa migration. Không làm yếu test.

## Bối cảnh
HUY-14 (nhánh gốc) đã có:
- auth, profile;
- `readOpenRoomSnapshot`, `useOpenRoom` (realtime + reconnect);
- `SupabaseRoomView` (chỉ đọc);
- `docs/product/SUPABASE_CONTRACTS.md`.

Huy Hoàng (backend Supabase) xác nhận migrations huy9/10/11 đã lên Production và liệt kê phạm vi cần đạt parity:
- join qua invite link;
- host thêm người chơi giả lập (tên, không phải account);
- hàng chờ; chọn từ hàng chờ cho đủ 10;
- host kick, replace, swap;
- requeue;
- Prepare / Start / End / Next;
- version check / row lock;
- Realtime.

## Việc
1. `src/api/supabase/roomMutations.ts`: hàm có kiểu cho **mọi** RPC ghi mà `room-api-core.js` dùng. Tên và tham số phải khớp SQL:
   - `create_open_room`, `close_open_room`;
   - `join_open_room(p_invite_code, p_display_name)`, `leave_open_room`;
   - `host_add_player_to_room`, `host_kick_room_member`, `host_requeue_room_member`;
   - `continue_open_room_queue`;
   - `prepare_next_open_room_round`, `start_open_room_round`, `end_open_room_round`;
   - `save_open_room_lineup(p_room_id, p_version, p_players)`;
   - `replace_open_room_player(p_room_id, p_version, p_member_id)`.

   Mỗi hàm cần:
   - kiểm tra đầu vào giống bản cũ (trim, độ dài: tên ≤ 40);
   - chặn khi chưa đăng nhập hoặc phiên anonymous (đúng thông điệp như bản cũ);
   - trả kết quả dạng `{ ok: true, data } | { ok: false, error: RoomMutationError }`.
2. `RoomMutationError`: phân loại lỗi từ `raise exception` trong migration. Đọc SQL để lấy **chính xác** mã/thông điệp. Tối thiểu có các loại:
   - `version_conflict` (lineup/replace sai `p_version`);
   - `forbidden` (không phải host);
   - `not_found`;
   - `invalid_state` (sai pha vòng);
   - `queue_full`/`not_enough_players` nếu SQL có;
   - `auth_required`;
   - `network`;
   - `unknown`.

   Kèm thông điệp tiếng Việt cho UI. Thông điệp không được lộ chi tiết SQL.
3. Swap: SQL **không** có RPC swap riêng. Xác minh điều này. Nếu swap = `save_open_room_lineup` với đội mới thì viết helper thuần `swapLineupPlayers(lineup, a, b)` và ghi rõ trong docs. Randomizer: so `randomizer-core.js` với `packages/team-core`, rồi ghi khác biệt vào docs. **Không** đổi thuật toán team-core.
4. Hook `useOpenRoomActions(roomId, snapshot)`:
   - trả các action đã gắn `roomId` + `version` hiện tại, cùng trạng thái `pending` theo từng action;
   - sau khi thành công thì gọi refetch snapshot (dùng cơ chế có sẵn của `useOpenRoom`, không viết realtime thứ hai);
   - khi `version_conflict` thì refetch và trả lỗi để UI báo "Phòng vừa thay đổi, đã tải lại".
5. Quyền theo vai trò/pha: hàm thuần `openRoomPermissions(snapshot, userId)` trả các action được phép (host/thành viên/khán giả × pha vòng), suy ra từ SQL. UI ở HUY-15b sẽ dùng hàm này để ẩn/disable nút.
6. Test (Vitest, client giả):
   - tên RPC + tham số đúng cho từng hàm;
   - ánh xạ từng loại lỗi; chặn anonymous;
   - `useOpenRoomActions` refetch sau thành công và sau conflict;
   - `openRoomPermissions` theo bảng vai trò × pha;
   - `swapLineupPlayers`.
7. Docs: bổ sung `docs/product/SUPABASE_CONTRACTS.md` mục "RPC ghi". Ghi bảng lỗi (file:dòng migration), bảng quyền, swap/randomizer, và **khoảng trống backend**, ví dụ: "Next" chưa có state nhập match ID để lưu kết quả (Huy Hoàng xác nhận đang thiếu).

## Không làm
- UI (thuộc HUY-15b, agy).
- Gọi Supabase thật.
- Sửa `team-core`, contracts Platform, backend Fastify.

## Verify
- Ở gốc worktree: `npm ci` (nếu thiếu node_modules), `npm run build`, `npm run lint` (0 lỗi), `npm test`. Số test không được giảm so với nhánh gốc (web 152, api 170, contracts 89, team-core 15).
- `git status` sạch sau commit.

Commit:
- `feat(web): HUY-15a adapter ghi Open Room Supabase`;
- `docs: hợp đồng RPC ghi Open Room`.

Sau đó `orca orchestration send --type worker_done --outcome succeeded|failed`, kèm tóm tắt và danh sách khoảng trống backend.
