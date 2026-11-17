import { endpoints } from './endpoints'

export const roomActions = {
  join: (...args: Parameters<typeof endpoints.joinRoom>) => endpoints.joinRoom(...args),
  leave: (...args: Parameters<typeof endpoints.leaveRoom>) => endpoints.leaveRoom(...args),
  split: (...args: Parameters<typeof endpoints.splitRoom>) => endpoints.splitRoom(...args),
  moveMember: (...args: Parameters<typeof endpoints.moveRoomMember>) => endpoints.moveRoomMember(...args),
  kickMember: (...args: Parameters<typeof endpoints.kickRoomMember>) => endpoints.kickRoomMember(...args),
  export: (...args: Parameters<typeof endpoints.exportRoom>) => endpoints.exportRoom(...args),
  randomLanes: (...args: Parameters<typeof endpoints.randomLanes>) => endpoints.randomLanes(...args),
  updateMe: (...args: Parameters<typeof endpoints.updateRoomMe>) => endpoints.updateRoomMe(...args),
  result: (...args: Parameters<typeof endpoints.roomResult>) => endpoints.roomResult(...args),
  createMessage: (...args: Parameters<typeof endpoints.createMessage>) => endpoints.createMessage(...args),
}

export const registrationActions = {
  create: (...args: Parameters<typeof endpoints.createRegistration>) => endpoints.createRegistration(...args),
  approve: (...args: Parameters<typeof endpoints.approveRegistration>) => endpoints.approveRegistration(...args),
  reject: (...args: Parameters<typeof endpoints.rejectRegistration>) => endpoints.rejectRegistration(...args),
  remove: (...args: Parameters<typeof endpoints.deleteRegistration>) => endpoints.deleteRegistration(...args),
}
