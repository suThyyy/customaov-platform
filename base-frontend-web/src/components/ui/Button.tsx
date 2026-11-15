import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { cn } from '../../lib/cn'

export type ButtonVariant = 'primary' | 'outline' | 'secondary' | 'gold-outline' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg' | 'xl'

const base =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-semibold select-none ' +
  'transition-[background-color,border-color,color,box-shadow,transform,filter] duration-150 ease-[var(--ease-out-soft)] ' +
  'active:translate-y-px active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45'

const variants: Record<ButtonVariant, string> = {
  primary:
    'bg-gold-gradient text-gold-ink shadow-[var(--shadow-gold)] hover:brightness-110 hover:shadow-[0_10px_28px_-10px_rgb(242_180_99/0.75)]',
  outline:
    'border border-line-strong bg-white/[0.03] text-fg hover:border-white/30 hover:bg-white/[0.07]',
  secondary: 'bg-surface-3 text-fg hover:bg-surface-4',
  'gold-outline': 'border border-gold/80 text-gold hover:bg-gold/10 hover:text-gold-300',
  ghost: 'text-fg-muted hover:bg-white/5 hover:text-fg',
}

const sizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-sm rounded-btn',
  md: 'h-10 px-4 text-sm rounded-btn',
  lg: 'h-11 px-5 text-base rounded-btn',
  xl: 'h-[52px] px-6 text-base rounded-btn',
}

interface CommonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  pill?: boolean
  leftIcon?: ReactNode
  rightIcon?: ReactNode
  className?: string
  children?: ReactNode
}

export type ButtonProps = CommonProps & ButtonHTMLAttributes<HTMLButtonElement>

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', pill, leftIcon, rightIcon, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cn(base, variants[variant], sizes[size], pill && 'rounded-full', className)}
      {...rest}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  )
})

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  pill,
  leftIcon,
  rightIcon,
  className,
  children,
  ...rest
}: CommonProps & Omit<LinkProps, 'className' | 'children'>) {
  return (
    <Link className={cn(base, variants[variant], sizes[size], pill && 'rounded-full', className)} {...rest}>
      {leftIcon}
      {children}
      {rightIcon}
    </Link>
  )
}

/** Nút vuông chỉ có icon — bắt buộc có aria-label */
export function IconButton({
  label,
  className,
  children,
  variant = 'outline',
  type = 'button',
  ...rest
}: { label: string; variant?: ButtonVariant } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'>) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(base, variants[variant], 'rounded-btn', className)}
      {...rest}
    >
      {children}
    </button>
  )
}
