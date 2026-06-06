# LLM Q&A System

基于 Claude AI 的智能问答系统，支持文本问答与文件附件上传，提供完整的用户角色权限管理。

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
- [配置说明](#配置说明)

---

## 项目简介

本系统是一个基于 Anthropic Claude 的智能问答平台，具备以下核心能力：

- **用户认证**：注册 / 登录，JWT Token 鉴权
- **角色权限**：普通用户（仅文本问答）和高级用户（文本 + 文件附件上传）
- **多轮对话**：完整的会话管理，支持历史上下文
- **文件问答**：高级用户可上传 `.txt` 文件，AI 结合文件内容进行回答
- **会话管理**：创建、查看、删除对话记录

---

## 技术栈

| 层级 | 技术 |
|------|------|
| **前端** | React 18 + TypeScript + Vite + Tailwind CSS + Zustand + Axios |
| **后端** | FastAPI + SQLAlchemy + SQLite + Python 3.10+ |
| **AI 服务** | Anthropic Claude API (`claude-sonnet-4-20250514`) |
| **认证** | JWT（python-jose + bcrypt） |

---

## 项目结构

```
.
├── backend/                    # FastAPI 后端
│   ├── app/
│   │   ├── api/                # 路由层
│   │   │   ├── auth.py         # 认证接口
│   │   │   ├── chat.py         # 问答 / 会话接口
│   │   │   └── upload.py       # 文件上传接口
│   │   ├── core/               # 核心配置
│   │   │   ├── config.py       # 环境变量配置
│   │   │   ├── database.py     # 数据库连接
│   │   │   ├── deps.py         # 依赖注入（鉴权）
│   │   │   └── security.py     # 密码与 JWT 工具
│   │   ├── models/
│   │   │   └── models.py       # SQLAlchemy ORM 模型
│   │   ├── schemas/
│   │   │   └── schemas.py      # Pydantic 请求 / 响应体
│   │   ├── services/
│   │   │   ├── llm_service.py  # Anthropic API 封装
│   │   │   └── file_service.py # 文件存储与读取
│   │   └── main.py             # 应用入口，路由注册，CORS
│   ├── uploads/                # 上传文件存储目录（自动创建）
│   ├── seed.py                 # 演示数据初始化脚本
│   ├── requirements.txt
│   └── .env.example
│
└── frontend/                   # React 前端
    ├── src/
    │   ├── api/                # HTTP 客户端 & 接口封装
    │   ├── components/         # 公共组件
    │   ├── hooks/              # 自定义 Hook
    │   ├── pages/              # 页面组件
    │   ├── services/           # 业务服务层
    │   ├── store/              # Zustand 状态管理
    │   └── types/              # TypeScript 类型定义
    ├── package.json
    └── vite.config.ts
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

```bash
cp .env .env
```

编辑 `.env` 文件，至少填写 `ANTHROPIC_API_KEY`：

```dotenv
# 应用密钥（生产环境请替换为随机强密码）
APP_SECRET_KEY=your-super-secret-key-change-this-in-production

# JWT 算法与过期时间
APP_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60

# 数据库（默认使用 SQLite，无需额外安装）
DATABASE_URL=sqlite:///./qa_system.db

# Anthropic API Key（必填）
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxx

# 文件上传目录与大小限制
UPLOAD_DIR=uploads
MAX_FILE_SIZE_MB=10
```

> 📌 前往 [Anthropic Console](https://console.anthropic.com/) 获取 API Key。

**第三步：初始化数据库并创建演示账号**

```bash
python seed.py
```

输出示例：

```
  [ok]   created normal_user  (role=normal)
  [ok]   created premium_user (role=premium)

Seeding complete. 2 user(s) created.
```

**第四步：启动后端服务**

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后可访问：

| 地址 | 说明 |
|------|------|
| `http://localhost:8000/docs` | Swagger 交互式 API 文档 |
| `http://localhost:8000/redoc` | ReDoc 风格 API 文档 |
| `http://localhost:8000/health` | 健康检查端点 |

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

运行 `seed.py` 后自动创建以下账号：

| 用户名 | 密码 | 角色 | 权限说明 |
|--------|------|------|----------|
| `normal_user` | `password123` | 普通用户 | 仅支持文本问答 |
| `premium_user` | `password123` | 高级用户 | 文本问答 + 上传 `.txt` 文件 |

---

## 功能说明

### 普通用户

- 注册 / 登录账号
- 发起文本问答，与 AI 多轮对话
- 查看、删除历史会话

### 高级用户（Premium）

在普通用户功能的基础上，额外支持：

- 上传 `.txt` 格式文件（单文件最大 10MB）
- 在提问时引用已上传的文件，AI 将结合文件内容作答

### 文件上传流程

```
上传文件 (POST /upload/file)
    ↓
获得 attachment_id
    ↓
提问时携带 attachment_ids (POST /chat/ask)
    ↓
AI 读取文件内容，结合问题作答
```

---

## 配置说明

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
- 考虑将 `uploads/` 目录挂载到持久化存储（如对象存储）