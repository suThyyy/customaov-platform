import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { RoomConfig } from '../../api'
import { RoomConfigPanel } from './RoomConfigPanel'

const SAMPLE_CONFIG: RoomConfig = {
  name: 'Kèo giao hữu — Team A vs Team B',
  series: 'BO5',
  access: 'private',
  playStyle: 'fun',
  splitTool: 'random',
}

afterEach(cleanup)

describe('RoomConfigPanel', () => {
  it('hiển thị đầu panel, nhóm 1 khoá, host đổi được nhóm 2 và nhóm 3', async () => {
    const user = userEvent.setup()
    const onUpdate = vi.fn()
    render(
      <RoomConfigPanel
        config={SAMPLE_CONFIG}
        configPersisted
        isHost
        playerCount={3}
        onUpdate={onUpdate}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Kèo giao hữu — Team A vs Team B' })).toBeTruthy()
    expect(screen.getByText('BO5 · Private · 3/10 Players')).toBeTruthy()
    expect(screen.getByText('OPEN')).toBeTruthy()
    expect(screen.getByText('Thông tin phòng')).toBeTruthy()
    expect(screen.getByText('Thông tin đã được cố định sau khi tạo phòng.')).toBeTruthy()

    const fun = screen.getByRole('radio', { name: 'Fun' })
    const tryhard = screen.getByRole('radio', { name: 'Tryhard' })
    const random = screen.getByRole('radio', { name: 'Random' })
    const tier = screen.getByRole('radio', { name: 'Tier' })
    const rank = screen.getByRole('radio', { name: 'Rank' })

    expect(fun.getAttribute('aria-checked')).toBe('true')
    expect(random.getAttribute('aria-checked')).toBe('true')
    expect(tryhard.hasAttribute('disabled')).toBe(false)
    expect(tier.hasAttribute('disabled')).toBe(false)

    await user.click(tryhard)
    expect(onUpdate).toHaveBeenCalledWith({ playStyle: 'tryhard', splitTool: 'random' })

    await user.click(tier)
    expect(onUpdate).toHaveBeenCalledWith({ playStyle: 'fun', splitTool: 'tier' })

    await user.click(rank)
    expect(onUpdate).toHaveBeenCalledWith({ playStyle: 'fun', splitTool: 'rank' })
  })

  it('khách / không phải host không sửa được nhóm 2 và nhóm 3', () => {
    render(
      <RoomConfigPanel
        config={SAMPLE_CONFIG}
        configPersisted
        isHost={false}
        playerCount={10}
      />,
    )

    for (const label of ['Fun', 'Tryhard', 'Random', 'Tier', 'Rank']) {
      expect(screen.getByRole('radio', { name: label }).hasAttribute('disabled')).toBe(true)
    }
  })

  it('supabase configPersisted:false hiện ghi chú và vô hiệu hoá segmented controls', () => {
    const { rerender } = render(
      <RoomConfigPanel
        config={SAMPLE_CONFIG}
        configPersisted={false}
        isHost
        playerCount={0}
      />,
    )

    expect(screen.getByText('Cấu hình chưa được lưu lên server (chờ backend)')).toBeTruthy()
    expect(screen.getByText('BO5 · Private · 0/10 Players')).toBeTruthy()
    for (const label of ['Fun', 'Tryhard', 'Random', 'Tier', 'Rank']) {
      expect(screen.getByRole('radio', { name: label }).hasAttribute('disabled')).toBe(true)
    }

    rerender(
      <RoomConfigPanel
        config={null}
        configPersisted={false}
        isHost
        playerCount={0}
        fallbackTitle="Phòng #ABC123"
      />,
    )
    expect(screen.getByRole('heading', { name: 'Phòng #ABC123' })).toBeTruthy()
    expect(screen.getByText('Chưa có cấu hình · 0/10 Players')).toBeTruthy()
  })
})
