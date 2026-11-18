export class SupabaseAdapterError extends Error {
  readonly code?: string
  readonly status?: number

  constructor(message: string, code?: string, status?: number) {
    super(message)
    this.name = 'SupabaseAdapterError'
    this.code = code
    this.status = status
  }
}

const authMessages: Array<[RegExp, string]> = [
  [/invalid login|invalid credentials/i, 'Email hoặc mật khẩu không đúng.'],
  [/email not confirmed|not confirmed/i, 'Email chưa được xác minh. Hãy nhập mã OTP đã gửi.'],
  [/rate limit|too many|over_email_send_rate_limit/i, 'Bạn thao tác quá nhiều lần. Vui lòng thử lại sau.'],
  [/expired|token.*invalid|otp.*invalid/i, 'Mã OTP không đúng hoặc đã hết hạn.'],
  [/already registered|user already/i, 'Email này đã được đăng ký.'],
  [/password/i, 'Mật khẩu không hợp lệ.'],
]

export function mapSupabaseAuthError(error: unknown): SupabaseAdapterError {
  const raw = error instanceof Error ? error.message : String(error ?? '')
  const message = authMessages.find(([pattern]) => pattern.test(raw))?.[1]
    ?? 'Không thể xác thực lúc này. Vui lòng thử lại.'
  const candidate = error as { code?: string; status?: number }
  return new SupabaseAdapterError(message, candidate?.code, candidate?.status)
}

export function throwSupabase(error: unknown): never {
  const candidate = error as { message?: string; code?: string; status?: number }
  throw new SupabaseAdapterError(candidate?.message || 'Supabase request failed', candidate?.code, candidate?.status)
}
