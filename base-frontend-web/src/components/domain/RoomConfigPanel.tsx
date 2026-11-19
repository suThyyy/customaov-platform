import { Lock, Shuffle, SlidersHorizontal } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { RoomConfig, RoomConfigEditable, RoomPlayStyle, RoomSplitTool } from '../../api'
import { Badge } from '../ui/primitives'
import { RadioGroup, type RadioOption } from '../ui/RadioGroup'

const PLAY_STYLE_OPTIONS: ReadonlyArray<RadioOption<RoomPlayStyle>> = [
  { value: 'fun', label: 'Fun' },
  { value: 'tryhard', label: 'Tryhard' },
]

const SPLIT_TOOL_OPTIONS: ReadonlyArray<RadioOption<RoomSplitTool>> = [
  { value: 'random', label: 'Random' },
  { value: 'tier', label: 'Tier' },
  { value: 'rank', label: 'Rank' },
]

export function RoomConfigPanel({
  config,
  configPersisted = true,
  isHost,
  playerCount,
  capacity = 10,
  roomStatus = 'OPEN',
  fallbackTitle,
  headingAs = 'h2',
  pending = false,
  onUpdate,
  className,
}: {
  config: RoomConfig | null
  configPersisted?: boolean
  isHost: boolean
  playerCount: number
  capacity?: number
  roomStatus?: 'OPEN' | 'CLOSED'
  fallbackTitle?: string
  headingAs?: 'h1' | 'h2'
  pending?: boolean
  onUpdate?: (next: RoomConfigEditable) => void | Promise<void>
  className?: string
}) {
  const Heading = headingAs
  const canEdit = isHost && configPersisted && config !== null && !pending
  const title = config?.name || fallbackTitle || 'Cấu hình phòng'
  const subtitle = config
    ? `${config.series} · ${config.access === 'private' ? 'Private' : 'Public'} · ${playerCount}/${capacity} Players`
    : `Chưa có cấu hình · ${playerCount}/${capacity} Players`

  return (
    <section
      aria-label="Cấu hình phòng"
      className={cn('flex min-w-0 flex-col gap-4 rounded-card border border-line bg-surface-2/60 p-4', className)}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <Heading className="text-lg font-bold break-words text-fg">{title}</Heading>
          <p className="mt-1 text-xs text-fg-muted">{subtitle}</p>
        </div>
        <Badge tone={roomStatus === 'OPEN' ? 'success' : 'neutral'} className="shrink-0">
          {roomStatus}
        </Badge>
      </div>

      <div className="rounded-btn border border-line bg-surface/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-fg">Thông tin phòng</h3>
          <Lock size={16} aria-hidden className="shrink-0 text-fg-muted" />
        </div>
        <p className="mt-1 text-xs text-fg-muted">Thông tin đã được cố định sau khi tạo phòng.</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-fg">Chế độ chơi</h3>
          <SlidersHorizontal size={16} aria-hidden className="shrink-0 text-fg-muted" />
        </div>
        <RadioGroup
          variant="segmented"
          ariaLabel="Chế độ chơi"
          value={config?.playStyle ?? null}
          disabled={!canEdit}
          options={PLAY_STYLE_OPTIONS}
          onChange={(playStyle) => {
            if (!config || playStyle === config.playStyle) return
            void onUpdate?.({ playStyle, splitTool: config.splitTool })
          }}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-fg">Công cụ chia đội</h3>
          <Shuffle size={16} aria-hidden className="shrink-0 text-fg-muted" />
        </div>
        <RadioGroup
          variant="segmented"
          ariaLabel="Công cụ chia đội"
          value={config?.splitTool ?? null}
          disabled={!canEdit}
          options={SPLIT_TOOL_OPTIONS}
          onChange={(splitTool) => {
            if (!config || splitTool === config.splitTool) return
            void onUpdate?.({ playStyle: config.playStyle, splitTool })
          }}
        />
      </div>

      {!configPersisted && (
        <p className="text-xs text-fg-muted">Cấu hình chưa được lưu lên server (chờ backend)</p>
      )}
    </section>
  )
}
