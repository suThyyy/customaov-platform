import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'

/**
 * Banner đầu trang (ảnh nhân vật bên phải, nền tối mờ dần sang trái).
 * Ảnh là placeholder cắt từ mock.
 */
export function PageBanner({
  image,
  imageClassName,
  className,
  children,
}: {
  image: string
  imageClassName?: string
  className?: string
  children: ReactNode
}) {
  return (
    <section
      className={cn(
        'relative isolate overflow-hidden rounded-card border border-line bg-surface',
        className,
      )}
    >
      <img
        src={image}
        alt=""
        aria-hidden
        className={cn('absolute inset-y-0 right-0 -z-10 h-full w-full object-cover lg:w-[68%]', imageClassName)}
      />
      <div
        aria-hidden
        // Phase 5: giữ nền đậm tới ~55% (dòng meta có thể kéo dài tới đó) để chữ phụ đạt AA
        className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,#11131a_0%,#11131a_35%,rgb(17_19_26/0.88)_52%,rgb(17_19_26/0.3)_72%,transparent_100%)]"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-[radial-gradient(120%_80%_at_70%_100%,rgb(242_180_99/0.10),transparent_60%)]"
      />
      {/* < 1024: chữ phủ lên ảnh → phủ thêm lớp tối để chữ phụ đạt AA (Còn tồn #5, đo điểm ảnh ở Phase 5) */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[rgb(17_19_26/0.8)] lg:hidden" />
      {children}
    </section>
  )
}
