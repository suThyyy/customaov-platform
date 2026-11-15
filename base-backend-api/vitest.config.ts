import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // PGlite migrations + scrypt are slow when test files run in parallel.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Mỗi file khởi tạo PGlite + migrate riêng. Chạy song song khi máy bận (nhiều worker)
    // làm test đầu mỗi file chạm timeout 30s. Chạy tuần tự từng file để kết quả ổn định
    // (không bỏ hay nới test nào; xem DECISIONS.md 15/11).
    fileParallelism: false,
  },
});

