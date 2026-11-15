/** WebSocket giả cho test: ghi lại tin gửi đi, cho test chủ động mở/đóng/đẩy tin. */
export class FakeWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN = 1
  static readonly CLOSING = 2
  static readonly CLOSED = 3
  static instances: FakeWebSocket[] = []

  static last(): FakeWebSocket {
    const socket = FakeWebSocket.instances.at(-1)
    if (!socket) throw new Error('Chưa có WebSocket nào được mở')
    return socket
  }

  readonly url: string
  readyState = FakeWebSocket.CONNECTING
  sent: unknown[] = []
  closed = false
  onopen: ((event: Event) => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onclose: ((event: Event) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  constructor(url: string) {
    this.url = url
    FakeWebSocket.instances.push(this)
  }

  send(data: string) {
    this.sent.push(JSON.parse(data))
  }

  close() {
    this.closed = true
    this.readyState = FakeWebSocket.CLOSED
  }

  /** Server chấp nhận kết nối */
  open() {
    this.readyState = FakeWebSocket.OPEN
    this.onopen?.(new Event('open'))
  }

  /** Server đẩy một tin JSON */
  emit(data: unknown) {
    this.onmessage?.(new MessageEvent('message', { data: JSON.stringify(data) }))
  }

  /** Mất kết nối phía server */
  drop() {
    this.readyState = FakeWebSocket.CLOSED
    this.onclose?.(new Event('close'))
  }
}
