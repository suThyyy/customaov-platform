// Nguồn: base-frontend-web/src/lib/text.ts

/** Chuẩn hoá để tìm kiếm tiếng Việt không dấu, không phân biệt hoa thường. */
export const normalizeVi = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
