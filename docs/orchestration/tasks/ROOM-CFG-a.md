# ROOM-CFG-a – Mô hình cấu hình phòng + adapter (phần 1/2: dữ liệu)

- Coder: Codex `gpt-5.6-sol` medium · Reviewer: Lead
- Nhánh `feat/room-create-config` · Worktree `.worktrees/room-config` · rẽ từ `main` (`f79c3d3`, đã có HUY-15)
- Thiết kế của Owner: `docs/ui-refactor/mockups/create-room/*.png` (5 ảnh). **Xem cả 5 ảnh trước khi làm.**

## Bước 0
```bash
graphify update . --no-cluster && graphify cluster-only . --no-label --no-viz
graphify query "CreateRoom createRoom createOpenRoom room config series visibility tools" --budget 2000
```
Không chạy `extract`/`label`. Không commit `graphify-out/`.

## Hàng rào
- Không gọi Supabase thật, không đọc `.env.local`.
- Không sửa migration hay SQL; backend Supabase là của Huy Hoàng.
- Không push. Không làm yếu test.
- Không đọc/ghi ngoài `D:\CustomAOV\base-workspace`.
- Giữ nháy đơn, không chấm phẩy, không format lại cả file.

## Yêu cầu sản phẩm (từ ảnh)
Cấu hình phòng gồm **3 nhóm**:

| Nhóm | Trường | Giá trị | Sau khi tạo |
|---|---|---|---|
| 1. Phòng | `name` (bắt buộc, 3–60 ký tự), `series` | `BO3` · `BO5` (mặc định) · `BO7` | **Khoá**, không sửa được |
| | `access` | `public` · `private` (mặc định, có invite link tự sinh) | **Khoá** |
| 2. Chế độ | `playStyle` | `fun` (mặc định) · `tryhard`. Chỉ là nhãn phong cách, **không** ép thuật toán chia đội | Host đổi được |
| 3. Công cụ | `splitTool` | `random` (mặc định) · `tier` · `rank`. Là công cụ mặc định của Host khi Prepare | Host đổi được, trước khi khoá đội hình |

Không còn các trường cũ của wizard: BO1, kích thước đội, luật pick, random lane/tướng, mô tả. Trạng thái ban đầu của phòng là OPEN.

## Việc
1. **Kiểu và validate:** `src/api/roomConfig.ts` (hoặc chỗ hợp với cấu trúc `src/api`):
   - `RoomConfig`, `RoomConfigLocked` (nhóm 1), `RoomConfigEditable` (nhóm 2+3);
   - `DEFAULT_ROOM_CONFIG`, `validateRoomConfig()` trả lỗi theo trường (tiếng Việt);
   - nhãn hiển thị: `SERIES_LABEL`, `ACCESS_LABEL` ("Công khai" / "Riêng tư · Invite link"), `PLAY_STYLE_LABEL` ("Vui vẻ — Fun" / "Tryhard — Competitive"), `SPLIT_TOOL_LABEL` ("Random" / "Tier Balance" / "Rank Balance") kèm mô tả đúng như ảnh.
2. **Adapter** theo nguồn dữ liệu (`sources.ts`, theo feature `rooms`):
   - `createRoomWithConfig(config)`
   - `getRoomConfig(roomId)`
   - `updateRoomConfig(roomId, editable)`: chỉ nhận nhóm 2+3; nhóm 1 bị từ chối bằng lỗi rõ ràng.
   - Capability `configPersisted: boolean`.

   Theo nguồn:
   - **mock**: lưu thật trong mock store (`src/mocks/`). Phòng mẫu hiện có phải có cấu hình nhất quán ở mọi trang.
   - **api** (Platform Fastify): ánh xạ sang contract hiện tại. Contracts chỉ có `BO1|BO3|BO5`, nên:
     - thêm `BO7` vào `SeriesSchema`/`rooms.ts` của contracts, kèm sửa `isValidSeriesScore` (BO7 = 4 ván thắng) và test;
     - backend Fastify chạy test vẫn phải xanh;
     - các trường không có trên contract thì ghi rõ trong docs, **không** đổi schema DB Platform.
   - **supabase**: `createRoomWithConfig` gọi `createOpenRoom()` (không nhận tham số), trả `configPersisted: false` cùng cấu hình đã nhập. `getRoomConfig` trả `null` + `configPersisted: false`. UI (phần b) sẽ hiện "Chưa lưu lên server". Không dùng localStorage.
3. **Đặc tả backend cho Huy Hoàng:** `docs/product/ROOM_CONFIG_BACKEND_SPEC.md` (tiếng Việt), gồm:
   - đề xuất cột `rooms` (`name`, `series`, `access`, `play_style`, `split_tool`) với kiểu và `check`;
   - chữ ký mới `create_open_room(p_name, p_series, p_access, p_play_style, p_split_tool)`;
   - RPC `update_open_room_settings(p_room_id, p_version, p_play_style, p_split_tool)`: chỉ host, khoá version, chỉ khi pha `idle`/`ended`/`preparing` trước khi lưu đội hình;
   - RLS: ai đọc được;
   - phòng `public` có nghĩa gì (danh sách phòng công khai cần RPC/policy đọc riêng);
   - ánh xạ tới adapter FE: chỉ cần đổi `supabase` adapter khi backend có.
4. **Test:** validate; mock lưu/đọc/sửa (nhóm 1 bị từ chối); ánh xạ api; supabase trả `configPersisted:false` và gọi `createOpenRoom` đúng 1 lần; contracts BO7.

## Không làm
- Giao diện wizard và panel trong phòng (phần b, agy). Đặt adapter sao cho UI dùng được qua `src/api` (ESLint cấm import `api/source` từ ngoài).
- Tier/Rank balance thật: chưa có điểm Tier/Rank của người chơi. Chỉ lưu lựa chọn.

## Verify
- Gốc worktree: `npm ci` (nếu thiếu), `npm run build`, `npm run lint` (0 lỗi), `npm test`. Web ≥ 212, contracts ≥ 89, team-core 15, api 170 (nếu runner treo trên Windows thì chạy theo file và ghi rõ).
- `git status` sạch.

Commit:
- `feat(web): mô hình cấu hình phòng và adapter`;
- `feat(contracts): thêm BO7` (nếu đổi);
- `docs: đặc tả backend cấu hình phòng`.

Sau đó `orca orchestration send --type worker_done --outcome succeeded|failed`, kèm API cho UI dùng (tên hàm/kiểu).
