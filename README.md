# LLM Q&A System

基于阿里云 DashScope（Qwen 系列模型）的智能问答系统，支持 SSE 流式对话、多格式文件附件、双层记忆管理，以及完整的用户角色权限体系。

---

## 目录

- [项目简介](#项目简介)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
  - [环境要求](#环境要求)
  - [后端启动](#后端启动)
  - [前端启动](#前端启动)
- [演示账号](#演示账号)
- [功能说明](#功能说明)
  - [普通用户](#普通用户)
  - [高级用户](#高级用户-premium)
  - [文件上传流程](#文件上传流程)
  - [双层记忆系统](#双层记忆系统)
  - [流式响应 SSE](#流式响应-sse)
- [配置说明](#配置说明)
- [数据库说明](#数据库说明)
- [附加文档](#附加文档)

---

## 项目简介

本系统是一个基于阿里云 DashScope Qwen 模型的智能问答平台，具备以下核心能力：

- **用户认证**：注册 / 登录，JWT Token 鉴权
- **角色权限**：普通用户（仅文本问答）和高级用户（文本 + 多格式文件附件）
- **SSE 流式对话**：AI 回答以 token 逐步推送，前端实时渲染，支持 Markdown 与代码高亮
- **多模态附件**：高级用户可上传 `.txt` / `.md` / `.pdf` 以及主流图片格式，AI 结合内容作答
- **双层记忆**：短期滑动窗口 + 长期 ChromaDB 向量检索（RAG），支持超长会话语义召回
- **深色模式**：前端内置 Light / Dark 主题切换
- **会话管理**：创建、查看、删除对话记录，支持乐观更新与请求取消

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18 + TypeScript + Vite + Tailwind CSS + Zustand + Axios |
| **前端额外库** | react-markdown + react-syntax-highlighter（代码高亮）、lucide-react、clsx |
| **后端** | FastAPI + SQLAlchemy 2 + SQLite + Python 3.10+ |
| **LLM 服务** | 阿里云 DashScope（`qwen-plus` 文本模型 / `qwen-vl-plus` 多模态模型） |
| **向量数据库** | ChromaDB（本地持久化，长期记忆 RAG） |
| **Embedding** | DashScope `text-embedding-v1`（与 Qwen 同一供应商，中文效果优） |
| **认证** | JWT（python-jose + bcrypt） |
| **数据库迁移** | Alembic（已安装，按需使用） |

---

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth.py           # 认证接口（注册 / 登录 / 我的信息）
│   │   │   ├── chat.py           # SSE 流式问答 + 会话 CRUD
│   │   │   └── upload.py         # 文件上传 / 删除接口
│   │   ├── core/
│   │   │   ├── config.py         # 环境变量配置（含记忆系统参数）
│   │   │   ├── database.py       # 数据库连接
│   │   │   ├── deps.py           # 依赖注入（JWT 鉴权 / premium 校验）
│   │   │   ├── response.py       # 统一响应包装 { code, msg, data }
│   │   │   └── security.py       # 密码与 JWT 工具
│   │   ├── models/
│   │   │   └── models.py         # ORM 模型（含 MemorySummary 表）
│   │   ├── schemas/
│   │   │   └── schemas.py        # Pydantic 请求 / 响应体
│   │   ├── services/
│   │   │   ├── llm_service.py    # DashScope 调用封装（流式 + 非流式 + 重试）
│   │   │   ├── memory_service.py # 双层记忆系统（滑动窗口 + ChromaDB RAG）
│   │   │   └── file_service.py   # 文件上传、类型解析、内容提取
│   │   └── main.py               # 应用入口，路由注册，CORS，统一异常处理
│   ├── docs/
│   │   ├── API.md                # 完整接口文档
│   │   └── SQL.md                # 数据库设计文档
│   ├── uploads/                  # 上传文件存储目录（自动创建）
│   ├── memory_db/                # ChromaDB 持久化目录（自动创建）
│   ├── requirements.txt
│   └── .env
│
└── frontend/
    ├── src/
    │   ├── api/
    │   │   ├── index.ts          # 接口定义（authApi / chatApi / uploadApi）
    │   │   └── httpClient.ts     # Axios 实例（JWT 注入 + 统一响应解包）
    │   ├── components/
    │   │   ├── ChatWindow.tsx    # 消息列表（流式消息 + 乐观更新）
    │   │   ├── ChatInput.tsx     # 输入框（含附件展示与发送控制）
    │   │   ├── FileUploadZone.tsx # 拖拽 / 点击上传区
    │   │   ├── MessageBubble.tsx # 消息气泡（Markdown 渲染 + 代码高亮）
    │   │   ├── Sidebar.tsx       # 会话侧边栏
    │   │   ├── ThemeToggle.tsx   # 深色 / 浅色模式切换
    │   │   └── ProtectedRoute.tsx # 路由鉴权组件
    │   ├── hooks/
    │   │   ├── useAuth.ts
    │   │   ├── useChat.ts
    │   │   ├── useFileUpload.ts
    │   │   └── useConversationDelete.ts
    │   ├── pages/
    │   │   ├── AuthPage.tsx      # 登录 / 注册页
    │   │   └── ChatPage.tsx      # 主对话页
    │   ├── services/
    │   │   ├── chatService.ts    # 会话 & SSE 流式消费逻辑
    │   │   ├── authService.ts
    │   │   └── uploadService.ts
    │   ├── store/
    │   │   ├── chatStore.ts      # Zustand 聊天状态（含 AbortController）
    │   │   ├── authStore.ts
    │   │   └── themeStore.ts
    │   └── types/
    │       └── index.ts          # TypeScript 类型（含 OptimisticMessage / StreamingMessage）
    ├── package.json
    └── vite.config.js
```

---

## 快速开始

### 环境要求

| 工具 | 最低版本 |
|------|----------|
| Python | 3.10+ |
| Node.js | 18+ |
| npm | 9+ |

---

### 后端启动

**第一步：进入后端目录并安装依赖**

```bash
cd backend
python -m venv venv

# macOS / Linux
source venv/bin/activate

# Windows
venv\Scripts\activate

pip install -r requirements.txt
```

**第二步：配置环境变量**

编辑 `.env` 文件，至少填写 `DASHSCOPE_API_KEY`：

```dotenv
# 应用密钥（生产环境请替换为随机强密码）
APP_SECRET_KEY=your-super-secret-key-change-this-in-production

# JWT 算法与过期时间
APP_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# 数据库（默认使用 SQLite，无需额外安装）
DATABASE_URL=sqlite:///./aichat.db

# 阿里云 DashScope API Key（必填）
DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# 文件上传目录与大小限制
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=10

# ── 短期记忆（滑动窗口）────────────────────────────────────────────
MEMORY_SHORT_TERM_MAX_TOKENS=4000   # 发给 LLM 的历史 token 预算
MEMORY_MSG_MAX_TOKENS=800           # 单条消息最大 token 数

# ── 长期记忆（RAG 向量数据库）────────────────────────────────────
MEMORY_VECTOR_DB_PATH=./memory_db   # ChromaDB 持久化路径
MEMORY_SUMMARIZE_THRESHOLD=20       # 触发自动摘要的消息数阈值（0 = 关闭）
MEMORY_RETRIEVAL_TOP_K=3            # 每次 RAG 检索返回的最大条数
MEMORY_SUMMARY_MAX_TOKENS=400       # 摘要最大 token 数
```

> 📌 前往 [阿里云 DashScope 控制台](https://dashscope.aliyun.com/) 获取 API Key。

**第三步：启动后端服务**

数据库表结构会在首次启动时**自动创建**，无需手动执行迁移。

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后可访问：

| 地址 | 说明 |
|------|------|
| `http://localhost:8000/docs` | Swagger 交互式 API 文档 |
| `http://localhost:8000/redoc` | ReDoc 风格 API 文档 |
| `http://localhost:8000/health` | 健康检查端点 |

**第四步（可选）：创建演示账号**

数据库自动建表后，可通过 Swagger (`/docs`) 或 curl 调用注册接口创建账号：

```bash
# 创建普通用户
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "normal_user", "password": "password123", "role": "normal"}'

# 创建高级用户
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username": "premium_user", "password": "password123", "role": "premium"}'
```

---

### 前端启动

**第一步：进入前端目录并安装依赖**

```bash
cd frontend
npm install
```

**第二步：启动开发服务器**

```bash
npm run dev
```

前端默认运行在 `http://localhost:3000`，所有 `/api` 请求通过 Vite 代理转发到 `http://localhost:8000`，**无需额外配置跨域**。

**其他常用命令：**

```bash
npm run build       # 生产构建（输出到 dist/）
npm run preview     # 预览生产构建
npm run typecheck   # TypeScript 类型检查
```

---

## 演示账号

按照上方步骤注册后可使用以下账号：

| 用户名 | 密码 | 角色 | 权限说明 |
|--------|------|------|----------|
| `normal_user` | `password123` | 普通用户 | 仅支持文本问答 |
| `premium_user` | `password123` | 高级用户 | 文本问答 + 上传多格式文件 |

---

## 功能说明

### 普通用户

- 注册 / 登录账号
- 发起文本问答，与 AI 多轮流式对话（实时 token 推送）
- 消息以 Markdown 格式渲染，代码块自动语法高亮
- 查看、删除历史会话
- 深色 / 浅色模式切换

### 高级用户（Premium）

在普通用户功能的基础上，额外支持：

- 上传多种格式文件（单文件最大 10 MB）

| 格式 | 说明 |
|------|------|
| `.txt` | 纯文本，自动识别 UTF-8 / GBK / Latin-1 编码 |
| `.md` | Markdown 文档，保留原始语法供 LLM 理解 |
| `.pdf` | 使用 PyPDF2 提取全文（扫描件返回提示） |
| `.jpg` / `.jpeg` / `.png` / `.gif` / `.webp` | 多模态图像，base64 编码后传入 `qwen-vl-plus` |

- 在提问时引用已上传的文件，AI 将结合文件内容作答

### 文件上传流程

```
上传文件 (POST /api/v1/upload/file)
    ↓
获得 attachment_id
    ↓
提问时携带 attachment_ids (POST /api/v1/chat/ask)
    ↓
AI 读取文件内容（文本注入 / 图像多模态），结合问题流式作答
```

### 双层记忆系统

系统实现了完整的双层记忆架构，确保长对话下的上下文连贯性：

**短期记忆（滑动窗口）**

- 每次提问前，从数据库拉取历史消息
- 基于 token 预算（默认 4000 tokens）动态裁剪，优先保留最近消息
- 自研中英混合 token 估算，无需外部 tokenizer

**长期记忆（RAG 向量检索）**

- 使用 ChromaDB 持久化存储历史摘要向量
- 每当会话消息数达到 `MEMORY_SUMMARIZE_THRESHOLD`（默认 20）的整数倍时，后台异步触发自动摘要
- 摘要通过 DashScope `text-embedding-v1` 向量化后写入 ChromaDB
- 每次提问前，语义检索 Top-K 最相关的历史摘要，注入 system prompt 作为背景上下文

> 长期记忆在 API Key 未配置或 ChromaDB 初始化失败时会**静默降级**，不影响核心问答流程。

### 流式响应 SSE

问答接口（`POST /api/v1/chat/ask`）返回 `text/event-stream`，包含以下事件：

| 事件名 | 触发时机 | 数据示例 |
|--------|----------|----------|
| `metadata` | 流开始时（会话 ID 确定后） | `{"conversation_id": 1, "message_id": 5, "memory_active": true}` |
| `delta` | 每收到一个 token | `{"text": "你好"}` |
| `done` | 生成完毕 | `{"conversation_id": 1, "message_id": 5}` |
| `error` | 出现错误（超时 / 不可用 / 空响应） | `{"msg": "AI 响应超时，请稍后重试"}` |

前端通过 `fetch` + `ReadableStream` 消费 SSE（不使用 `EventSource`，以支持 `Authorization` Header）。

---

## 配置说明

### 完整环境变量参考

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `APP_SECRET_KEY` | `dev-secret-key-change-in-production` | JWT 签名密钥 |
| `APP_ALGORITHM` | `HS256` | JWT 算法 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token 有效期（分钟） |
| `DATABASE_URL` | `sqlite:///./aichat.db` | 数据库连接字符串 |
| `DASHSCOPE_API_KEY` | *(必填)* | 阿里云 DashScope API Key |
| `UPLOAD_DIR` | `uploads` | 上传文件存储目录 |
| `MAX_FILE_SIZE_MB` | `10` | 单文件最大大小（MB） |
| `MEMORY_SHORT_TERM_MAX_TOKENS` | `4000` | 短期记忆 token 预算 |
| `MEMORY_MSG_MAX_TOKENS` | `800` | 单条消息最大 token 数 |
| `MEMORY_VECTOR_DB_PATH` | `./memory_db` | ChromaDB 持久化路径 |
| `MEMORY_SUMMARIZE_THRESHOLD` | `20` | 自动摘要触发消息数（0 = 关闭） |
| `MEMORY_RETRIEVAL_TOP_K` | `3` | RAG 检索返回条数 |
| `MEMORY_SUMMARY_MAX_TOKENS` | `400` | 摘要最大 token 数 |

### 切换数据库

默认使用 SQLite（适合开发和小规模部署）。如需切换至 PostgreSQL：

```dotenv
DATABASE_URL=postgresql://user:password@localhost:5432/qa_system
```

并安装对应驱动：

```bash
pip install psycopg2-binary
```

### 生产部署注意事项

- 将 `APP_SECRET_KEY` 替换为足够长度的随机字符串
- 根据实际域名修改 `main.py` 中的 CORS `allow_origins` 配置
- 建议使用 Nginx 反向代理，并为前端开启 HTTPS
- 将 `uploads/` 和 `memory_db/` 目录挂载到持久化存储
- 长期记忆向量数据库（ChromaDB）重启后可自动加载，无需额外迁移

---

## 数据库说明

应用启动时会自动创建以下 5 张表（`Base.metadata.create_all`）：

| 表名 | 说明 |
|------|------|
| `users` | 用户账号与角色 |
| `conversations` | 对话会话 |
| `messages` | 每条对话消息 |
| `file_attachments` | 文件附件元数据 |
| `memory_summaries` | 长期记忆摘要记录（RAG 索引锚点） |

级联关系：删除用户 → 删除所有会话 → 删除所有消息 → 删除所有附件记录 / 记忆摘要。

> ⚠️ 附件的数据库记录会级联删除，但 `uploads/` 目录中的实际文件**不会**自动清除，生产环境请配置定期清理任务。

如需版本化数据库迁移，项目已安装 Alembic：

```bash
# 在 backend/ 目录下
alembic init alembic
alembic revision --autogenerate -m "描述本次变更"
alembic upgrade head
```

---

## 附加文档

| 文件 | 说明 |
|------|------|
| `backend/docs/API.md` | 完整 REST 接口文档（含请求体、响应示例、错误码） |
| `backend/docs/SQL.md` | 数据库设计文档（ER 图、字段说明、常用查询） |