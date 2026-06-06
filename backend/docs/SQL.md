# 数据库说明文档

**LLM Q&A System — Database Reference**

---

## 概述

本系统默认使用 **SQLite**（文件路径：`backend/qa_system.db`），通过 SQLAlchemy ORM 管理数据库。数据库在应用启动时自动创建表结构，无需手动执行 SQL 迁移。

如需切换至 PostgreSQL，修改 `.env` 中的 `DATABASE_URL` 即可，代码层面无需变动。

---

## 数据库配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `DATABASE_URL` | `sqlite:///./qa_system.db` | 数据库连接字符串 |
| 初始化方式 | 应用启动时自动 `CREATE TABLE IF NOT EXISTS` | 无需手动执行脚本 |
| ORM 框架 | SQLAlchemy 2.x | |
| 迁移工具 | Alembic（已安装，按需使用） | |

---

## ER 关系图

```
┌─────────────────┐
│      users      │
├─────────────────┤
│ id (PK)         │
│ username        │
│ email           │
│ hashed_password │
│ role            │
│ is_active       │
│ created_at      │
│ updated_at      │
└────────┬────────┘
         │ 1
         │
         │ N
┌────────▼────────┐          ┌──────────────────────┐
│  conversations  │          │    file_attachments   │
├─────────────────┤          ├──────────────────────┤
│ id (PK)         │          │ id (PK)               │
│ user_id (FK)    │          │ message_id (FK) ──┐   │
│ title           │          │ user_id (FK)      │   │
│ created_at      │          │ original_filename │   │
│ updated_at      │          │ stored_filename   │   │
└────────┬────────┘          │ file_path         │   │
         │ 1                 │ file_size         │   │
         │                   │ content_preview   │   │
         │ N                 │ created_at        │   │
┌────────▼────────┐          └──────────────────────┘
│    messages     │◄──────────────────────────────────┘
├─────────────────┤
│ id (PK)         │
│ conversation_id │
│  (FK)           │
│ role            │
│ content         │
│ created_at      │
└─────────────────┘
```

---

## 数据表详情

### 1. `users` — 用户表

存储所有注册用户的基本信息与权限角色。

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | 用户唯一标识 |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL, INDEX | 登录用户名，全局唯一 |
| `hashed_password` | VARCHAR(255) | NOT NULL | bcrypt 加密后的密码哈希 |
| `role` | ENUM | NOT NULL, DEFAULT `normal` | 用户角色，见下方枚举说明 |
| `is_active` | BOOLEAN | DEFAULT `true` | 账号是否启用，`false` 则禁止登录 |
| `created_at` | DATETIME | NOT NULL | 创建时间（UTC） |
| `updated_at` | DATETIME | NOT NULL | 最后更新时间（UTC，写操作时自动更新） |

**`role` 枚举值**

| 值 | 说明 |
|----|------|
| `normal` | 普通用户：仅允许纯文本问答 |
| `premium` | 高级用户：允许文本问答 + 上传文件附件 |

**关联关系**

- 一个用户可拥有多个会话（`conversations`），级联删除

---

### 2. `conversations` — 会话表

记录每一次用户与 AI 的对话会话，一个会话包含多条消息。

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | 会话唯一标识 |
| `user_id` | INTEGER | FOREIGN KEY → `users.id`, NOT NULL | 所属用户 |
| `title` | VARCHAR(200) | DEFAULT `'New Conversation'` | 会话标题，由首条用户消息前 40 字自动生成 |
| `created_at` | DATETIME | NOT NULL | 创建时间（UTC） |
| `updated_at` | DATETIME | NOT NULL | 最后更新时间（UTC） |

**关联关系**

- 属于一个用户（`users`），外键关联
- 包含多条消息（`messages`），级联删除

---

### 3. `messages` — 消息表

存储会话中每一条消息，包括用户提问和 AI 回答。

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | 消息唯一标识 |
| `conversation_id` | INTEGER | FOREIGN KEY → `conversations.id`, NOT NULL | 所属会话 |
| `role` | ENUM | NOT NULL | 消息角色，见下方枚举说明 |
| `content` | TEXT | NOT NULL | 消息正文内容（用户文本或 AI 回答） |
| `created_at` | DATETIME | NOT NULL | 创建时间（UTC，同时作为消息排序依据） |

**`role` 枚举值**

| 值 | 说明 |
|----|------|
| `user` | 用户发送的提问 |
| `assistant` | AI 生成的回答 |

> 📌 **特殊值说明**：`content = "[file upload placeholder]"` 是上传文件时自动创建的占位消息，用于在会话中锚定附件。此类消息在查询和展示时会被过滤，不计入 `message_count`。

**关联关系**

- 属于一个会话（`conversations`），外键关联
- 可包含多个文件附件（`file_attachments`），级联删除

---

### 4. `file_attachments` — 文件附件表

存储高级用户上传的文件信息及其与消息的关联。文件实体保存在服务器 `uploads/` 目录中，数据库仅存储元数据。

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | INTEGER | PRIMARY KEY, AUTO INCREMENT | 附件唯一标识 |
| `message_id` | INTEGER | FOREIGN KEY → `messages.id`, NOT NULL | 关联的消息 ID |
| `user_id` | INTEGER | FOREIGN KEY → `users.id`, NOT NULL | 上传该文件的用户 ID |
| `original_filename` | VARCHAR(255) | NOT NULL | 用户上传时的原始文件名 |
| `stored_filename` | VARCHAR(255) | NOT NULL | 磁盘存储时的文件名（UUID 生成，避免冲突） |
| `file_path` | VARCHAR(500) | NOT NULL | 文件在服务器上的完整路径 |
| `file_size` | INTEGER | NOT NULL | 文件大小（字节） |
| `content_preview` | TEXT | NULLABLE | 文件前 500 个字符的预览内容，便于快速展示 |
| `created_at` | DATETIME | NOT NULL | 上传时间（UTC） |

**关联关系**

- 属于一条消息（`messages`），外键关联
- 属于一个用户（`users`）

---

## 数据级联关系

```
删除用户
  └── 级联删除该用户的所有会话
        └── 级联删除会话的所有消息
              └── 级联删除消息的所有附件记录
```

> ⚠️ **注意**：附件的数据库记录会级联删除，但服务器 `uploads/` 目录中的实际文件**不会**自动清除，需要额外的文件清理机制。

---

## 索引说明

| 表 | 索引列 | 索引类型 | 说明 |
|----|--------|----------|------|
| `users` | `id` | PRIMARY KEY | 主键，自动创建 |
| `users` | `username` | UNIQUE INDEX | 加速登录查询与唯一性校验 |
| `users` | `email` | UNIQUE INDEX | 加速注册去重校验 |
| `conversations` | `id` | PRIMARY KEY | 主键，自动创建 |
| `messages` | `id` | PRIMARY KEY | 主键，自动创建 |
| `file_attachments` | `id` | PRIMARY KEY | 主键，自动创建 |

---

## 常用查询参考

以下为业务层常见的 SQL 查询逻辑（SQLAlchemy ORM 等效）：

**获取用户的会话列表（按更新时间倒序）**

```sql
SELECT * FROM conversations
WHERE user_id = :user_id
ORDER BY updated_at DESC;
```

**获取会话的消息列表（过滤占位消息，按时间升序）**

```sql
SELECT * FROM messages
WHERE conversation_id = :conv_id
  AND content != '[file upload placeholder]'
ORDER BY created_at ASC
LIMIT 20;
```

**统计会话的有效消息数**

```sql
SELECT COUNT(*) FROM messages
WHERE conversation_id = :conv_id
  AND content != '[file upload placeholder]';
```

**查询附件（权限过滤）**

```sql
SELECT * FROM file_attachments
WHERE id = :attachment_id
  AND user_id = :user_id;
```

---

## 演示数据

运行 `python seed.py` 后，数据库中会预置以下数据：

| username | email | password | role |
|----------|-------|----------|------|
| `normal_user` | `normal@example.com` | `password123` | `normal` |
| `premium_user` | `premium@example.com` | `password123` | `premium` |

---

## 数据库迁移（使用 Alembic）

项目已安装 Alembic，若后续修改了 ORM 模型，可通过以下命令生成并应用迁移：

```bash
# 在 backend/ 目录下

# 初始化 Alembic（首次使用）
alembic init alembic

# 自动生成迁移脚本
alembic revision --autogenerate -m "描述本次变更"

# 执行迁移
alembic upgrade head

# 回滚一个版本
alembic downgrade -1
```

> 💡 开发阶段也可直接在 `main.py` 启动时调用 `Base.metadata.create_all(bind=engine)` 自动建表（已启用），适合快速迭代。生产环境建议使用 Alembic 管理版本化迁移。