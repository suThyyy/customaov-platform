/** Chuẩn hoá để tìm kiếm tiếng Việt không dấu, không phân biệt hoa thường ("Ngũ Kiệt" ~ "ngu kiet") */
export const normalizeVi = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
