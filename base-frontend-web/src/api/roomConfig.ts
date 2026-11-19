import type { CreateRoomBody, RoomDetail } from '@customaov/contracts'

export type RoomSeries = 'BO3' | 'BO5' | 'BO7'
export type RoomAccess = 'public' | 'private'
export type RoomPlayStyle = 'fun' | 'tryhard'
export type RoomSplitTool = 'random' | 'tier' | 'rank'

export interface RoomConfigLocked {
  name: string
  series: RoomSeries
  access: RoomAccess
}

export interface RoomConfigEditable {
  playStyle: RoomPlayStyle
  splitTool: RoomSplitTool
}

export type RoomConfig = RoomConfigLocked & RoomConfigEditable
export type RoomConfigField = keyof RoomConfig
export type RoomConfigErrors = Partial<Record<RoomConfigField, string>>

export interface RoomConfigCreateResult {
  roomId: string
  status: 'OPEN'
  config: RoomConfig
  configPersisted: boolean
}

export interface RoomConfigReadResult {
  config: RoomConfig | null
  configPersisted: boolean
}

export interface RoomConfigUpdateResult {
  config: RoomConfigEditable
  configPersisted: boolean
}

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  name: '',
  series: 'BO5',
  access: 'private',
  playStyle: 'fun',
  splitTool: 'random',
}

export const SERIES_LABEL: Record<RoomSeries, string> = {
  BO3: 'BO3',
  BO5: 'BO5',
  BO7: 'BO7',
}

export const ACCESS_LABEL: Record<RoomAccess, string> = {
  public: 'Công khai',
  private: 'Riêng tư · Invite link',
}

export const ACCESS_DESCRIPTION: Record<RoomAccess, string> = {
  public: 'Phòng xuất hiện trong danh sách phòng công khai.',
  private: 'Invite link sẽ được tạo tự động sau khi tạo phòng thành công, không cần nhập thủ công.',
}

export const PLAY_STYLE_LABEL: Record<RoomPlayStyle, string> = {
  fun: 'Vui vẻ — Fun',
  tryhard: 'Tryhard — Competitive',
}

export const PLAY_STYLE_SHORT_LABEL: Record<RoomPlayStyle, string> = {
  fun: 'Fun',
  tryhard: 'Tryhard',
}

export const PLAY_STYLE_DESCRIPTION: Record<RoomPlayStyle, string> = {
  fun: 'Chơi cùng bạn bè, ưu tiên trải nghiệm thoải mái.',
  tryhard: 'Thi đấu nghiêm túc, đề cao tính cạnh tranh.',
}

export const SPLIT_TOOL_LABEL: Record<RoomSplitTool, string> = {
  random: 'Random',
  tier: 'Tier Balance',
  rank: 'Rank Balance',
}

export const SPLIT_TOOL_DESCRIPTION: Record<RoomSplitTool, string> = {
  random: 'Chia ngẫu nhiên 10 người thành hai đội 5v5.',
  tier: 'Chia đội theo điểm Tier của người chơi.',
  rank: 'Chia đội theo Rank và quy tắc cân bằng.',
}

const values = {
  series: new Set<unknown>(['BO3', 'BO5', 'BO7']),
  access: new Set<unknown>(['public', 'private']),
  playStyle: new Set<unknown>(['fun', 'tryhard']),
  splitTool: new Set<unknown>(['random', 'tier', 'rank']),
}

export function validateRoomConfig(config: RoomConfig): RoomConfigErrors {
  const errors: RoomConfigErrors = {}
  const name = typeof config.name === 'string' ? config.name.trim() : ''
  if (!name) errors.name = 'Vui lòng nhập tên phòng.'
  else if (name.length < 3) errors.name = 'Tên phòng phải có ít nhất 3 ký tự.'
  else if (name.length > 60) errors.name = 'Tên phòng không được vượt quá 60 ký tự.'
  if (!values.series.has(config.series)) errors.series = 'Thể thức không hợp lệ.'
  if (!values.access.has(config.access)) errors.access = 'Quyền truy cập không hợp lệ.'
  if (!values.playStyle.has(config.playStyle)) errors.playStyle = 'Phong cách thi đấu không hợp lệ.'
  if (!values.splitTool.has(config.splitTool)) errors.splitTool = 'Công cụ chia đội không hợp lệ.'
  return errors
}

export function validateRoomConfigEditable(editable: RoomConfigEditable): RoomConfigErrors {
  const errors: RoomConfigErrors = {}
  const input = editable as RoomConfigEditable & Partial<RoomConfigLocked>
  const locked = (['name', 'series', 'access'] as const).find((field) => field in input)
  if (locked) throw new Error(`Không thể cập nhật trường đã khoá: ${locked}.`)
  if (!values.playStyle.has(editable.playStyle)) errors.playStyle = 'Phong cách thi đấu không hợp lệ.'
  if (!values.splitTool.has(editable.splitTool)) errors.splitTool = 'Công cụ chia đội không hợp lệ.'
  return errors
}

export const parseRoomConfig = (config: RoomConfig): RoomConfig => {
  const normalized = { ...config, name: config.name.trim() }
  const errors = validateRoomConfig(normalized)
  if (Object.keys(errors).length) throw new RoomConfigValidationError(errors)
  return normalized
}

export class RoomConfigValidationError extends Error {
  readonly errors: RoomConfigErrors

  constructor(errors: RoomConfigErrors) {
    super('Cấu hình phòng không hợp lệ.')
    this.name = 'RoomConfigValidationError'
    this.errors = errors
  }
}

export const toApiCreateRoomBody = (config: RoomConfig): CreateRoomBody => ({
  title: config.name.trim(),
  mode: config.playStyle === 'fun' ? 'friendly' : 'normal',
  visibility: config.access,
  config: {
    format: '5v5',
    pickMode: config.splitTool === 'random' ? 'random' : config.splitTool === 'tier' ? 'blind' : 'draft',
    series: config.series,
    tools: config.splitTool === 'random' ? [] : ['balance'],
    notes: '',
  },
})

export const fromApiRoomDetail = (room: RoomDetail): RoomConfig => ({
  name: room.title,
  series: room.config.series === 'BO1' ? 'BO3' : room.config.series,
  access: room.visibility,
  playStyle: room.mode === 'friendly' ? 'fun' : 'tryhard',
  splitTool: room.config.pickMode === 'random' ? 'random' : room.config.pickMode === 'blind' ? 'tier' : 'rank',
})

