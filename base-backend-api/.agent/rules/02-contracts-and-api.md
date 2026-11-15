---
trigger: glob
globs: src/routes/**/*.ts, src/app.ts
---
# Hợp đồng API & Route Controllers

**Quy chuẩn hiện thực REST API routes, validation và phân quyền trên Fastify 5**

## 1. Nguyên tắc hợp đồng (Contracts)
- **Tập trung tại `@customaov/contracts`**: Toàn bộ dữ liệu vào (params, query, body) và dữ liệu ra (responses) phải tuân thủ đúng schema Zod từ package `@customaov/contracts`.
- **Validation hai đầu**: Request được parse bằng schema Zod trước khi đưa vào service. Nếu dữ liệu không hợp lệ, trả về mã lỗi 400 `VALIDATION` kèm chi tiết lỗi đã làm phẳng.
- **Không tự chế type**: Không được dùng `any` hoặc tự viết lại type mà `@customaov/contracts` đã export.

## 2. Chuẩn phản hồi lỗi (Error Response Format)
Mọi phản hồi lỗi từ API bắt buộc phải tuân theo cấu trúc JSON chuẩn:
```json
{
  "error": {
    "code": "<MA_LOI>",
    "message": "<Thông báo tiếng Việt rõ ràng cho người dùng>",
    "details": "<Chi tiết tuỳ chọn, ví dụ danh sách lỗi zod>"
  }
}
```

### Danh mục mã lỗi chuẩn (Theo docs/product/API.md mục 1):
| HTTP Status | Mã `code` | Trường hợp sử dụng |
|-------------|-----------|--------------------|
| **400** | `VALIDATION` | Body, query hoặc params không đúng schema contracts |
| **401** | `UNAUTHENTICATED` | Chưa đăng nhập hoặc phiên làm việc đã hết hạn |
| **403** | `FORBIDDEN` | Không đủ quyền hạn (không phải chủ phòng, không phải BTC giải) |
| **403** | `CSRF` | Thiếu hoặc sai CSRF token trên request ghi |
| **404** | `NOT_FOUND` | Tài nguyên không tồn tại (phòng, giải đấu, người dùng) |
| **409** | `CONFLICT` | Trùng lặp dữ liệu (username, tên đội) hoặc sai trạng thái nghiệp vụ (phòng đã đủ người, giải đã đóng đăng ký) |
| **429** | `RATE_LIMITED` | Vượt quá tần suất cho phép (đăng nhập, đăng ký, chat) |
| **500** | `INTERNAL` | Lỗi không mong muốn phía máy chủ (không để lộ stack trace ở production) |

## 3. Quy chuẩn phân trang (Pagination)
- **Query đầu vào**: Sử dụng `PaginationQuerySchema` với `page` (≥ 1, mặc định 1) và `pageSize` (1–50, mặc định 10).
- **Dữ liệu đầu ra**: Luôn đóng gói theo cấu trúc `{ items, total, page, pageSize }` (dùng helper `paginatedSchema` từ contracts).

```typescript
import { PaginationQuerySchema } from "@customaov/contracts";

app.get("/api/tournaments", async (request, reply) => {
  const query = PaginationQuerySchema.parse(request.query);
  const result = await tournamentService.listTournaments(db, query);
  return reply.status(200).send(result); // { items: [...], total, page, pageSize }
});
```

## 4. Kiểm tra quyền hạn tại Server (Authorization)
Tuyệt đối không tin tưởng client. Mọi hành vi thay đổi trạng thái phải được kiểm tra quyền hạn rõ ràng trên server:
- **Chủ phòng (`host`)**: Chỉ người tạo/chủ phòng hiện tại mới có quyền thực hiện:
  - Chia đội (`POST /api/rooms/:code/split`)
  - Đổi chỗ người chơi (`POST /api/rooms/:code/move`)
  - Mời người chơi ra ngoài (`POST /api/rooms/:code/kick`)
  - Chia lane ngẫu nhiên (`POST /api/rooms/:code/random-lanes`)
  - Nhập kết quả trận đấu (`POST /api/rooms/:code/result`)
- **Ban tổ chức giải đấu (`BTC` / `organizer`)**: Chỉ BTC mới có quyền:
  - Sửa thông tin giải khi còn mở (`PATCH /api/tournaments/:slug`)
  - Duyệt hoặc từ chối đơn đăng ký (`POST /api/tournaments/:slug/registrations/:id/approve` | `reject`)
  - Đóng đăng ký giải (`POST /api/tournaments/:slug/close-registration`)
  - Bốc thăm nhánh đấu (`POST /api/tournaments/:slug/draw`)
  - Nhập tỉ số trận đấu (`POST /api/tournaments/:slug/matches/:matchId/score`)
- **Khán giả (`spectator`)**: Không được phép gửi tin nhắn chat trong phòng (`POST /api/rooms/:code/messages` trả về 403 `FORBIDDEN`).

## 5. Ví dụ hoàn chỉnh một Route Handler Fastify
```typescript
import type { FastifyPluginAsync } from "fastify";
import {
  CreateRoomBodySchema,
  SplitTeamsBodySchema,
  type CreateRoomBody,
} from "@customaov/contracts";
import type { DatabaseInstance } from "../db/index.js";
import { roomService } from "../services/roomService.js";

export const roomRoutes = (db: DatabaseInstance): FastifyPluginAsync => {
  return async (app) => {
    // 1. Tạo phòng (yêu cầu đăng nhập)
    app.post("/", async (request, reply) => {
      const user = request.currentUser;
      if (!user) {
        return reply.status(401).send({
          error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập để tạo phòng" },
        });
      }

      const parseResult = CreateRoomBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        return reply.status(400).send({
          error: {
            code: "VALIDATION",
            message: "Dữ liệu tạo phòng không hợp lệ",
            details: parseResult.error.flatten(),
          },
        });
      }

      const room = await roomService.createRoom(db, parseResult.data, user.id);
      return reply.status(201).send(room);
    });

    // 2. Chia đội (chỉ chủ phòng)
    app.post("/:code/split", async (request, reply) => {
      const user = request.currentUser;
      if (!user) {
        return reply.status(401).send({
          error: { code: "UNAUTHENTICATED", message: "Vui lòng đăng nhập" },
        });
      }

      const { code } = request.params as { code: string };
      const isHost = await roomService.checkIsHost(db, code, user.id);
      if (!isHost) {
        return reply.status(403).send({
          error: { code: "FORBIDDEN", message: "Chỉ chủ phòng mới có quyền chia đội" },
        });
      }

      const body = SplitTeamsBodySchema.parse(request.body);
      const updatedRoom = await roomService.splitRoomTeams(db, code, body);
      return reply.status(200).send(updatedRoom);
    });
  };
};
```
