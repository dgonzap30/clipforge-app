import { createHmac, timingSafeEqual } from 'crypto'
import { env } from './env'

const STATE_TTL_MS = 10 * 60 * 1000 // 10 minutes

function secret(): string {
  const s = process.env.OAUTH_STATE_SECRET || env.JWT_SECRET
  if (!s || s === 'dev-secret-change-in-production') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'OAUTH_STATE_SECRET (or JWT_SECRET) must be set to a real secret in production'
      )
    }
  }
  return s
}

function b64urlEncode(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64urlDecode(input: string): Buffer {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4))
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64')
}

function hmac(payload: string): string {
  return b64urlEncode(createHmac('sha256', secret()).update(payload).digest())
}

export interface OAuthStatePayload {
  userId: string
  platform: 'youtube' | 'tiktok' | 'instagram'
  nonce: string
  iat: number
}

export function signOAuthState(userId: string, platform: OAuthStatePayload['platform']): string {
  const payload: OAuthStatePayload = {
    userId,
    platform,
    nonce: crypto.randomUUID(),
    iat: Date.now(),
  }
  const encoded = b64urlEncode(JSON.stringify(payload))
  return `${encoded}.${hmac(encoded)}`
}

export function verifyOAuthState(
  state: string,
  expectedPlatform: OAuthStatePayload['platform']
): OAuthStatePayload | null {
  const parts = state.split('.')
  if (parts.length !== 2) return null
  const [encoded, sig] = parts

  const expected = hmac(encoded)
  const a = Buffer.from(sig)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  let payload: OAuthStatePayload
  try {
    payload = JSON.parse(b64urlDecode(encoded).toString('utf8'))
  } catch {
    return null
  }

  if (payload.platform !== expectedPlatform) return null
  if (typeof payload.iat !== 'number') return null
  if (Date.now() - payload.iat > STATE_TTL_MS) return null
  if (!payload.userId || typeof payload.userId !== 'string') return null

  return payload
}
