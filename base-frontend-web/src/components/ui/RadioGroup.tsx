import type { KeyboardEvent, ReactNode } from 'react'
import { cn } from '../../lib/cn'

export interface RadioOption<T extends string> {
  value: T
  label: string
  description?: string
  icon?: ReactNode
  disabled?: boolean
}

function handleRadioKeyDown<T extends string>(
  event: KeyboardEvent<HTMLDivElement>,
  options: readonly RadioOption<T>[],
  currentValue: T | null,
  onChange: (value: T) => void,
  disabled?: boolean,
) {
  if (disabled) return
  const enabled = options.filter((option) => !option.disabled)
  if (!enabled.length) return

  let nextIndex = -1
  const currentIndex = enabled.findIndex((option) => option.value === currentValue)

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      nextIndex = currentIndex >= 0 ? (currentIndex + 1) % enabled.length : 0
      break
    case 'ArrowUp':
    case 'ArrowLeft':
      nextIndex = currentIndex >= 0 ? (currentIndex - 1 + enabled.length) % enabled.length : enabled.length - 1
      break
    case 'Home':
      nextIndex = 0
      break
    case 'End':
      nextIndex = enabled.length - 1
      break
    default:
      return
  }

  event.preventDefault()
  const nextOption = enabled[nextIndex]
  if (!nextOption) return
  onChange(nextOption.value)
  const radios = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]')
  const target = Array.from(radios).find((el) => el.dataset.radioValue === nextOption.value)
  target?.focus()
}

export function RadioGroup<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  ariaLabelledBy,
  variant = 'card',
  disabled = false,
  className,
}: {
  value: T | null
  onChange: (value: T) => void
  options: readonly RadioOption<T>[]
  ariaLabel?: string
  ariaLabelledBy?: string
  variant?: 'inline' | 'card' | 'segmented'
  disabled?: boolean
  className?: string
}) {
  const firstEnabled = options.find((option) => !option.disabled)?.value

  const containerClass =
    variant === 'segmented'
      ? 'grid gap-1 rounded-full border border-line bg-surface-2 p-1'
      : variant === 'inline'
        ? 'flex flex-wrap gap-3'
        : 'grid gap-3'

  const segmentedCols =
    variant === 'segmented'
      ? options.length === 2
        ? 'grid-cols-2'
        : options.length === 3
          ? 'grid-cols-3'
          : 'grid-cols-4'
      : undefined

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      onKeyDown={(event) => handleRadioKeyDown(event, options, value, onChange, disabled)}
      className={cn(containerClass, segmentedCols, className)}
    >
      {options.map((option) => {
        const checked = value === option.value
        const isDisabled = disabled || Boolean(option.disabled)
        const isTabStop = !isDisabled && (checked || (value === null && option.value === firstEnabled))

        if (variant === 'segmented') {
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              data-radio-value={option.value}
              aria-checked={checked}
              disabled={isDisabled}
              tabIndex={isTabStop ? 0 : -1}
              onClick={() => !isDisabled && onChange(option.value)}
              className={cn(
                'min-h-10 min-w-0 rounded-full px-3 py-2 text-center text-sm font-medium whitespace-nowrap transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                checked
                  ? 'border border-gold/70 bg-gold-tint text-gold'
                  : 'border border-transparent text-fg-muted enabled:hover:text-fg',
                isDisabled && 'cursor-not-allowed opacity-60',
              )}
            >
              {option.label}
            </button>
          )
        }

        if (variant === 'inline') {
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              data-radio-value={option.value}
              aria-checked={checked}
              disabled={isDisabled}
              tabIndex={isTabStop ? 0 : -1}
              onClick={() => !isDisabled && onChange(option.value)}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-btn border px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
                checked
                  ? 'border-gold bg-gold-tint text-fg'
                  : 'border-line-strong bg-surface-2 text-fg-muted enabled:hover:border-white/30 enabled:hover:text-fg',
                isDisabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <span
                aria-hidden
                className={cn(
                  'grid size-4 shrink-0 place-items-center rounded-full border',
                  checked ? 'border-gold' : 'border-line-strong',
                )}
              >
                {checked && <span className="size-2 rounded-full bg-gold" />}
              </span>
              <span>{option.label}</span>
            </button>
          )
        }

        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            data-radio-value={option.value}
            aria-checked={checked}
            disabled={isDisabled}
            tabIndex={isTabStop ? 0 : -1}
            onClick={() => !isDisabled && onChange(option.value)}
            className={cn(
              'flex min-w-0 flex-col items-start gap-1 rounded-card border p-4 text-left transition-colors',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gold',
              checked
                ? 'border-gold bg-gold-tint text-fg'
                : 'border-line-strong bg-surface-2/70 text-fg enabled:hover:border-white/30',
              isDisabled && 'cursor-not-allowed opacity-60',
            )}
          >
            <span className="flex items-center gap-2 text-base font-semibold">
              {option.icon && (
                <span aria-hidden className={cn('shrink-0', checked ? 'text-gold' : 'text-fg-muted')}>
                  {option.icon}
                </span>
              )}
              <span>{option.label}</span>
            </span>
            {option.description && <span className="text-sm text-fg-muted">{option.description}</span>}
          </button>
        )
      })}
    </div>
  )
}
