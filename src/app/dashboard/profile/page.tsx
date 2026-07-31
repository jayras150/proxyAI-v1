// ProxyAI — Profile (shell placeholder, Milestone 5)

import { PlaceholderPage } from '@/components/layout/placeholder-page'

export default function ProfilePage() {
  return (
    <PlaceholderPage
      title="Profile"
      description="Your name, email, avatar, language and timezone."
      milestone="M5"
      emptyTitle="Profile editing coming in Milestone 5"
      emptyDescription="Profile fields backed by PATCH /v1/me will land here."
    />
  )
}
