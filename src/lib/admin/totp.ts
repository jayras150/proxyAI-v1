// ProxyAI — TOTP Authentication (Admin)
// Uses speakeasy for TOTP generation and verification.

import speakeasy from 'speakeasy'
import { prisma } from '@/lib/prisma'

const TOTP_ISSUER = 'ProxyAI'
const TOTP_LABEL_PREFIX = 'ProxyAI Admin'

/**
 * Generate a TOTP secret for a user.
 * Returns the base32-encoded secret and the otpauth URL for QR code.
 */
export function generateTotpSecret(email: string): {
  secret: string
  otpauthUrl: string
} {
  const secret = speakeasy.generateSecret({
    length: 20,
    name: `${TOTP_LABEL_PREFIX}: ${email}`,
    issuer: TOTP_ISSUER,
  })

  if (!secret.base32 || !secret.otpauth_url) {
    throw new Error('Failed to generate TOTP secret.')
  }

  return {
    secret: secret.base32,
    otpauthUrl: secret.otpauth_url,
  }
}

/**
 * Verify a TOTP token against a stored secret.
 * Uses a 30-second window with 1 step tolerance (adjacent window ok).
 */
export function verifyTotpToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1, // ±30 seconds tolerance
  })
}

/**
 * Enable TOTP for a user — store the secret.
 */
export async function enableTotp(userId: string, secret: string): Promise<void> {
  await prisma.user.update({
    where: { id: userId },
    data: { totpSecret: secret },
  })
}

/**
 * Check if a user has TOTP enabled.
 */
export async function hasTotpEnabled(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { totpSecret: true },
  })
  return !!user?.totpSecret
}
