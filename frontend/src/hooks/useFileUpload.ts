import { useState, useRef, useCallback } from 'react'
import { validateFile, uploadFile, extractUploadError } from '@/services/uploadService'
import { uploadApi } from '@/api'
import type { Attachment } from '@/types'

interface UseFileUploadOptions {
  activeConversationId: number | null
}

/** 静默调用服务端删除接口，失败只记日志不影响 UI */
async function deleteOnServer(id: number) {
  try {
    await uploadApi.deleteAttachment(id)
  } catch (err) {
    console.error('[useFileUpload] 删除附件失败, id=', id, err)
  }
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

  /** 点击附件 × 时：立即从 UI 移除，同时通知服务端删除 */
  function removeAttachment(id: number) {
    setAttachments((prev) => prev.filter((a) => a.id !== id))
    void deleteOnServer(id)
  }

  /**
   * 主动放弃所有待发附件（折叠面板 / 切换会话时调用）。
   * 立即清空 UI，同时批量通知服务端删除，避免孤儿文件残留。
   */
  const discardAllAttachments = useCallback(() => {
    setAttachments((prev) => {
      prev.forEach((a) => void deleteOnServer(a.id))
      return []
    })
  }, [])

  /** 发送成功后调用：仅清空本地状态，不删服务端（服务端已关联到消息） */
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
    discardAllAttachments,
    openFilePicker,
  }
}