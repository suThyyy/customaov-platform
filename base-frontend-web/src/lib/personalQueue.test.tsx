import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import { mapOpenRoomSnapshot } from '../api/supabase/room'
import type { OpenRoomSnapshotPayload } from '../api/supabase/types'
import { PersonalQueueStatus } from '../components/domain/open-room/PersonalQueueStatus'
afterEach(cleanup)
const payload: OpenRoomSnapshotPayload = {
 room:{id:'r',host_user_id:'host',invite_code:'code',status:'open',current_round_no:0,current_round_state:'idle',version:1,created_at:'',closed_at:null},
 members:[['a','u','active'],['b','v','active'],['c','w','left']].map(([id,user_id,status])=>({id,room_id:'r',user_id,status:status as 'active'|'left',member_kind:'account',display_name:id,joined_at:'',left_at:null})),
 queue:[['a',90],['b',20],['c',10]].map(([member_id,queue_seq])=>({id:String(member_id),room_id:'r',member_id:String(member_id),queue_seq:Number(queue_seq),status:'waiting',joined_at:'',selected_round_no:null})),currentPlayers:[]
}
it('shows sorted ordinal and active waiting size, updates after removal/reorder and hides stale positions',()=>{
 const snapshot=mapOpenRoomSnapshot(payload,'u')
 const {rerender}=render(<PersonalQueueStatus snapshot={snapshot} userId="u" current />)
 expect(screen.getByRole('status').textContent).toContain('2/2')
 rerender(<PersonalQueueStatus snapshot={{...snapshot,waiting:snapshot.waiting.filter(p=>p.memberId==='a')}} userId="u" current />)
 expect(screen.getByRole('status').textContent).toContain('1/1')
 rerender(<PersonalQueueStatus snapshot={snapshot} userId="u" current={false} />)
 expect(screen.getByRole('status').textContent).toContain('Đang xác nhận')
 expect(screen.getByRole('status').textContent).not.toContain('2/2')
})
it('distinguishes removed, selected, off-queue and closed states without a position',()=>{
 const snapshot=mapOpenRoomSnapshot(payload,'u')
 const {rerender}=render(<PersonalQueueStatus snapshot={snapshot} userId="w" current />)
 expect(screen.getByRole('status').textContent).toContain('không có tư cách')
 rerender(<PersonalQueueStatus snapshot={{...snapshot,selected:[snapshot.waiting[1]]}} userId="u" current />)
 expect(screen.getByRole('status').textContent).toContain('đội hình')
 rerender(<PersonalQueueStatus snapshot={{...snapshot,waiting:[]}} userId="u" current />)
 expect(screen.getByRole('status').textContent).toContain('hiện không ở hàng chờ')
 rerender(<PersonalQueueStatus snapshot={{...snapshot,room:{...snapshot.room,status:'closed'}}} userId="u" current />)
 expect(screen.getByRole('status').textContent).toContain('Phòng đã đóng')
})
