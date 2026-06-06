/**
 * services/uploadService.ts
 *
 * 文件校验规则与上传编排逻辑。
 * 集中管理规则便于统一修改，保持组件层轻量。
 */
import axios from 'axios'
import { uploadApi } from '@/api'
import type { Attachment, ApiError } from '@/types'

// ── 校验规则 ───
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
    // 新统一错误格式：{ code, msg, data: null }
    const msg = (err.response?.data as Partial<ApiError>)?.msg
    return msg ?? '上传失败，请重试'
  }
  if (err instanceof Error) return err.message
  return '上传失败，请重试'
}