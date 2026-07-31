// ProxyAI Auth Types
// Blueprint Reference: Sprint 6 — Authentication Architecture

export interface JwtPayload {
  sub: string       // user id
  email: string
  role: string
  type: 'access' | 'refresh'
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number  // access token expiry (unix ms)
}

export interface UserProfile {
  id: string
  email: string
  name: string | null
  role: string
  status: string
  createdAt: string
}
