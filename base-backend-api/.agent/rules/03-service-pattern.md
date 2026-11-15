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
- **Không dùng cấu trúc trung gian rườm rà**: Thao tác truy vấn và cập nhật dữ liệu được thực hiện trực tiếp với Drizzle ORM trên instance `db`, không cần tạo thêm các lớp interface hay DAO bao bọc phức tạp.

## 2. Quản lý Giao dịch (Transactions)
- **Quy tắc bắt buộc**: Khi một thao tác nghiệp vụ cần ghi dữ liệu (INSERT, UPDATE, DELETE) vào **từ hai bảng trở lên**, hoặc khi cần kiểm tra tính toàn vẹn kèm khoá (check-then-act), bắt buộc phải thực hiện trong transaction:
  ```typescript
  await db.transaction(async (tx) => {
    // Toàn bộ các thao tác bên trong phải dùng tham số `tx` thay cho `db`
  });
  ```
- Nếu bất kỳ bước nào trong transaction ném ngoại lệ hoặc thất bại, transaction sẽ tự động rollback hoàn toàn.

## 3. Tích hợp `@customaov/team-core`
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

## 4. Code mẫu Service hoàn chỉnh
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
   * Chia 10 người chơi trong phòng thành 2 đội Xanh / Đỏ
   */
  async splitRoomTeams(
    db: DatabaseInstance,
    roomCode: string,
    options: SplitRoomOptions
  ) {
    // Thực hiện trong transaction để bảo toàn dữ liệu phòng và thành viên
    return await db.transaction(async (tx) => {
      // 1. Lấy thông tin phòng
      const [room] = await tx
        .select()
        .from(rooms)
        .where(eq(rooms.code, roomCode))
        .limit(1);

      if (!room) {
        throw new Error("NOT_FOUND: Phòng không tồn tại");
      }
      if (room.status !== "waiting") {
        throw new Error("CONFLICT: Phòng không ở trạng thái chờ");
      }

      // 2. Lấy danh sách thành viên vai trò người chơi
      const members = await tx
        .select()
        .from(roomMembers)
        .where(and(eq(roomMembers.roomId, room.id), eq(roomMembers.role, "player")));

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
