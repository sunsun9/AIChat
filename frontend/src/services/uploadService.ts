/**
 * services/uploadService.ts
 *
 * 文件校验规则与上传编排逻辑。
 * 支持 .txt / .pdf / 图片（.jpg .jpeg .png .gif .webp）
 */
import axios from 'axios'
import { uploadApi } from '@/api'
import type { Attachment, ApiError } from '@/types'

// ── 校验规则 ───
const ALLOWED_EXTENSIONS = ['.txt', '.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp']
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024 // 10 MB

/** 文件类型分类（用于 UI 显示图标等） */
export type FileCategory = 'text' | 'pdf' | 'image'

export function getFileCategory(filename: string): FileCategory {
  const ext = filename.toLowerCase().split('.').pop() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return 'image'
  return 'text'
}

export interface ValidationResult {
  valid: boolean
  error?: string
}

export function validateFile(file: File): ValidationResult {
  const hasAllowedExtension = ALLOWED_EXTENSIONS.some((ext) =>
    file.name.toLowerCase().endsWith(ext),
  )
  if (!hasAllowedExtension) {
    return { valid: false, error: `支持格式：${ALLOWED_EXTENSIONS.join('、')}` }
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      error: `文件大小不能超过 ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB`,
    }
  }
  return { valid: true }
}

// ── 上传操作 ────
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

/** 从上传错误中提取用户友好的提示信息。 */
export function extractUploadError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const msg = (err.response?.data as Partial<ApiError>)?.msg
    return msg ?? '上传失败，请重试'
  }
  if (err instanceof Error) return err.message
  return '上传失败，请重试'
}