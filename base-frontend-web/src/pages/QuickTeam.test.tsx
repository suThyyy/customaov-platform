import { fireEvent, render, screen, within, cleanup } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import QuickTeam from './QuickTeam'
afterEach(() => { cleanup(); vi.restoreAllMocks() })
async function fill() {
  render(<QuickTeam />)
  for(let i=1;i<=10;i++) fireEvent.change(screen.getByLabelText(`Người chơi ${i}`,{exact:true}),{target:{value:`Bạn ${i}`}})
  fireEvent.click(screen.getByRole('button',{name:'Chia đội'}))
}
it('supports guest generation, repeated swap, stale results, regeneration and confirmed reset',async()=>{
  await fill()
  const region=screen.getByRole('region',{name:'Kết quả chia đội'})
  const options=within(region).getAllByRole('button',{name:/^Bạn/})
  expect(options).toHaveLength(10)
  fireEvent.click(options[0]); fireEvent.click(options[5]); fireEvent.click(screen.getByRole('button',{name:'Đổi chỗ'}))
  expect(screen.getByText(/Đã điều chỉnh thủ công/)).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Người chơi 1',{exact:true}),{target:{value:'Tên mới'}})
  expect(screen.getByText('Dữ liệu đã thay đổi — cần chia lại')).toBeTruthy()
  expect((screen.getByRole('button',{name:'Sao chép kết quả'}) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button',{name:'Chia lại'}))
  expect(screen.queryByText('Dữ liệu đã thay đổi — cần chia lại')).toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Đặt lại'})); fireEvent.click(screen.getByRole('button',{name:'Hủy'}))
  expect(screen.getByText('Tên mới')).toBeTruthy()
  fireEvent.click(screen.getByRole('button',{name:'Đặt lại'})); fireEvent.click(screen.getByRole('button',{name:'Xác nhận xóa'}))
  expect((screen.getByLabelText('Người chơi 1',{exact:true}) as HTMLInputElement).value).toBe('')
})
it('reports clipboard success only after success and exposes selectable fallback on failure',async()=>{
  const writeText=vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText}})
  await fill(); fireEvent.click(screen.getByRole('button',{name:'Sao chép kết quả'}))
  await screen.findByText('Đã sao chép kết quả.'); expect(writeText).toHaveBeenCalledWith(expect.stringContaining('Đội Xanh'))
  writeText.mockRejectedValue(new Error('denied')); fireEvent.click(screen.getByRole('button',{name:'Sao chép kết quả'}))
  expect(await screen.findByLabelText('Nội dung chia sẻ')).toBeTruthy()
})
