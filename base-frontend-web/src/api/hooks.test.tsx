import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearDataCache, useResource } from './hooks'

function Probe({ load, cacheKey }: { load: () => Promise<string>; cacheKey: string }) {
  const state = useResource(cacheKey, 'empty', () => load())
  return (
    <div>
      <span>{state.status}</span>
      <span>{state.data}</span>
      <button onClick={state.retry}>retry</button>
    </div>
  )
}

afterEach(cleanup)

describe('data hooks', () => {
  it('không khôi phục dữ liệu riêng từ request cũ sau logout', async () => {
    let finish!: (value: string) => void
    const load = vi.fn(() => new Promise<string>(resolve => { finish = resolve }))
    render(<MemoryRouter><Probe cacheKey="private" load={load} /></MemoryRouter>)
    clearDataCache()
    await act(async () => finish('private-old-user'))
    expect(screen.queryByText('private-old-user')).toBeNull()
  })
  it('chuyển loading → ready', async () => {
    let resolve!: (value: string) => void
    const load = vi.fn(() => new Promise<string>((done) => { resolve = done }))
    render(<MemoryRouter><Probe cacheKey="hook-ready" load={load} /></MemoryRouter>)
    expect(screen.getByText('loading')).toBeTruthy()
    await act(async () => resolve('done'))
    expect(screen.getByText('ready')).toBeTruthy()
    expect(screen.getByText('done')).toBeTruthy()
  })

  it('chuyển error → retry → ready', async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce('recovered')
    render(<MemoryRouter><Probe cacheKey="hook-retry" load={load} /></MemoryRouter>)
    await waitFor(() => expect(screen.getByText('error')).toBeTruthy())
    await userEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(screen.getByText('ready')).toBeTruthy())
    expect(screen.getByText('recovered')).toBeTruthy()
    expect(load).toHaveBeenCalledTimes(2)
  })
})
