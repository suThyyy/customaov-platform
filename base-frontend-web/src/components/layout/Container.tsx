import type { HTMLAttributes } from 'react'
import { cn } from '../../lib/cn'

/**
 * Khung nội dung căn giữa.
 * - mặc định: tối đa 1200px (trang đọc)
 * - wide: tối đa 1440px (trang công cụ, vd. chi tiết phòng)
 * Padding ngang 16 / 24 / 32px theo breakpoint.
 */
export function Container({
  wide,
  className,
  children,
  ...rest
}: { wide?: boolean } & HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('mx-auto w-full px-4 md:px-6 lg:px-8', wide ? 'max-w-wide' : 'max-w-page', className)}
      {...rest}
    >
      {children}
    </div>
  )
}
