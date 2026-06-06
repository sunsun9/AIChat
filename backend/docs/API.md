# 接口文档

> 基础地址：`http://localhost:8000`
> 认证方式：除登录和注册接口外，所有接口需在请求头中携带 `Authorization: Bearer <token>`

## 统一响应格式

> **注意**：本后端基于 FastAPI 开发，接口响应直接返回业务数据，**不使用统一包装格式**，HTTP 状态码即为业务状态。错误信息通过 `detail` 字段描述。

**成功响应示例**（直接返回数据）：

```json
{
  "id": 1,
  "username": "zhangsan",
  "role": "normal"
}
```

**错误响应示例**：

```json
{
  "detail": "Username already taken"
}
```

---

## 一、认证模块

### 1.1 注册

- **URL**: `POST /api/v1/auth/register`
- **请求体**:

```json
{
  "username": "zhangsan",
  "email": "zhangsan@example.com",
  "password": "mypassword",
  "role": "normal"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名，3～50 个字符 |
| email | string | 是 | 邮箱地址，全局唯一 |
| password | string | 是 | 密码，至少 6 个字符 |
| role | string | 否 | 用户角色：`normal`（默认）/ `premium` |

- **成功响应** (201):

```json
{
  "id": 3,
  "username": "zhangsan",
  "email": "zhangsan@example.com",
  "role": "normal",
  "is_active": true,
  "created_at": "2026-06-06T08:00:00Z"
}
```

- **失败响应**:

| 状态码 | 示例 |
|--------|------|
| 409 | `{ "detail": "Username already taken" }` |
| 409 | `{ "detail": "Email already registered" }` |
| 422 | `{ "detail": [{ "msg": "Password must be at least 6 characters" }] }` |

---

### 1.2 登录

- **URL**: `POST /api/v1/auth/login`
- **请求体**:

```json
{
  "username": "zhangsan",
  "password": "mypassword"
}
```

- **成功响应** (200):

```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIs...",
  "token_type": "bearer",
  "user": {
    "id": 3,
    "username": "zhangsan",
    "email": "zhangsan@example.com",
    "role": "normal",
    "is_active": true,
    "created_at": "2026-06-06T08:00:00Z"
  }
}
```

> Token 有效期默认 **60 分钟**，后续请求将其放入请求头：`Authorization: Bearer <access_token>`

- **失败响应**:

| 状态码 | 示例 |
|--------|------|
| 401 | `{ "detail": "Incorrect username or password" }` |
| 403 | `{ "detail": "Account is deactivated" }` |

---

### 1.3 获取当前用户信息

- **URL**: `GET /api/v1/auth/me`
- **成功响应** (200):

```json
{
  "id": 3,
  "username": "zhangsan",
  "email": "zhangsan@example.com",
  "role": "normal",
  "is_active": true,
  "created_at": "2026-06-06T08:00:00Z"
}
```

- **失败响应**:

| 状态码 | 示例 |
|--------|------|
| 401 | `{ "detail": "Token invalid or expired" }` |

---

## 二、问答模块

### 2.1 发起问答

- **URL**: `POST /api/v1/chat/ask`
- **说明**: 向 AI 提问，支持多轮对话与文件附件引用（附件功能仅限 premium 用户）
- **请求体**:

```json
{
  "conversation_id": null,
  "question": "什么是机器学习？",
  "attachment_ids": []
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| question | string | 是 | 用户提问内容，不可为空 |
| conversation_id | number \| null | 否 | 已有会话 ID；传 `null` 时自动创建新会话 |
| attachment_ids | number[] | 否 | 已上传附件的 ID 列表，默认 `[]`（仅 premium 用户可传） |

- **续会话携带附件示例**:

```json
{
  "conversation_id": 12,
  "question": "请根据文件中的数据给出总结",
  "attachment_ids": [5, 6]
}
```

- **成功响应** (200):

```json
{
  "conversation_id": 12,
  "message_id": 45,
  "answer": "根据您上传的文件，以下是数据摘要……",
  "used_attachments": [
    {
      "id": 5,
      "original_filename": "data.txt",
      "file_size": 2048,
      "content_preview": "第一行内容……",
      "created_at": "2026-06-06T08:05:00Z"
    }
  ]
}
```

**字段说明**:
- `conversation_id` — 当前会话 ID（新建或已有）
- `message_id` — AI 回答消息的数据库 ID
- `answer` — AI 生成的回答内容（Markdown 格式）
- `used_attachments` — 本次问答中实际读取的附件列表

- **失败响应**:

| 状态码 | 示例 |
|--------|------|
| 401 | `{ "detail": "Token invalid or expired" }` |
| 403 | `{ "detail": "File attachments are only available to premium users" }` |
| 404 | `{ "detail": "Conversation not found" }` |
| 502 | `{ "detail": "LLM service error: ..." }` |
| 503 | `{ "detail": "ANTHROPIC_API_KEY is not set." }` |

---

### 2.2 获取会话列表

- **URL**: `GET /api/v1/chat/conversations`
- **说明**: 返回当前用户所有会话，按最后更新时间倒序排列
- **成功响应** (200):

```json
[
  {
    "id": 12,
    "title": "什么是机器学习？…",
    "created_at": "2026-06-06T08:00:00Z",
    "updated_at": "2026-06-06T08:10:00Z",
    "message_count": 4
  },
  {
    "id": 11,
    "title": "Python 列表推导式的用法…",
    "created_at": "2026-06-05T14:30:00Z",
    "updated_at": "2026-06-05T14:35:00Z",
    "message_count": 2
  }
]
```

> `title` 由首条用户消息的前 40 个字符自动生成

---

### 2.3 获取会话详情

- **URL**: `GET /api/v1/chat/conversations/:id`
- **说明**: 返回指定会话的完整内容，包含所有消息记录
- **成功响应** (200):

```json
{
  "id": 12,
  "title": "什么是机器学习？…",
  "created_at": "2026-06-06T08:00:00Z",
  "updated_at": "2026-06-06T08:10:00Z",
  "message_count": 4,
  "messages": [
    {
      "id": 41,
      "role": "user",
      "content": "什么是机器学习？",
      "created_at": "2026-06-06T08:00:10Z",
      "attachments": []
    },
    {
      "id": 42,
      "role": "assistant",
      "content": "机器学习是人工智能的一个分支……",
      "created_at": "2026-06-06T08:00:15Z",
      "attachments": []
    }
  ]
}
```

**字段说明**:
- `messages[].role` — 消息角色：`user`（用户）/ `assistant`（AI）
- `messages[].attachments` — 该消息关联的附件列表，无附件时为 `[]`

- **失败响应**:

| 状态码 | 示例 |
|--------|------|
| 404 | `{ "detail": "Conversation not found" }` |

---

### 2.4 删除会话

- **URL**: `DELETE /api/v1/chat/conversations/:id`
- **说明**: 删除指定会话及其所有消息（级联删除）
- **成功响应** (200):

```json
{
  "message": "Conversation deleted successfully"
}
```

- **失败响应**:

| 状态码 | 示例 |
|--------|------|
| 404 | `{ "detail": "Conversation not found" }` |

---

## 三、文件上传模块

> ⚠️ 本模块**仅限 premium 角色用户**调用，普通用户访问将返回 `403 Forbidden`

### 3.1 上传文件

- **URL**: `POST /api/v1/upload/file`
- **认证**: 需要，且用户角色必须为 `premium`
- **Content-Type**: `multipart/form-data`
- **请求参数**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | `.txt` 格式文件，最大 10 MB |
| conversation_id | number | 否 | 关联到已有会话 ID；不传则自动创建新会话 |

- **curl 示例**:

```bash
curl -X POST http://localhost:8000/api/v1/upload/file \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/document.txt" \
  -F "conversation_id=12"
```

- **成功响应** (200):

```json
{
  "attachment_id": 5,
  "original_filename": "document.txt",
  "file_size": 2048,
  "content_preview": "这是文件的前 500 个字符……",
  "message": "File uploaded successfully"
}
```

**字段说明**:
- `attachment_id` — 附件 ID，在 `/chat/ask` 的 `attachment_ids` 中使用
- `content_preview` — 文件前 500 个字符的文本预览

- **失败响应**:

| 状态码 | 示例 |
|--------|------|
| 403 | `{ "detail": "This feature is only available to premium users" }` |
| 422 | `{ "detail": [{ "msg": "文件格式或大小不合规" }] }` |

---

## 四、系统

### 4.1 健康检查

- **URL**: `GET /health`
- **认证**: 无需认证
- **成功响应** (200):

```json
{
  "status": "ok",
  "service": "LLM Q&A Backend"
}
```

---

## 接口调用典型流程

```
1. POST /api/v1/auth/login          → 获取 token
          ↓
2. POST /api/v1/upload/file         → 获取 attachment_id（仅 premium 用户）
          ↓
3. POST /api/v1/chat/ask            → 提问（可携带 attachment_ids）
          ↓
4. GET  /api/v1/chat/conversations  → 查看会话列表
          ↓
5. GET  /api/v1/chat/conversations/:id  → 查看历史消息
          ↓
6. DELETE /api/v1/chat/conversations/:id → 删除会话
```

---

## 通用错误响应

| 状态码 | 说明 |
|--------|------|
| 401 | 未认证或 Token 已过期 |
| 403 | 权限不足（如普通用户访问 premium 接口） |
| 404 | 资源不存在或无访问权限 |
| 409 | 数据冲突（如用户名或邮箱已被注册） |
| 422 | 请求参数校验失败 |
| 502 | 上游 LLM 服务（Anthropic API）返回错误 |
| 503 | 服务配置缺失（如 API Key 未设置） |

错误响应格式:

```json
{
  "detail": "错误描述信息"
}
```

> 💡 完整的交互式文档（Swagger UI）可访问 `http://localhost:8000/docs`，支持直接在线测试所有接口。