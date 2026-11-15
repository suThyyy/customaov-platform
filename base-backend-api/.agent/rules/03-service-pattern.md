---
trigger: glob
globs: src/services/**/*.ts
---
# Service Pattern

**Quy chuẩn hiện thực tầng nghiệp vụ (Service Layer) trong customAOV**

## 1. Nguyên tắc cốt lõi
- **Logic nghiệp vụ thuần túy (Pure Business Logic)**: Tầng Service đặt tại `src/services/`, chứa toàn bộ các quy tắc nghiệp vụ, tính toán trạng thái, kiểm tra điều kiện chuyển đổi và điều phối dữ liệu.
- **Nhận `db` instance linh hoạt**: Mọi hàm service phải nhận tham số `db` (Drizzle client hoặc transaction context) ở tham số đầu tiên. Điều này giúp dễ dàng gọi hàm bên trong một transaction lớn hơn hoặc inject mock/PGlite database khi kiểm thử.
- **Không tự viết lại thuật toán chia đội**: Bắt buộc sử dụng package `@customaov/team-core` cho mọi thao tác chia đội 5v5 (chia ngẫu nhiên `splitRandom` hoặc cân bằng theo bậc kỹ năng `splitBalanced` qua hàm `splitTeams5v5`).
- **Không dùng cấu trúc trung gian rườm rà**: Thao tác truy vấn và cập nhật dữ liệu được thực hiện trực tiếp với Drizzle ORM trên instance `db`, không cần tạo thêm các lớp bao bọc phức tạp.

## 2. Quản lý Giao dịch & Khoá dòng (Transactions & SELECT ... FOR UPDATE)
Theo quy định tại Mục 9.2 `API.md`:
- **Bắt buộc Transaction & Khoá hàng**: Các thao tác đồng thời làm thay đổi trạng thái của phòng đấu hoặc giải đấu bắt buộc phải thực thi trong transaction và khóa hàng cha (phòng hoặc giải đấu) bằng `SELECT ... FOR UPDATE`:
  - **Phòng đấu**: `join`, `leave`, `move`, `kick`, `split`, `result`.
  - **Giải đấu**: `registrations` (tạo đơn, duyệt, từ chối, rút đơn), `draw` (bốc thăm), `score` (nhập tỉ số).
- **Cú pháp trong Drizzle**:
  ```typescript
  await db.transaction(async (tx) => {
    // Khoá dòng phòng bằng for('update') để chống race condition trên PostgreSQL
    const [room] = await tx
      .select()
      .from(rooms)
      .where(eq(rooms.id, roomId))
      .for("update");
    // Thực hiện các kiểm tra và thao tác cập nhật thành viên...
  });
  ```
  *(Lưu ý: PGlite in-memory chạy tuần tự trên một kết nối nên tự động an toàn trong môi trường test/dev; khi chạy PostgreSQL production thì khoá hàng bảo đảm ngăn chặn xung đột hoàn toàn).*

## 3. Chặn thao tác theo trạng thái & Ràng buộc nghiệp vụ
Theo Mục 9.4 `API.md`, tầng Service phải thực thi nghiêm ngặt các quy tắc sau:
- **Phòng đã kết thúc**: Mọi thao tác ghi trên phòng đã kết thúc (`status === 'finished'`) đều bị từ chối với lỗi 409 `CONFLICT`.
- **Rời phòng và Mời ra**:
  - Không được tự `kick` chính mình: nếu `userId === hostId` trong thao tác kick → báo lỗi 400 `VALIDATION` (bắt buộc dùng thao tác `leave`).
  - Khi thành viên rời phòng hoặc bị kick: đặt `active = false` trong bảng `room_members`.
  - Một người chơi chỉ có thể tham gia 1 phòng ở trạng thái `waiting` tại một thời điểm (được bảo vệ bằng partial index `WHERE role='player' AND active`).
- **Ghi nhận kết quả trận đấu (`result`)**:
  - Chỉ cho phép khi phòng có đúng 10 người chơi (`status === 'live'` hoặc 'waiting' chuyển sang kết thúc) và chưa có kết quả (`result === null`).
  - Gọi lần thứ 2 → báo lỗi 409 `CONFLICT`.
- **Duyệt đơn đăng ký giải đấu (`approve`)**:
  - Chỉ được duyệt khi giải đấu đang ở trạng thái `open` và số lượng đội đã duyệt (`approved`) nhỏ hơn tổng số đội `teamCount` (kiểm tra bên trong transaction có khóa `FOR UPDATE` dòng giải).
  - Nếu đã đủ đội hoặc giải đã đóng → ném lỗi 409 `CONFLICT`.
- **Bốc thăm giải đấu (`draw`)**:
  - Cần tối thiểu ≥ 2 đội ở trạng thái `approved`.
- **Nhập tỉ số trận đấu (`score`)**:
  - Không thể nhập tỉ số cho trận đấu chưa xác định đủ hai đội (TBD) → báo lỗi 409 `CONFLICT`.
  - Sửa tỉ số chỉ được phép khi trận đấu ở vòng sau của nhánh đấu chưa có tỉ số.
- **Cập nhật giải đấu (`PATCH /tournaments/:slug`)**:
  - Sau khi gộp dữ liệu cập nhật với dữ liệu hiện có trong CSDL, phải kiểm tra thứ tự logic thời gian: `registrationDeadline <= drawDate <= dateStart <= dateEnd`.

## 4. Tích hợp `@customaov/team-core`
Khi người dùng thực hiện chia đội trong phòng custom:
1. Đảm bảo phòng có đúng 10 người chơi (`status = 'waiting'`).
2. Chuẩn bị danh sách 10 người chơi với `id` và điểm bậc kỹ năng `tier` (1–5; nếu thiếu thì mặc định là 3).
3. Gọi `splitTeams5v5(players, options)` từ `@customaov/team-core`.
4. Cập nhật `side` (`blue` hoặc `red`) và `captain` trong bảng `room_members`, ghi nhận cấu hình chia đội vào cột `last_split` của bảng `rooms`.

```typescript
// ✅ ĐÚNG: Sử dụng @customaov/team-core
import { splitTeams5v5, type IdentifiablePlayer } from "@customaov/team-core";

const players: IdentifiablePlayer[] = members.map((m) => ({
  id: m.userId,
  tier: m.tier ?? 3,
}));

const result = splitTeams5v5(players, {
  mode: body.mode === "tier" ? "tier" : "random",
  balanceLevel: body.balanceLevel ?? "50-50",
});
// result.teams.blue, result.teams.red, result.warning
```

## 5. Code mẫu Service hoàn chỉnh với Transaction & Khoá FOR UPDATE
```typescript
import { eq, and } from "drizzle-orm";
import { splitTeams5v5 } from "@customaov/team-core";
import type { DatabaseInstance } from "../db/index.js";
import { rooms, roomMembers } from "../db/schema.js";

export interface SplitRoomOptions {
  mode: "random" | "tier";
  balanceLevel?: "50-50" | "60-40" | "70-30";
}

export const roomService = {
  /**
   * Chia 10 người chơi trong phòng thành 2 đội Xanh / Đỏ với transaction và khoá dòng
   */
  async splitRoomTeams(
    db: DatabaseInstance,
    roomCode: string,
    options: SplitRoomOptions
  ) {
    return await db.transaction(async (tx) => {
      // 1. Khoá hàng phòng bằng SELECT ... FOR UPDATE để ngăn ngừa thao tác đồng thời
      const [room] = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.code, roomCode))
        .for("update");

      if (!room) {
        throw new Error("NOT_FOUND: Phòng không tồn tại");
      }
      if (room.status === "finished") {
        throw new Error("CONFLICT: Phòng đã kết thúc, không thể thực hiện thao tác");
      }
      if (room.status !== "waiting") {
        throw new Error("CONFLICT: Phòng không ở trạng thái chờ");
      }

      // 2. Lấy danh sách thành viên vai trò người chơi đang hoạt động
      const members = await tx
        .select()
        .from(roomMembers)
        .where(
          and(
            eq(roomMembers.roomId, room.id),
            eq(roomMembers.role, "player"),
            eq(roomMembers.active, true)
          )
        );

      if (members.length !== 10) {
        throw new Error("CONFLICT: Cần đúng 10 người chơi để chia đội 5v5");
      }

      // 3. Sử dụng @customaov/team-core để chia đội
      const splitResult = splitTeams5v5(
        members.map((m) => ({ id: m.userId, tier: m.tier ?? 3 })),
        { mode: options.mode, balanceLevel: options.balanceLevel ?? "50-50" }
      );

      // 4. Cập nhật phân đội cho từng thành viên
      for (const player of splitResult.teams.blue) {
        await tx
          .update(roomMembers)
          .set({ side: "blue" })
          .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, player.id)));
      }
      for (const player of splitResult.teams.red) {
        await tx
          .update(roomMembers)
          .set({ side: "red" })
          .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.userId, player.id)));
      }

      // 5. Cập nhật last_split vào thông tin phòng
      const [updatedRoom] = await tx
        .update(rooms)
        .set({
          lastSplit: {
            mode: options.mode,
            balanceLevel: options.balanceLevel ?? null,
            warning: splitResult.warning ?? null,
            at: new Date().toISOString(),
          },
        })
        .where(eq(rooms.id, room.id))
        .returning();

      return updatedRoom;
    });
  },
};
```
