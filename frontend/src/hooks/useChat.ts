import { useState, useRef, useEffect, useCallback } from 'react'
import { useChatStore } from '@/store/chatStore'

const MAX_TEXTAREA_HEIGHT = 180

export function useChat() {
  const { sending, sendMessage, error, clearError } = useChatStore()

  const [text, setText] = useState('')
  const textRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }, [text])

  const canSend = text.trim().length > 0 && !sending

  const handleSend = useCallback(
    async (attachmentIds: number[] = []) => {
      if (!canSend) return
      const question = text.trim()
      setText('')
      await sendMessage({ question, attachmentIds })
    },
    [canSend, text, sendMessage],
  )

  return {
    text,
    setText,
    textRef,
    sending,
    canSend,
    error,
    clearError,
    handleSend,
  }
}