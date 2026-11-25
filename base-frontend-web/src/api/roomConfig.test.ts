import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_ROOM_CONFIG,
  RoomConfigValidationError,
  createRoomWithConfig,
  getRoomConfig,
  toApiCreateRoomBody,
  updateRoomConfig,
  validateRoomConfig,
  type RoomConfigEditable,
} from './index'
import { resetMockRoomConfigStore } from '../mocks/roomConfig'
import { endpoints } from './endpoints'
import { httpAdapter } from './http'

describe('room config validation', () => {
  it('uses the product defaults', () => {
    expect(DEFAULT_ROOM_CONFIG).toEqual({
      name: '',
      series: 'BO5',
      access: 'private',
      playStyle: 'fun',
      splitTool: 'random',
    })
  })

  it('returns Vietnamese errors by field', () => {
    expect(validateRoomConfig({
      name: 'ab',
      series: 'BO1',
      access: 'friends',
      playStyle: 'casual',
      splitTool: 'mmr',
    } as never)).toEqual({
      name: 'Tên phòng phải có ít nhất 3 ký tự.',
      series: 'Thể thức không hợp lệ.',
      access: 'Quyền truy cập không hợp lệ.',
      playStyle: 'Phong cách thi đấu không hợp lệ.',
      splitTool: 'Công cụ chia đội không hợp lệ.',
    })
  })

  it('rejects a name over 60 characters', () => {
    expect(validateRoomConfig({ ...DEFAULT_ROOM_CONFIG, name: 'a'.repeat(61) }).name)
      .toBe('Tên phòng không được vượt quá 60 ký tự.')
  })
})

describe('mock room config adapter', () => {
  beforeEach(() => resetMockRoomConfigStore())

  it('stores, reads and updates editable fields', async () => {
    const config = { ...DEFAULT_ROOM_CONFIG, name: 'Kèo tối thứ bảy', series: 'BO7' as const }
    const created = await createRoomWithConfig(config)
    expect(created.configPersisted).toBe(true)
    expect((await getRoomConfig(created.roomId)).config).toEqual(config)

    await expect(updateRoomConfig(created.roomId, { playStyle: 'tryhard', splitTool: 'rank' }))
      .resolves.toEqual({ config: { playStyle: 'tryhard', splitTool: 'rank' }, configPersisted: true })
    expect((await getRoomConfig(created.roomId)).config).toEqual({
      ...config,
      playStyle: 'tryhard',
      splitTool: 'rank',
    })
  })

  it('keeps seeded room configuration consistent with the room list', async () => {
    expect(await getRoomConfig('AOV-1024')).toEqual({
      config: {
        name: 'Kèo giao hữu – Team A vs B',
        series: 'BO5',
        access: 'private',
        playStyle: 'fun',
        splitTool: 'random',
      },
      configPersisted: true,
    })
  })

  it('rejects locked fields during update', () => {
    const invalid = { playStyle: 'fun', splitTool: 'random', name: 'Tên mới' } as RoomConfigEditable
    expect(() => updateRoomConfig('AOV-1024', invalid)).toThrow('Không thể cập nhật trường đã khoá: name.')
  })

  it('rejects invalid creates with field errors', () => {
    expect(() => createRoomWithConfig(DEFAULT_ROOM_CONFIG)).toThrow(RoomConfigValidationError)
  })
})

describe('Platform API compatibility mapping', () => {
  it('maps all product options onto the current contract', () => {
    expect(toApiCreateRoomBody({
      name: 'Đấu rank nội bộ',
      series: 'BO7',
      access: 'public',
      playStyle: 'tryhard',
      splitTool: 'rank',
    })).toEqual({
      title: 'Đấu rank nội bộ',
      mode: 'normal',
      visibility: 'public',
      config: {
        format: '5v5',
        pickMode: 'draft',
        series: 'BO7',
        tools: ['balance'],
        notes: '',
      },
    })
  })

  it('sends the mapped body through the Platform create endpoint', async () => {
    const create = vi.spyOn(endpoints, 'createRoom').mockResolvedValue({ code: 'AOV-9000' } as never)
    const config = {
      name: 'Phòng vui cuối tuần',
      series: 'BO5' as const,
      access: 'private' as const,
      playStyle: 'fun' as const,
      splitTool: 'tier' as const,
    }

    await expect(httpAdapter.rooms.createRoomWithConfig(config)).resolves.toEqual({
      roomId: 'AOV-9000',
      status: 'OPEN',
      config,
      configPersisted: true,
    })
    expect(create).toHaveBeenCalledOnce()
    expect(create.mock.calls[0]?.[0]).toEqual(toApiCreateRoomBody(config))
    create.mockRestore()
  })
})

describe('Supabase room config adapter', () => {
  it('calls create_series_room once and returns persisted server configuration', async () => {
    const rpc = vi.fn().mockResolvedValue({
      ok: true,
      data: { id: 'room-uuid', room_name: 'Phòng Supabase', best_of: 5, visibility: 'private', play_style: 'fun', allocation_mode: 'random' },
    })
    vi.resetModules()
    vi.doMock('./supabase/roomMutations', () => ({ rpc }))
    const { supabaseRoomsAdapter } = await import('./supabase')
    const config = { ...DEFAULT_ROOM_CONFIG, name: 'Phòng Supabase' }

    await expect(supabaseRoomsAdapter.createRoomWithConfig(config)).resolves.toEqual({
      roomId: 'room-uuid',
      status: 'OPEN',
      config,
      configPersisted: true,
    })
    expect(rpc).toHaveBeenCalledExactlyOnceWith('create_series_room', { p_name: 'Phòng Supabase', p_best_of: 5, p_visibility: 'private', p_style: 'fun', p_mode: 'random' })
  })
})
