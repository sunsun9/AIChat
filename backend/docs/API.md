# 接口文档

> 基础地址：`http://localhost:8000`
> 认证方式：除登录和注册接口外，所有接口需在请求头中携带 `Authorization: Bearer <token>`

## 统一响应格式

所有 **非流式** JSON 接口均采用以下统一格式返回：

```json
{
  "code": 0,
  "msg": "success",
  "data": ...
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| code | number | 状态码，`0` 表示成功，非 `0` 为 HTTP 错误状态码 |
| msg | string | 提示信息，成功时为 `"success"`，失败时为具体错误描述 |
| data | any | 业务数据，失败时为 `null` |

**错误响应示例**：

```json
{
  "code": 401,
  "msg": "用户名或密码错误",
  "data": null
}
```

> ⚡ **问答接口（`/api/v1/chat/ask`）例外**：采用 SSE 流式响应，格式见第二章。

---

## 一、认证模块

### 1.1 注册

- **URL**: `POST /api/v1/auth/register`
- **请求体**:

```json
{
  "username": "zhangsan",
  "password": "mypassword",
  "role": "normal"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 用户名，3～50 个字符 |
| password | string | 是 | 密码，至少 6 个字符 |
| role | string | 否 | 用户角色：`normal`（默认）/ `premium` |

- **成功响应** (201):

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": 3,
    "username": "zhangsan",
    "role": "normal",
    "is_active": true,
    "created_at": "2026-06-06T08:00:00"
  }
}
```

- **失败响应**:

| 状态码 | msg |
|--------|-----|
| 409 | 用户名已被占用 |
| 422 | 字段校验失败（如密码过短） |

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
  "code": 0,
  "msg": "success",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "id": 3,
      "username": "zhangsan",
      "role": "normal",
      "is_active": true,
      "created_at": "2026-06-06T08:00:00"
    }
  }
}
```

> Token 有效期默认 **60 分钟**，后续请求将其放入请求头：`Authorization: Bearer <token>`

- **失败响应**:

| 状态码 | msg |
|--------|-----|
| 401 | 用户名或密码错误 |
| 403 | 账号已被禁用 |

---

### 1.3 获取当前用户信息

- **URL**: `GET /api/v1/auth/me`
- **成功响应** (200):

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": 3,
    "username": "zhangsan",
    "role": "normal",
    "is_active": true,
    "created_at": "2026-06-06T08:00:00"
  }
}
```

- **失败响应**:

| 状态码 | msg |
|--------|-----|
| 401 | Token invalid or expired |

---

## 二、问答模块（SSE 流式）

### 2.1 发起问答（SSE 流式）

- **URL**: `POST /api/v1/chat/ask`
- **说明**: 向 AI 提问，以 SSE 流式返回回答。集成短期历史窗口与长期语义记忆，附件功能仅限 premium 用户。
- **响应 Content-Type**: `text/event-stream`
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

#### SSE 事件格式

SSE 流由多个事件帧组成，每帧格式如下：

```
event: <事件类型>
data: <JSON 字符串>

```

（事件帧之间以空行 `\n\n` 分隔）

#### 事件序列

一次正常请求依次推送：`metadata` → `delta × N` → `done`

**1. `metadata` 事件**（首帧，会话 ID 确定后立即推送）

```
event: metadata
data: {
  "conversation_id": 12,
  "message_id": 45,
  "used_attachments": [
    {
      "id": 5,
      "original_filename": "data.txt",
      "file_size": 2048,
      "content_preview": "第一行内容……",
      "created_at": "2026-06-06T08:05:00"
    }
  ],
  "memory_active": true
}
```

| 字段 | 说明 |
|------|------|
| conversation_id | 当前会话 ID（新建或已有） |
| message_id | 本次 AI 回答的数据库消息 ID |
| used_attachments | 本次实际读取的附件列表，无附件时为 `[]` |
| memory_active | 是否命中了长期记忆（true = 有历史摘要注入到上下文） |

**2. `delta` 事件**（每收到一段 LLM 输出，推送一次，共 N 次）

```
event: delta
data: {"text": "机器学习是"}
```

```
event: delta
data: {"text": "人工智能的一个分支……"}
```

**3. `done` 事件**（流结束，AI 已生成完整回答并写入数据库）

```
event: done
data: {"message_id": 45, "conversation_id": 12}
```

**4. `error` 事件**（出错时推送，流结束）

```
event: error
data: {"msg": "AI 响应超时，请稍后重试。"}
```

| 错误原因 | msg 内容 |
|----------|----------|
| LLM 响应超时 | `AI 响应超时，请稍后重试。（…）` |
| LLM 服务不可用 | `AI 服务暂时不可用，请稍后重试。（…）` |
| LLM 空响应 | `AI 未返回任何内容，请重试或换一种提问方式。` |
| 其他异常 | `AI 服务异常，请稍后重试。（ErrorType）` |


#### HTTP 错误响应（流建立前）

若请求本身不合法，返回普通 JSON 错误（非 SSE）：

| 状态码 | msg |
|--------|-----|
| 401 | Token invalid or expired |
| 403 | 附件功能仅限高级用户使用 |
| 404 | 会话不存在 |

---

### 2.2 获取会话列表

- **URL**: `GET /api/v1/chat/conversations`
- **说明**: 返回当前用户所有会话，按最后更新时间倒序排列
- **成功响应** (200):

```json
{
  "code": 0,
  "msg": "success",
  "data": [
    {
      "id": 12,
      "title": "什么是机器学习？…",
      "created_at": "2026-06-06T08:00:00",
      "updated_at": "2026-06-06T08:10:00",
      "message_count": 4
    }
  ]
}
```

> `title` 由首条用户消息的前 40 个字符自动生成；`message_count` 不计入占位消息和空消息。

---

### 2.3 获取会话详情

- **URL**: `GET /api/v1/chat/conversations/:id`
- **说明**: 返回指定会话的完整内容，包含所有消息记录
- **成功响应** (200):

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "id": 12,
    "title": "什么是机器学习？…",
    "created_at": "2026-06-06T08:00:00",
    "updated_at": "2026-06-06T08:10:00",
    "message_count": 4,
    "messages": [
      {
        "id": 41,
        "role": "user",
        "content": "什么是机器学习？",
        "created_at": "2026-06-06T08:00:10",
        "attachments": []
      },
      {
        "id": 42,
        "role": "assistant",
        "content": "机器学习是人工智能的一个分支……",
        "created_at": "2026-06-06T08:00:15",
        "attachments": []
      }
    ]
  }
}
```

**字段说明**:
- `messages[].role` — 消息角色：`user`（用户）/ `assistant`（AI）
- `messages[].attachments` — 该消息关联的附件列表，无附件时为 `[]`

- **失败响应**:

| 状态码 | msg |
|--------|-----|
| 404 | 会话不存在 |

---

### 2.4 删除会话

- **URL**: `DELETE /api/v1/chat/conversations/:id`
- **说明**: 删除指定会话及其所有消息（级联删除）
- **成功响应** (200):

```json
{
  "code": 0,
  "msg": "删除成功",
  "data": null
}
```

- **失败响应**:

| 状态码 | msg |
|--------|-----|
| 404 | 会话不存在 |

---

## 三、文件上传模块

> ⚠️ 本模块**仅限 premium 角色用户**调用，普通用户访问将返回 403。

### 3.1 上传文件

- **URL**: `POST /api/v1/upload/file`
- **认证**: 需要，且用户角色必须为 `premium`
- **Content-Type**: `multipart/form-data`
- **请求参数**:

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| file | File | 是 | 支持格式见下表，最大 10 MB |
| conversation_id | number | 否 | 关联到已有会话 ID；不传则自动创建新会话 |

**支持的文件格式**：

| 格式 | MIME | 处理方式 | 说明 |
|------|------|----------|------|
| `.txt` | text/plain | 文本解码 | 支持 UTF-8 / GBK / Latin-1 编码 |
| `.md` | text/markdown | 文本解码 | 保留原始 Markdown 语法，便于 LLM 理解结构 |
| `.pdf` | application/pdf | PyPDF2 提取文本 | 扫描件提取结果为 `[PDF 无可提取文本，可能为扫描件]` |
| `.jpg` / `.jpeg` | image/jpeg | base64 编码 | 多模态模型直接理解图像内容 |
| `.png` | image/png | base64 编码 | 同上 |
| `.gif` | image/gif | base64 编码 | 同上 |
| `.webp` | image/webp | base64 编码 | 同上 |

- **curl 示例**:

```bash
curl -X POST http://localhost:8000/api/v1/upload/file \
  -H "Authorization: Bearer <token>" \
  -F "file=@/path/to/document.pdf" \
  -F "conversation_id=12"
```

- **成功响应** (200):

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "attachment_id": 5,
    "original_filename": "document.pdf",
    "file_size": 20480,
    "content_preview": "这是文件的前 500 个字符……"
  }
}
```

**字段说明**:
- `attachment_id` — 附件 ID，在 `/chat/ask` 的 `attachment_ids` 中使用
- `content_preview` — 文本文件前 500 个字符的预览；图片文件为 `[图像文件: filename.jpg]`

- **失败响应**:

| 状态码 | msg |
|--------|-----|
| 403 | This feature is only available to premium users |
| 400 | 不支持的文件格式 / 无法解码文件 / PDF 解析失败 |
| 413 | 文件过大，最大允许 10 MB |

---

### 3.2 删除附件

- **URL**: `DELETE /api/v1/upload/file/:attachment_id`
- **认证**: 需要，且用户角色必须为 `premium`，且只能删除自己的附件
- **说明**: 用于用户取消上传后清理孤儿文件。删除附件的同时会：
  1. 从磁盘删除实际文件
  2. 若关联的占位消息下已无其他附件，一并删除该消息
  3. 若对应会话内已无任何有效消息，一并删除该空会话

- **成功响应** (200):

```json
{
  "code": 0,
  "msg": "附件已删除",
  "data": null
}
```

- **失败响应**:

| 状态码 | msg |
|--------|-----|
| 403 | This feature is only available to premium users |
| 404 | 附件不存在或无权删除 |

---

## 四、系统

### 4.1 健康检查

- **URL**: `GET /health`
- **认证**: 无需认证
- **成功响应** (200):

```json
{
  "code": 0,
  "msg": "success",
  "data": {
    "status": "ok",
    "service": "LLM Q&A Backend"
  }
}
```

---

## 接口调用典型流程

```
1. POST /api/v1/auth/login                      → 获取 token
          ↓
2. POST /api/v1/upload/file                     → 获取 attachment_id（仅 premium 用户）
          ↓（如需取消上传）
   DELETE /api/v1/upload/file/:id               → 清理孤儿附件（仅 premium 用户）
          ↓
3. POST /api/v1/chat/ask                        → 提问（SSE 流式，可携带 attachment_ids）
          消费 SSE 事件：metadata → delta × N → done / error
          ↓
4. GET  /api/v1/chat/conversations              → 查看会话列表
          ↓
5. GET  /api/v1/chat/conversations/:id          → 查看历史消息
          ↓
6. DELETE /api/v1/chat/conversations/:id        → 删除会话
```

---

## 通用错误响应

| 状态码 | 说明 |
|--------|------|
| 401 | 未认证或 Token 已过期 |
| 403 | 权限不足（如普通用户访问 premium 接口） |
| 404 | 资源不存在或无访问权限 |
| 409 | 数据冲突（如用户名已被注册） |
| 413 | 请求体过大（文件超过 10 MB） |
| 422 | 请求参数校验失败 |

错误响应格式:

```json
{
  "code": 400,
  "msg": "错误描述信息",
  "data": null
}
```

> 💡 完整的交互式文档（Swagger UI）可访问 `http://localhost:8000/docs`，支持直接在线测试所有接口（注意：Swagger 不支持 SSE 流式预览，建议使用 curl 或前端测试 `/chat/ask`）。

---

## 附录：双层记忆系统

### 短期记忆（Short-term Memory）

每次问答前，自动将当前会话历史通过**滑动窗口**裁剪后注入上下文：

- 从最新消息向前累积，直到达到 token 预算（默认 4000 tokens）
- 单条消息超长时自动截断（默认单条上限 800 tokens）
- Token 估算基于字符特征，中文按 1.5 字符/token，英文按 4 字符/token

### 长期记忆（Long-term Memory，RAG）

- **向量数据库**：ChromaDB（本地持久化，路径 `./memory_db`）
- **向量模型**：DashScope `text-embedding-v1`（与 LLM 同一供应商，中文效果好）
- **触发时机**：会话真实消息数每达到阈值（默认 20 条）的整数倍时，后台异步触发自动摘要并存储至向量库（不阻塞当前 SSE 响应）
- **检索时机**：每次提问前，用问题向量检索该用户最相关的 Top-K 条历史摘要（默认 3 条，相似度阈值 0.6），注入 system prompt 作为背景上下文
- **降级策略**：若向量服务超时或 ChromaDB 不可用，长期记忆自动跳过，仅使用短期历史，不影响主流程

`metadata` 事件中的 `memory_active` 字段指示本次回答是否注入了长期记忆。