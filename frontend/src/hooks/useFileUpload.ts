import { useState, useRef, useCallback } from 'react'
import { validateFile, uploadFile, extractUploadError } from '@/services/uploadService'
import type { Attachment } from '@/types'

interface UseFileUploadOptions {
  activeConversationId: number | null
}

export function useFileUpload({ activeConversationId }: UseFileUploadOptions) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const processFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return

      const validation = validateFile(file)
      if (!validation.valid) {
        setError(validation.error ?? '文件无效')
        return
      }

      setError('')
      setUploading(true)

      try {
        const { attachment } = await uploadFile(file, activeConversationId)
        setAttachments((prev) => [...prev, attachment])
      } catch (err) {
        setError(extractUploadError(err))
      } finally {
        setUploading(false)
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    },
    [activeConversationId],
  )

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    void processFile(e.target.files?.[0])
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    void processFile(e.dataTransfer.files[0])
  }

  function removeAttachment(id: number) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }

  function clearAttachments() {
    setAttachments([])
  }

  function openFilePicker() {
    fileInputRef.current?.click()
  }

  const attachmentIds = attachments.map((a) => a.id)

  return {
    fileInputRef,
    attachments,
    attachmentIds,
    uploading,
    error,
    handleInputChange,
    handleDrop,
    removeAttachment,
    clearAttachments,
    openFilePicker,
  }
}
