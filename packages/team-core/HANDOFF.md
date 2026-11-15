# customAOV Team Core — React Integration Handoff

## Đã port

Module này port phần **chia hai đội** từ legacy `randomizer-core.js` sang
TypeScript strict. Module độc lập với React, DOM, localStorage và backend.

Đã có ba mode tương ứng legacy:

- `random`: Fisher–Yates rồi chia đôi.
- `tier`: cân bằng bằng bảng điểm Mâm/Tier do caller truyền vào.
- `rank`: cùng thuật toán cân bằng, dùng key và bảng điểm Rank do caller truyền vào.

Lane, tướng, hộp bí ẩn/reveal, chọn 10 người từ danh sách lớn, lưu lịch sử và
đồng bộ room chưa được port.

## API công khai

Import khuyến nghị cho frontend:

```ts
import {
  DEFAULT_BALANCE_LEVEL,
  DEFAULT_TIER_SCORES,
  TeamCoreError,
  splitTeams5v5,
  type TeamSplit5v5Result,
} from "@customaov/team-core";
```

API tích hợp chính:

```ts
splitTeams5v5<T extends { id: string }>(
  players: readonly T[],
  options: SplitTeams5v5Options<T>,
): TeamSplit5v5Result<T>
```

Ví dụ Tier:

```ts
const result = splitTeams5v5(players, {
  mode: "tier",
  scores: DEFAULT_TIER_SCORES,
  balanceLevel: DEFAULT_BALANCE_LEVEL,
  getScoreKey: (player) => player.tier,
});

// result.teamA: 5 players
// result.teamB: 5 players
// result.warning: true nếu phải dùng phương án gần 50% nhất
// result.mode: "tier"
```

Ví dụ random có thể tái lập trong test:

```ts
const result = splitTeams5v5(players, {
  mode: "random",
  random: () => 0.25,
});
```

Ví dụ Rank:

```ts
const result = splitTeams5v5(players, {
  mode: "rank",
  scores: rankScores,
  balanceLevel: "50-50",
  getScoreKey: (player) => player.rankTier,
});
```

`splitRandom` và `splitBalanced` cũng được export để test parity hoặc dùng ở
tầng thấp. Hai hàm này giữ edge cases của legacy và không áp contract 5v5.
Frontend nên dùng `splitTeams5v5`.

## Quy tắc nghiệp vụ được giữ nguyên

- Flow ứng dụng chỉ chia khi có đúng 10 người; kết quả luôn là hai đội 5 người.
- Mỗi `id` phải là chuỗi không rỗng và không trùng trong một lần chia.
- Random mode không dùng điểm.
- Balanced mode sinh mọi tổ hợp 5 người cho team A.
- Các cửa sổ ban đầu: `48..52` (`50-50`), `40..60` (`60-40`),
  `30..70` (`70-30`).
- Khi chưa có tổ hợp, cửa sổ được nới 5 điểm phần trăm, tối đa ba lần.
- Nếu vẫn không có, chọn tổ hợp đầu tiên gần 50% nhất và trả
  `warning: true`.
- Nguồn random mặc định là `Math.random`; có thể truyền hàm khác để test.
- Thuật toán không tự lấy MMR, dữ liệu game hoặc dữ liệu backend.

## Validation và lỗi

`splitTeams5v5` throw `TeamCoreError` với `code` ổn định, ví dụ:

- `INVALID_PLAYER_COUNT`
- `INVALID_PLAYER_ID`
- `DUPLICATE_PLAYER_ID`
- `INVALID_MODE`
- `INVALID_BALANCE_LEVEL`
- `MISSING_SCORE`
- `INVALID_SCORE`
- `INVALID_RANDOM_SOURCE`

UI có thể map `error.code` sang thông báo tiếng Việt. Module không chứa copy UI.

Legacy local player từng dùng ID dạng `p...`; core mới chỉ yêu cầu ID chuỗi không
rỗng và duy nhất để vẫn dùng được với UUID của room/backend. Đây là ranh giới
identity của module, không thay đổi thuật toán chia đội.

## Quirk legacy được bảo toàn

Ở API thấp `splitBalanced`, điểm được đọc bằng `Number(value) || 1`:

- thiếu điểm, chuỗi không hợp lệ và điểm `0` đều được tính là `1`;
- balance level không hợp lệ rơi về cửa sổ `40..60`;
- input rỗng trả hai đội rỗng với `warning: true`;
- input lẻ đưa người dư vào team B.

Đây là hành vi đã có, không phải luật mới. `splitTeams5v5` chặn cấu hình score
không hợp lệ trước khi gọi thuật toán; riêng Tier vẫn cho score `0` như validation
legacy, sau đó core tính score đó là `1`. Có thể sửa quirk này trong một thay đổi
nghiệp vụ riêng sau khi chủ dự án duyệt, không sửa trong migration parity.

API thấp cho phép danh sách lớn và thuật toán balanced liệt kê mọi tổ hợp, nên
chi phí tăng nhanh. UI 5v5 phải dùng `splitTeams5v5`.

## Cách tích hợp trong `web`

Codex không thay đổi thư mục `web`. Agent sở hữu frontend thực hiện các bước sau:

1. Build module:

   ```powershell
   cd packages/team-core
   npm ci
   npm run build
   ```

2. Trong project frontend, thêm local dependency (thao tác này thuộc agent
   frontend vì sẽ sửa package/lockfile của `web`):

   ```powershell
   cd web
   npm install ..\packages\team-core
   ```

3. Import từ `@customaov/team-core` như ví dụ trên. Không copy thuật toán vào
   component React.

Nếu workspace sau này dùng npm workspaces, có thể đổi dependency sang
`workspace:*`; thay đổi đó cần thực hiện ở cấu hình root bởi owner của workspace.

## Kiểm thử

```powershell
cd packages/team-core
npm ci
npm test
```

`npm test` compile TypeScript strict rồi chạy Node test runner. Không cần service,
browser, database hay biến môi trường.
