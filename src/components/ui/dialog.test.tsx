// @vitest-environment jsdom
// ProxyAI — Dialog accessibility tests (focus trap, Esc, backdrop)

import { describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog } from '@/components/ui/dialog'

function renderDialog(onClose = vi.fn()) {
  return render(
    <Dialog open onClose={onClose} title="Create API key" description="Name your key.">
      <input aria-label="Key name" placeholder="My key" />
      <button type="button">Save</button>
    </Dialog>
  )
}

describe('Dialog', () => {
  it('renders title, description and labelled dialog semantics', () => {
    renderDialog()
    const dialog = screen.getByRole('dialog', { name: 'Create API key' })
    expect(dialog).toBeInTheDocument()
    expect(screen.getByText('Name your key.')).toBeInTheDocument()
  })

  it('moves focus into the dialog on open', async () => {
    renderDialog()
    await waitFor(() => {
      expect(screen.getByLabelText('Close dialog')).toHaveFocus()
    })
  })

  it('closes on Escape', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderDialog(onClose)
    await user.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes when the backdrop is clicked', async () => {
    const onClose = vi.fn()
    const user = userEvent.setup()
    renderDialog(onClose)
    await user.click(screen.getByRole('dialog', { name: 'Create API key' }).parentElement!)
    // Click on the backdrop (first child of the fixed overlay).
    const overlay = screen.getByRole('dialog', { name: 'Create API key' }).parentElement!.firstChild as HTMLElement
    await user.click(overlay)
    expect(onClose).toHaveBeenCalled()
  })

  it('traps focus: Tab from the last element cycles back to the first', async () => {
    const user = userEvent.setup()
    renderDialog()
    const closeButton = screen.getByLabelText('Close dialog')
    closeButton.focus()
    await user.tab()
    await user.tab()
    // After the third Tab we should wrap back to the close button.
    await user.tab()
    await waitFor(() => {
      expect(screen.getByLabelText('Close dialog')).toHaveFocus()
    })
  })

  it('returns nothing when closed', () => {
    const { container } = render(
      <Dialog open={false} onClose={() => {}} title="Hidden">
        <p>Not visible</p>
      </Dialog>
    )
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
  })
})
