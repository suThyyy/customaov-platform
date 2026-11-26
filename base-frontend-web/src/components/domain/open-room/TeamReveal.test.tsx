import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TeamReveal } from './TeamReveal'
import { revealDuration, revealKeyOf, type RevealEntry } from './revealPlan'

const entries: RevealEntry[] = Array.from({ length: 10 }, (_, i) => ({ id: `m${i}`, team: i < 5 ? 'a' : 'b', slot: (i % 5) + 1, primary: `Player ${i}` }))
let keySeq = 0
const freshKey = () => revealKeyOf(`test-${keySeq++}`, entries)

function stubMotion(reduce: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: reduce && query.includes('reduce'), media: query, addEventListener() {}, removeEventListener() {} }))
}
const renderReveal = (key: string | null, variant: 'roulette' | 'meteor' = 'roulette') => render(
  <TeamReveal entries={entries} revealKey={key} variant={variant} title="đội hình thử"><p>Danh sách thật</p></TeamReveal>,
)

beforeEach(() => { window.sessionStorage.clear() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers() })

describe('TeamReveal', () => {
  it('plays a roulette stage, then hands back the authoritative content on its timer', () => {
    vi.useFakeTimers()
    stubMotion(false)
    renderReveal(freshKey())
    expect(screen.getByRole('region', { name: /Công bố đội hình thử/ }).dataset.reveal).toBe('roulette')
    expect(screen.queryByText('Danh sách thật')).toBeNull()
    act(() => { vi.advanceTimersByTime(revealDuration('roulette', 10)) })
    expect(screen.getByText('Danh sách thật')).toBeTruthy()
    expect(screen.getByRole('status').textContent).toMatch(/Đã công bố/)
  })
  it('renders meteor variant and Skip ends it immediately', () => {
    stubMotion(false)
    renderReveal(freshKey(), 'meteor')
    expect(screen.getByRole('region', { name: /Công bố/ }).dataset.reveal).toBe('meteor')
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua hiệu ứng' }))
    expect(screen.queryByRole('region', { name: /Công bố/ })).toBeNull()
    expect(screen.getByText('Danh sách thật')).toBeTruthy()
  })
  it('respects reduced motion and environments without matchMedia', () => {
    stubMotion(true)
    renderReveal(freshKey())
    expect(screen.getByText('Danh sách thật')).toBeTruthy()
    cleanup()
    vi.unstubAllGlobals()
    renderReveal(freshKey())
    expect(screen.queryByRole('region', { name: /Công bố/ })).toBeNull()
  })
  it('plays once per authoritative key: re-render, remount and refresh do not replay', () => {
    stubMotion(false)
    const key = freshKey()
    const first = renderReveal(key)
    fireEvent.click(screen.getByRole('button', { name: 'Bỏ qua hiệu ứng' }))
    first.rerender(<TeamReveal entries={[...entries]} revealKey={key} variant="roulette" title="đội hình thử"><p>Danh sách thật</p></TeamReveal>)
    expect(screen.queryByRole('region', { name: /Công bố/ })).toBeNull()
    cleanup()
    renderReveal(key)
    expect(screen.queryByRole('region', { name: /Công bố/ })).toBeNull()
    expect(window.sessionStorage.length).toBeGreaterThan(0)
  })
  it('does not start without a complete authoritative lineup', () => {
    stubMotion(false)
    renderReveal(null)
    expect(screen.getByText('Danh sách thật')).toBeTruthy()
  })
})
