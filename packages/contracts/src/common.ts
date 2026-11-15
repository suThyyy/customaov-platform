import { z } from "zod";

export const CSRF_HEADER = "x-csrf-token";
export const CSRF_COOKIE = "csrf";
export const SESSION_COOKIE = "sid";

export const ErrorCodeSchema = z.enum([
  "VALIDATION",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "CSRF",
  "NOT_FOUND",
  "CONFLICT",
  "RATE_LIMITED",
  "INTERNAL",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorBodySchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string().min(1),
    details: z.unknown().optional(),
  }),
});
export type ErrorBody = z.infer<typeof ErrorBodySchema>;

export const IsoDateTimeSchema = z.iso.datetime({ offset: true });
export type IsoDateTime = z.infer<typeof IsoDateTimeSchema>;
export const UuidSchema = z.uuid();
export type Uuid = z.infer<typeof UuidSchema>;
export const EmptyBodySchema = z.undefined();
export type EmptyBody = z.infer<typeof EmptyBodySchema>;
export const UsernameSchema = z
  .string()
  .min(3)
  .max(20)
  .regex(/^[a-z0-9_]+$/);
export type Username = z.infer<typeof UsernameSchema>;

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().min(0),
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(50),
  });

export type Paginated<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

/** Chuẩn hoá để tìm kiếm tiếng Việt không dấu, không phân biệt hoa thường. */
export const normalizeVi = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d");
