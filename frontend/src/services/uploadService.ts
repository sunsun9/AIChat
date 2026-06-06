/**
 * services/uploadService.ts
 *
 * 文件验证规则和上传编排。
 * 将这些逻辑保留在此处可以使组件保持轻量，
 * 并且规则易于在同一个地方集中更新。
 */
import axios from 'axios'
import { uploadApi } from '@/api'
import type { Attachment } from '@/types'

// ── 验证规则 ──
const ALLOWED_EXTENSIONS = ['.txt']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateFile(file: File): ValidationResult {
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  )
  if (!hasAllowedExtension) {
    return { valid: false, error: `只支持 ${ALLOWED_EXTENSIONS.join('、')} 格式的文件` }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `文件大小不能超过 ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`,
    }
  }
  return { valid: true }
}

// ── 上传操作 ───
export interface UploadResult {
  attachment: Attachment
}

export async function uploadFile(
  file: File,
  conversationId: number | null,
): Promise<UploadResult> {
  const { data } = await uploadApi.uploadFile(file, conversationId)
  return {
    attachment: {
      id: data.attachment_id,
      original_filename: data.original_filename,
      file_size: data.file_size,
      content_preview: data.content_preview,
    },
  }
}

export function extractUploadError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const detail = (err.response?.data as { detail?: string })?.detail
    return detail ?? '上传失败，请重试'
  }
  return '上传失败，请重试'
}