import { asset } from '../lib/asset'
import type { Player } from './types'

const p = (id: string, name: string, extra: Partial<Player> = {}): Player => ({
  id,
  name,
  avatar: asset(`av-${id}.png`),
  ...extra,
})

export const players = {
  suthy: p('suthy', 'suthy', { level: 42, crowned: true }),
  vanhh: p('vanhh', 'Vanhh'),
  minz: p('minz', 'Minz'),
  khoaneo: p('khoaneo', 'KhoaNeo'),
  tine: p('tine', 'TiNè'),
  hieukm: p('hieukm', 'Hieukm'),
  rika: p('rika', 'Rika'),
  long2k: p('long2k', 'Long2k'),
  phuct: p('phuct', 'PhucT'),
  nanm: p('nanm', 'Nanm'),
} satisfies Record<string, Player>

/** Người dùng đang đăng nhập (giả lập) */
export const currentUser: Player = players.suthy
