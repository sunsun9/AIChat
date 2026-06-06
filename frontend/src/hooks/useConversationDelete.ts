import { useState, useCallback } from 'react'

const CONFIRM_TIMEOUT_MS = 3_000

export function useConversationDelete(
  onDelete: (id: number) => Promise<void>,
) {
  const [pendingId, setPendingId] = useState<number | null>(null)

  const requestDelete = useCallback(
    async (e: React.MouseEvent, id: number) => {
      e.stopPropagation()

      if (pendingId === id) {
        // Second click — confirmed
        await onDelete(id)
        setPendingId(null)
      } else {
        // First click — arm the confirmation
        setPendingId(id)
        setTimeout(() => setPendingId(null), CONFIRM_TIMEOUT_MS)
      }
    },
    [pendingId, onDelete],
  )

  return { pendingId, requestDelete }
}
