# subvote V2.0 精简版 PRD + 技术拆分清单

- 项目名称：subvote
- 文档版本：V2.1 Draft for AI Implementation
- 文档日期：2026-03-10
- 适用对象：产品、前端、后端、数据库、智能合约、测试、AI 编码助手
- 文档定位：本文件既是 V2.0 精简版 PRD，也是后续 AI 实施时必须遵守的工程蓝图

---

## 1. 文档用途

本文件的目标不是做泛泛的产品描述，而是给出一份 AI 和工程师都能直接执行的实现说明。

从本文件开始，后续实现应遵守以下原则：
1. 以当前仓库的 T3 技术栈为基础演进，不推翻重做。
2. 产品范围以“最小可上线闭环”为目标，不在 V2.0 首版堆叠高风险机制。
3. 所有关键行为必须能映射到明确的前端页面、后端接口、数据库表和链上事件。
4. 未在本文件明确列入范围的功能，默认不做。
5. AI 在实现时，如遇到歧义，应优先遵守本文件中的“固定决策”与“目录结构”，而不是自行发明新架构。

---

## 2. 一句话定义

subvote 是一个基于 Polkadot 生态的议题讨论平台。用户通过质押 vDOT 获得站内 VP，随后创建议题、加入议题、发送消息，平台在链下完成实时业务与结算，在链上保存关键哈希与审计锚点。

---

## 3. 当前代码仓库技术基线

当前仓库不是空仓，已经是一个标准 T3 起手项目。实现必须基于当前技术基线，而不是脱离现状重新设计。

### 3.1 当前已存在的技术栈

1. Next.js `15.2.3`，使用 App Router
2. React `19`
3. TypeScript `5.8`
4. tRPC `11`
5. TanStack Query `5`
6. Prisma `6.6`
7. Tailwind CSS `4`
8. Zod `3`

### 3.2 当前仓库形态

当前仓库是单仓库单应用，不是 monorepo。V2.0 实施阶段继续保持单仓库结构，但允许在同一仓库中增加：
1. `src/server/jobs` 用于后台任务
2. `contracts` 用于智能合约源码与部署脚本
3. `docs` 或当前根目录文档用于产品与架构说明

### 3.3 必须调整的基础设施决策

虽然当前 Prisma 默认使用 SQLite，但 V2.0 正式实现前必须切换到 PostgreSQL。

原因：
1. 聊天扣费需要可靠事务。
2. 幂等去重需要更稳健的并发控制。
3. 消息发送场景需要行级锁或等价事务保障。
4. SQLite 不适合作为线上聊天室 + VP 结算主库。

结论：
1. 本地开发可使用本地 PostgreSQL 或云数据库开发分支。
2. Prisma datasource 应切换为 `postgresql`。
3. V2.0 不以 SQLite 作为产品数据库基线。

---

## 4. 固定决策

本节是 AI 实现时的固定约束，不应随意改动。

### 4.1 架构固定决策

1. 保持当前 T3 单仓库架构，不拆分为前后端两个仓库。
2. Web 主应用使用 Next.js App Router。
3. 业务 API 使用 tRPC，不使用 REST 作为主接口形态。
4. Prisma 作为唯一 ORM。
5. 生产数据库使用 PostgreSQL。
6. 实时消息首版使用 SSE 适配层，不在 V2.0 首版自建复杂 WebSocket 网关。
7. 链上同步首版不依赖 The Graph，直接实现一个链事件同步 Worker。
8. 归档快照首版先存数据库 JSONB，后续再扩展对象存储。
9. 会话认证使用“钱包签名登录 + HttpOnly Session Cookie”，不使用 JWT 作为浏览器主会话机制。
10. 所有业务写操作必须经 tRPC server mutation 或明确的 Route Handler，不允许前端直连数据库或链节点写业务状态。

### 4.2 产品固定决策

1. V2.0 不做情绪计费。
2. V2.0 不做热度计费。
3. V2.0 不做点赞回血。
4. V2.0 不做 OpenGov 真投票。
5. V2.0 不做退出参与权与部分提取 vDOT。
6. V2.0 的 OpenGov 只是“信息讨论”轨道。
7. 消息最终成本由后端重算，客户端预估永远不可信。

### 4.3 实现固定决策

1. 页面读取数据优先使用 Server Components。
2. 交互密集区域再使用 Client Components。
3. tRPC Router 保持薄层，业务逻辑下沉到 `service`。
4. Prisma 调用不直接散落在 UI 或 Router 中。
5. 链上事件处理必须幂等。
6. 所有金额单位和哈希格式必须在文档中统一，不允许不同模块各自定义。

---

## 5. V2.0 产品目标

### 5.1 必须实现的业务闭环

1. 用户连接钱包并签名登录。
2. 用户完成 vDOT 质押后，平台同步并计算 VP。
3. 用户创建议题并在链上登记 `config_hash` 与 `topic_hash`。
4. 用户加入议题并获得发言权限。
5. 用户在聊天室发送消息，平台完成服务端结算。
6. 议题关闭后生成归档快照与链上归档哈希。
7. 用户可查看归档回放。

### 5.2 V2.0 成功标准

如果用户可以完成以下最短路径，则 V2.0 成功：

1. 登录
2. 看到自己的 VP
3. 创建一个议题
4. 另一个用户加入这个议题
5. 双方正常发消息并扣费
6. 议题关闭后能看到归档回放

---

## 6. 非目标

以下内容不属于 V2.0 实现范围，AI 不应主动实现：

1. 消息情绪识别
2. 情绪申诉中心
3. 消息热度动态倍率
4. 点赞奖励与奖励上限
5. Speaker Room
6. 精选区
7. OpenGov 真实投票/委托
8. 退出参与权
9. 部分销毁 VP 换回 vDOT
10. 国际化
11. 推送通知
12. 移动端 App

---

## 7. 用户角色

1. 游客：可浏览公开议题列表与详情。
2. 登录用户：可查看 VP、创建议题、加入议题、发送消息。
3. 议题发起者：可关闭自己创建的议题。
4. 平台后端：负责会话认证、VP 账本、聊天结算、归档。
5. 链上合约：负责记录 stake、topic、join、archive 等关键锚点。
6. 链同步 Worker：负责监听链上事件并更新数据库状态。

---

## 8. 术语与数据约定

### 8.1 术语

1. `vDOT`：用户用于质押获取 VP 的链上资产。
2. `VP`：平台内发言权点数，整数，不带小数。
3. `VP_max`：根据当前质押量推导出的理论上限。
4. `VP_available`：当前可用于创建议题和发送消息的额度。
5. `VP_topic_locked`：因创建议题而被锁定的额度。
6. `config_hash`：议题配置对象的规范化哈希。
7. `topic_hash`：议题唯一标识哈希。
8. `archive_hash`：议题关闭后生成的完整快照哈希。

### 8.2 金额单位约定

为了避免链上最小单位与 UI 显示混淆，所有实现必须遵守：

1. 链上 `vDOT` 在数据库中存最小单位，字段名统一为 `vdotStakedPlanck`。
2. 前端显示时再格式化为可读单位。
3. `VP` 始终为整数。
4. `settled_cost` 始终为整数 VP。

### 8.3 哈希约定

1. 所有哈希字符串统一使用小写 `0x` 前缀十六进制字符串。
2. `config_hash` 使用规范化 JSON 的 `blake2b-256`。
3. `archive_hash` 使用归档 bundle 的 `blake2b-256`。
4. `topic_hash` 由服务端生成，并参与链上登记。

`topic_hash` 生成规则固定为：

```text
topic_hash = blake2b-256(config_hash + ":" + creator_pubkey + ":" + created_at_unix_ms)
```

说明：
1. `created_at_unix_ms` 使用创建草稿时的服务端时间戳
2. 同一草稿重新发布不应重新生成 `topic_hash`
3. 一旦生成并写入草稿表，后续只能复用，不能修改

### 8.4 规范化 JSON 规则

为避免同一草稿生成不同哈希，所有哈希计算必须基于 canonical JSON：

1. 移除 `undefined`
2. 移除值为 `null` 的可选字段
3. 对对象 key 做字典序排序
4. 数组顺序保持原样
5. 时间统一为 ISO8601 UTC 字符串
6. 布尔值与数字不转字符串

---

## 9. V2.0 业务范围

### 9.1 保留功能

1. 钱包连接与登录
2. 资产说明页
3. VP 面板
4. 议题草稿
5. 发布议题
6. 议题列表与详情
7. 加入议题
8. 聊天室
9. 议题关闭
10. 归档回放
11. 审计账本

### 9.2 延后功能

1. 点赞
2. 精选
3. 情绪
4. 热度
5. 部分提取 vDOT
6. 运营后台
7. AI 审核与 AI 摘要

---

## 10. VP 经济模型

### 10.1 VP 上限

```text
VP_max = floor(1000 * sqrt(vDOT_staked / 1000))
```

这里的 `vDOT_staked` 是显示单位概念，实际代码中需要先把链上最小单位转换为人类可读单位后再参与公式计算。

### 10.2 V2.0 账户字段

V2.0 只保留：
1. `VP_max`
2. `VP_available`
3. `VP_topic_locked`

V2.0 删除：
1. `vp_chat_debt`
2. `daily_recovery`
3. `like_reward`

### 10.3 创建议题成本

1. 创建议题锁定 `50 VP`
2. 议题关闭时返还 `50 VP`
3. 议题创建后 24 小时内不可手动关闭
4. 同一用户同时进行中的议题最多 3 个

### 10.4 聊天成本

V2.0 采用固定成本模型：

```text
final_cost = BaseCost(category) + LengthCostBucket(message_length)
```

推荐默认值：
1. 普通议题：`5 VP`
2. OpenGov 讨论议题：`8 VP`
3. 字符长度 1 到 80：`+0 VP`
4. 字符长度 81 到 200：`+2 VP`
5. 字符长度 201 到 500：`+5 VP`

说明：
1. 客户端可以调用 `estimate` 显示预估，但不能提交 `cost` 参与结算。
2. 服务端在 `send` 里重新计算。
3. 如果 `VP_available < final_cost`，则拒绝发送。

---

## 11. 用户流程

### 11.1 登录流程

1. 用户点击连接钱包。
2. 前端请求 `auth.challenge`。
3. 服务端写入一条一次性 challenge。
4. 钱包对 challenge 文本签名。
5. 前端将签名发送给 `auth.verify`。
6. 服务端验签成功后，创建 session 并写入 HttpOnly Cookie。

### 11.2 质押同步流程

1. 用户在链上完成 vDOT 质押。
2. 链同步 Worker 监听到 Stake 事件。
3. Worker 更新 `account_vp.vdotStakedPlanck`。
4. Worker 重新计算 `VP_max`。
5. 若新的 `VP_max` 大于等于 `VP_topic_locked`，则更新 `VP_available`。

### 11.3 创建议题流程

1. 用户在 `/topics/new` 填写表单。
2. 前端先保存草稿。
3. 服务端生成 `config_hash` 与 `topic_hash`。
4. 用户发起链上 `registerTopic` 交易。
5. Worker 同步到链上事件。
6. 数据库中对应草稿升级为 `ACTIVE` 议题。
7. 同时锁定 `50 VP`。

### 11.4 加入议题流程

1. 用户进入议题详情。
2. 点击加入。
3. 前端引导用户发起链上 `joinTopic` 交易。
4. Worker 同步到加入事件。
5. 数据库中写入 `topic_member`。
6. 该用户获得聊天室权限。

### 11.5 聊天发送流程

1. 前端输入消息。
2. 调用 `chat.estimate` 获取预估成本。
3. 用户点击发送。
4. 前端发送 `idempotencyKey + content`。
5. 服务端读取当前用户 VP 行并计算 `final_cost`。
6. 服务端在一个事务内：
   - 校验权限
   - 校验余额
   - 扣减 `VP_available`
   - 写入 `message`
   - 写入 `vp_ledger`
7. 提交事务后推送给 SSE 流。

### 11.6 关闭与归档流程

1. 到达结束时间后自动关闭，或发起者手动关闭。
2. 服务端返还 `50 VP` 锁定额度。
3. 归档 Worker 打包议题元信息、成员、消息、统计数据。
4. 生成 canonical JSON 并计算 `archive_hash`。
5. 用户或服务端执行链上 `anchorArchive`。
6. 回放页显示归档数据与 `archive_hash`。

---

## 12. 状态机

### 12.1 议题状态

1. `DRAFT`
2. `PUBLISHED_PENDING_CHAIN`
3. `ACTIVE`
4. `CLOSED`
5. `ARCHIVED`

状态迁移：

```text
DRAFT -> PUBLISHED_PENDING_CHAIN -> ACTIVE -> CLOSED -> ARCHIVED
```

### 12.2 成员状态

1. `JOIN_PENDING_CHAIN`
2. `ACTIVE`
3. `LEFT`

### 12.3 归档状态

1. `PENDING`
2. `GENERATED`
3. `ANCHORED`
4. `FAILED`

---

## 13. 前端实现设计

### 13.1 前端总体原则

实现必须符合当前 Next.js App Router 与 React 19 的最佳实践：

1. 读多写少页面优先用 Server Components。
2. 仅在需要钱包交互、表单状态或实时消息时引入 Client Components。
3. 不要在页面 `useEffect` 里首屏再发一次关键数据请求，避免 waterfall。
4. 列表页、详情页、回放页的首屏数据由服务端取数。
5. 聊天输入框与消息流订阅使用客户端状态。

### 13.2 页面设计

#### 首页 `/`

目标：
1. 展示平台定位
2. 展示热门或最新议题
3. 提供分类入口和搜索入口

页面模块：
1. 顶部导航
2. Hero 说明
3. 分类筛选栏
4. 议题卡片列表
5. 空状态与加载状态

#### 资产页 `/assets`

目标：
1. 解释 DOT -> vDOT -> 质押获取 VP 的流程
2. 展示外部跳转入口

页面模块：
1. 流程说明卡片
2. 风险提示
3. 外部链接按钮

#### VP 页 `/vp`

目标：
1. 清楚解释当前账户的 VP 状态
2. 显示最近账本

页面模块：
1. `VP_max` 卡片
2. `VP_available` 卡片
3. `VP_topic_locked` 卡片
4. 账本列表

#### 创建议题页 `/topics/new`

目标：
1. 一页完成普通议题与 OpenGov 讨论议题创建
2. 不拆成额外 OpenGov 页面

表单字段：
1. 标题
2. 简介
3. 分类
4. 结束时间
5. 是否 OpenGov 讨论
6. `referendumId` 可选
7. `track` 可选

#### 议题详情页 `/topics/[topicHash]`

页面模块：
1. 标题与状态
2. 创建者信息
3. 议题元信息
4. 加入按钮
5. 进入聊天室按钮
6. 已归档状态提示

#### 聊天页 `/topics/[topicHash]/chat`

页面模块：
1. 议题头部
2. 消息列表
3. 成本提示条
4. 输入框
5. 发送按钮
6. 权限不足提示

#### 回放页 `/topics/[topicHash]/replay`

页面模块：
1. 归档概览
2. `archive_hash`
3. 元信息摘要
4. 消息时间线

### 13.3 前端数据获取策略

1. 页面首屏数据由 Server Component 通过 server caller 获取。
2. 表单类 mutation 通过 tRPC React hooks 调用。
3. 聊天室首屏消息由服务端预取，后续增量通过 SSE。
4. TanStack Query 仅用于客户端交互场景，不把所有页面都强行做成 CSR。

### 13.4 前端状态管理

V2.0 不引入额外全局状态库。优先级如下：

1. Server Component props
2. URL params / search params
3. TanStack Query cache
4. 组件内 state

### 13.5 前端权限边界

1. 游客可访问首页、议题列表、议题详情、归档回放。
2. 登录用户才可访问 VP、创建议题、加入议题、聊天室。
3. 未加入议题用户不能发送消息。
4. 未登录用户看到 CTA，但跳转登录。

---

## 14. 后端实现设计

### 14.1 后端原则

1. tRPC Router 负责输入输出边界，不承载复杂业务。
2. 业务逻辑写在 `service`。
3. 数据访问集中在 Prisma 层。
4. 链上同步、归档生成、自动关闭属于后台任务，不写在页面请求中。

### 14.2 模块拆分

后端模块固定为：

1. `auth`
2. `vp`
3. `topics`
4. `membership`
5. `chat`
6. `archive`
7. `profile`
8. `chain`

说明：
1. `membership` 是内部业务子域
2. V2.0 不单独暴露顶级 `membership` router
3. 用户加入与访问控制能力统一挂在 `topics` router 下

### 14.3 认证模块

认证不使用第三方完整 auth 框架，V2.0 采用轻量自定义会话：

1. `auth.challenge`
2. `auth.verify`
3. `auth.logout`
4. `auth.me`

实现要求：
1. challenge 一次性、短时有效
2. 服务端保存 challenge 记录
3. session 写入数据库
4. 浏览器使用 HttpOnly Cookie 保存 session token

### 14.4 VP 模块

职责：
1. 返回账户质押信息
2. 返回 VP 汇总
3. 返回 VP 账本
4. 提供内部能力供其他模块扣减/锁定/返还 VP

### 14.5 Topics 模块

职责：
1. 草稿 CRUD
2. 生成 `config_hash`
3. 生成 `topic_hash`
4. 发布同步
5. 详情、列表、关闭

### 14.6 Chat 模块

职责：
1. 成本预估
2. 最终结算
3. 写消息
4. 读取消息历史
5. 推送实时事件

### 14.7 Archive 模块

职责：
1. 打包归档 bundle
2. 生成 `archive_hash`
3. 写入 archive 记录
4. 返回回放数据

### 14.8 Chain 模块

职责：
1. 统一封装链节点读取
2. 统一封装交易参数编码
3. 统一处理事件解码
4. 对外只暴露 app 所需的最小接口

---

## 15. 实时层设计

### 15.1 为什么 V2.0 不直接上 WebSocket

当前仓库是 T3 单应用。对 V2.0 来说，直接在 Next.js 首版自建长连接网关会显著增加复杂度，包括：
1. 部署方式更复杂
2. 鉴权更复杂
3. 与 App Router 的边界更难维护

因此 V2.0 首版采用 SSE。

### 15.2 SSE 方案

实现方式：
1. 聊天页初次加载时读取最近消息列表
2. 客户端连接 `/api/realtime/topics/[topicHash]`
3. 服务端将新消息事件以 SSE 推送给订阅者
4. 发送成功后服务端同时写库并广播

优势：
1. 更适合当前单仓库结构
2. 对接浏览器简单
3. 比短轮询更接近实时

未来扩展：
1. 如需高并发房间和 presence，再单独拆出 WebSocket Gateway

---

## 16. 数据库设计

### 16.1 数据库选型

1. 数据库：PostgreSQL
2. ORM：Prisma
3. 时间字段统一 UTC
4. JSON 字段使用 JSONB

### 16.2 Prisma 模型建议

以下为实现基线，不要求此刻完全逐字照搬，但模型边界必须一致。

#### `User`

用途：平台用户主表

关键字段：
1. `id`
2. `pubkey` 唯一
3. `nickname`
4. `avatarUrl`
5. `profileJson`
6. `createdAt`
7. `updatedAt`

#### `AuthChallenge`

用途：钱包登录 challenge

关键字段：
1. `id`
2. `pubkey`
3. `nonce`
4. `statement`
5. `expiresAt`
6. `usedAt`
7. `createdAt`

#### `Session`

用途：站内会话

关键字段：
1. `id`
2. `userId`
3. `tokenHash`
4. `expiresAt`
5. `lastSeenAt`
6. `createdAt`

#### `AccountVp`

用途：账户 VP 快照

关键字段：
1. `userId` 唯一
2. `vdotStakedPlanck`
3. `vpMax`
4. `vpAvailable`
5. `vpTopicLocked`
6. `updatedAt`

#### `VpLedger`

用途：VP 审计账本

关键字段：
1. `id`
2. `userId`
3. `topicId` 可选
4. `type`
5. `amount`
6. `balanceAfter`
7. `idempotencyKey` 可选
8. `metaJson`
9. `createdAt`

`type` 枚举建议：
1. `STAKE_SYNC`
2. `TOPIC_LOCK`
3. `TOPIC_UNLOCK`
4. `CHAT_COST`
5. `MANUAL_ADJUST`

#### `TopicDraft`

用途：议题草稿

关键字段：
1. `id`
2. `creatorId`
3. `configJson`
4. `configHash`
5. `topicHash`
6. `status`
7. `createdAt`
8. `updatedAt`

#### `Topic`

用途：正式议题

关键字段：
1. `id`
2. `topicHash` 唯一
3. `configHash`
4. `creatorId`
5. `category`
6. `isOpenGov`
7. `referendumId` 可选
8. `track` 可选
9. `title`
10. `summary`
11. `status`
12. `endAt`
13. `openedAt`
14. `closedAt`
15. `createdAt`
16. `updatedAt`

`category` 枚举建议：
1. `GENERAL`
2. `AI`
3. `EDUCATION`
4. `ECONOMY`
5. `NEWS`
6. `OPENGOV`

#### `TopicMember`

用途：成员关系

关键字段：
1. `id`
2. `topicId`
3. `userId`
4. `role`
5. `status`
6. `joinedAt`

`role` 枚举建议：
1. `CREATOR`
2. `PARTICIPANT`

#### `Message`

用途：聊天室消息

关键字段：
1. `id`
2. `topicId`
3. `senderId`
4. `content`
5. `settledCost`
6. `idempotencyKey`
7. `createdAt`
8. `deletedAt`

#### `Archive`

用途：归档结果

关键字段：
1. `id`
2. `topicId`
3. `status`
4. `bundleJson`
5. `archiveHash`
6. `snapshotCid` 可选
7. `anchoredAt`
8. `createdAt`

#### `ChainCursor`

用途：记录每类链事件同步进度

关键字段：
1. `id`
2. `stream`
3. `lastProcessedBlock`
4. `lastProcessedEventKey`
5. `updatedAt`

#### `ProcessedChainEvent`

用途：链事件幂等去重

关键字段：
1. `id`
2. `eventKey` 唯一
3. `blockNumber`
4. `extrinsicHash`
5. `payloadJson`
6. `processedAt`

### 16.3 索引要求

必须有以下索引：
1. `User.pubkey` 唯一
2. `Session.tokenHash` 唯一
3. `Topic.topicHash` 唯一
4. `Topic(status, createdAt desc)`
5. `Topic(creatorId, createdAt desc)`
6. `TopicMember(topicId, userId)` 唯一
7. `Message(topicId, createdAt)`
8. `VpLedger(userId, createdAt desc)`
9. `VpLedger(userId, idempotencyKey)` 唯一，且仅对非空值生效
10. `ProcessedChainEvent.eventKey` 唯一

### 16.4 事务要求

以下场景必须使用事务：

1. 创建议题并锁定 VP
2. 发送消息并扣减 VP
3. 关闭议题并返还 VP

`send message` 事务内最少包含：
1. 读取 `AccountVp`
2. 校验余额
3. 扣减 `vpAvailable`
4. 写 `Message`
5. 写 `VpLedger`

---

## 17. 智能合约设计

### 17.1 合约目标

V2.0 合约层只负责记录“关键锚点”，不负责实时聊天与复杂经济逻辑。

### 17.2 最小合约集合

V2.0 设计上使用两个合约接口：

1. `StakeManager`
2. `TopicRegistry`

注意：
1. 这里定义的是产品依赖的“接口能力”。
2. 具体实现语言可以由链团队确定，但应用层只能依赖这里定义的方法和事件。
3. AI 在实现 Web 与后端时，不应把具体链 SDK 细节散落到业务模块中。

### 17.3 `StakeManager`

职责：
1. 记录用户已质押的 vDOT 数量
2. 发出 Stake 相关事件，供后端同步

V2.0 只需要以下能力：
1. `stake(amount)`
2. `getStakeOf(account)`

事件：
1. `StakeDeposited(account, amount, newBalance)`
2. `StakeReduced(account, amount, newBalance)` 预留，V2.0 不实现退出流程时可先不暴露给产品

### 17.4 `TopicRegistry`

职责：
1. 记录链上议题哈希
2. 记录链上加入行为
3. 记录归档哈希

方法：
1. `registerTopic(topicHash, configHash)`
2. `joinTopic(topicHash)`
3. `anchorArchive(topicHash, archiveHash, snapshotCid)`

事件：
1. `TopicRegistered(creator, topicHash, configHash)`
2. `TopicJoined(account, topicHash)`
3. `ArchiveAnchored(topicHash, archiveHash, snapshotCid)`

### 17.5 智能合约存储边界

V2.0 链上只存：
1. stake 余额
2. `topicHash`
3. `configHash`
4. `join` 记录
5. `archiveHash`
6. `snapshotCid` 可选

V2.0 不上链：
1. 消息正文
2. 消息成本
3. VP 账本细节
4. 点赞
5. 情绪评分

### 17.6 合约安全要求

1. 事件字段顺序与命名必须固定。
2. `topicHash` 不可重复注册。
3. `joinTopic` 不允许重复加入。
4. `anchorArchive` 只允许对已关闭议题锚定。

---

## 18. 链同步与后台任务设计

### 18.1 为什么首版不接 The Graph

对于 V2.0，直接引入 The Graph 会增加一层额外基础设施和同步链路。为了降低实现复杂度，首版改为：

1. 直接连链节点 RPC
2. 由自有 Worker 解码事件
3. 数据库记录 cursor 与 processed event

### 18.2 Worker 拆分

V2.0 需要两个后台任务：

1. `chain-sync-worker`
2. `archive-worker`

### 18.3 `chain-sync-worker` 职责

1. 拉取 Stake 事件
2. 拉取 Topic 注册事件
3. 拉取 Join 事件
4. 拉取 Archive 锚定事件
5. 幂等写库
6. 更新 cursor

### 18.4 `archive-worker` 职责

1. 扫描已关闭但未归档的议题
2. 生成归档 bundle
3. 计算 `archive_hash`
4. 写入 `Archive`
5. 更新归档状态

### 18.5 幂等策略

链事件使用统一的 `eventKey`：

```text
eventKey = chainId:blockNumber:extrinsicHash:eventIndex
```

处理流程：
1. 若 `ProcessedChainEvent.eventKey` 已存在，则跳过
2. 否则处理业务逻辑
3. 成功后写入 `ProcessedChainEvent`

---

## 19. API 设计

### 19.1 tRPC Router 拆分

主路由固定为：

1. `auth`
2. `vp`
3. `topics`
4. `chat`
5. `archive`
6. `profile`

### 19.2 关键接口

#### `auth.challenge`

输入：
1. `pubkey`

输出：
1. `challengeId`
2. `statement`
3. `expiresAt`

#### `auth.verify`

输入：
1. `challengeId`
2. `pubkey`
3. `signature`

输出：
1. `user`
2. `session`

#### `vp.me`

输出：
1. `vdotStaked`
2. `vpMax`
3. `vpAvailable`
4. `vpTopicLocked`

#### `vp.ledger`

输出：
1. `items[]`
2. `nextCursor?`

#### `topics.createDraft`

输入：
1. `title`
2. `summary`
3. `category`
4. `endAt`
5. `isOpenGov`
6. `referendumId?`
7. `track?`

#### `topics.publishSync`

输入：
1. `draftId`
2. `topicHash`
3. `configHash`
4. `txHash`

说明：
1. 这里是“前端告知链上交易已发出”的同步接口
2. 真正生效仍以后台 Worker 监听到链上事件为准

#### `topics.listPublic`

输入：
1. `category?`
2. `status?`
3. `cursor?`

输出：
1. `items[]`
2. `nextCursor?`

#### `topics.listDrafts`

输出：
1. `items[]`

#### `topics.listMine`

输出：
1. `items[]`

#### `topics.byHash`

输入：
1. `topicHash`

输出：
1. `topic`
2. `creator`
3. `membershipStatus?`

#### `topics.joinSync`

输入：
1. `topicHash`
2. `txHash`

#### `topics.access`

输入：
1. `topicHash`

输出：
1. `canRead`
2. `canChat`
3. `membershipStatus`

#### `topics.close`

输入：
1. `topicHash`

输出：
1. `status`
2. `vpUnlocked`

#### `chat.estimate`

输入：
1. `topicHash`
2. `content`

输出：
1. `estimatedCost`
2. `breakdown`

#### `chat.send`

输入：
1. `topicHash`
2. `content`
3. `idempotencyKey`

约束：
1. 不允许客户端传 `cost`

输出：
1. `messageId`
2. `settledCost`
3. `vpAvailableAfter`

#### `chat.list`

输入：
1. `topicHash`
2. `cursor?`

输出：
1. `items[]`
2. `nextCursor?`

#### `archive.replay`

输入：
1. `topicHash`

输出：
1. `topic`
2. `archive`
3. `messages`

#### `profile.me`

输出：
1. `pubkey`
2. `nickname`
3. `avatarUrl`
4. `profileJson`

#### `profile.update`

输入：
1. `nickname?`
2. `avatarUrl?`
3. `profileJson?`

输出：
1. `profile`

---

## 20. 页面与接口映射

| 页面 | 首屏数据 | 交互接口 |
|---|---|---|
| `/` | `topics.listPublic` | 搜索、筛选 |
| `/assets` | 静态说明 + `vp.me` 可选 | 无 |
| `/vp` | `vp.me` + `vp.ledger` | 无 |
| `/topics/new` | 无 | `topics.createDraft`、`topics.publishSync` |
| `/drafts` | `topics.listDrafts` | 草稿编辑 |
| `/topics/[topicHash]` | `topics.byHash` | `topics.joinSync` |
| `/topics/[topicHash]/chat` | `topics.access` + `chat.list` | `chat.estimate`、`chat.send` |
| `/topics/[topicHash]/replay` | `archive.replay` | 无 |
| `/me/topics` | `topics.listMine` | `topics.close` |
| `/me/profile` | `profile.me` | `profile.update` |

---

## 21. 推荐目录结构

以下目录结构是 V2.0 的明确实施基线。

```text
subvote/
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ public/
├─ contracts/
│  ├─ stake-manager/
│  │  ├─ src/
│  │  ├─ tests/
│  │  ├─ scripts/
│  │  └─ README.md
│  ├─ topic-registry/
│  │  ├─ src/
│  │  ├─ tests/
│  │  ├─ scripts/
│  │  └─ README.md
│  └─ shared/
│     ├─ abi/
│     └─ types/
├─ src/
│  ├─ app/
│  │  ├─ (public)/
│  │  │  ├─ page.tsx
│  │  │  ├─ assets/page.tsx
│  │  │  ├─ topics/page.tsx
│  │  │  └─ topics/[topicHash]/
│  │  │     ├─ page.tsx
│  │  │     └─ replay/page.tsx
│  │  ├─ (app)/
│  │  │  ├─ wallet/connect/page.tsx
│  │  │  ├─ vp/page.tsx
│  │  │  ├─ drafts/page.tsx
│  │  │  ├─ topics/new/page.tsx
│  │  │  ├─ topics/[topicHash]/join/page.tsx
│  │  │  ├─ topics/[topicHash]/chat/page.tsx
│  │  │  ├─ me/topics/page.tsx
│  │  │  └─ me/profile/page.tsx
│  │  ├─ api/
│  │  │  ├─ trpc/[trpc]/route.ts
│  │  │  └─ realtime/topics/[topicHash]/route.ts
│  │  ├─ layout.tsx
│  │  └─ providers.tsx
│  ├─ components/
│  │  ├─ ui/
│  │  ├─ layout/
│  │  ├─ wallet/
│  │  ├─ vp/
│  │  ├─ topics/
│  │  └─ chat/
│  ├─ lib/
│  │  ├─ auth/
│  │  ├─ hash/
│  │  ├─ polkadot/
│  │  ├─ format/
│  │  └─ constants/
│  ├─ server/
│  │  ├─ api/
│  │  │  ├─ root.ts
│  │  │  ├─ trpc.ts
│  │  │  └─ routers/
│  │  │     ├─ auth.ts
│  │  │     ├─ vp.ts
│  │  │     ├─ topics.ts
│  │  │     ├─ chat.ts
│  │  │     ├─ archive.ts
│  │  │     └─ profile.ts
│  │  ├─ db.ts
│  │  ├─ auth/
│  │  │  ├─ session.ts
│  │  │  └─ wallet-verify.ts
│  │  ├─ services/
│  │  │  ├─ vp-service.ts
│  │  │  ├─ topic-service.ts
│  │  │  ├─ chat-service.ts
│  │  │  ├─ archive-service.ts
│  │  │  └─ chain-service.ts
│  │  ├─ jobs/
│  │  │  ├─ chain-sync-worker.ts
│  │  │  └─ archive-worker.ts
│  │  ├─ realtime/
│  │  │  ├─ sse-broker.ts
│  │  │  └─ events.ts
│  │  └─ repositories/
│  │     ├─ vp-repo.ts
│  │     ├─ topic-repo.ts
│  │     ├─ chat-repo.ts
│  │     └─ archive-repo.ts
│  ├─ styles/
│  │  └─ globals.css
│  ├─ trpc/
│  │  ├─ react.tsx
│  │  ├─ server.ts
│  │  └─ query-client.ts
│  └─ env.js
├─ tests/
│  ├─ integration/
│  ├─ e2e/
│  └─ fixtures/
├─ .env
├─ .env.example
├─ package.json
└─ subvote_V2.0_精简版_PRD_技术拆分清单.md
```

### 21.1 目录规则

1. `src/app` 只放页面、布局、Route Handlers。
2. `src/components` 放可复用 UI 组件。
3. `src/server/api/routers` 只放 tRPC 边界。
4. `src/server/services` 放业务逻辑。
5. `src/server/repositories` 放复杂查询与写库封装。
6. `src/lib/polkadot` 放链客户端与钱包适配，不允许页面里直接写原始链 SDK 逻辑。
7. `contracts` 与 `src` 平级，便于前后端共享 ABI 与类型。

---

## 22. 环境变量

V2.0 推荐最小环境变量如下：

1. `DATABASE_URL`
2. `SESSION_SECRET`
3. `NEXT_PUBLIC_APP_URL`
4. `CHAIN_RPC_URL`
5. `CHAIN_ID`
6. `CHAIN_TOPIC_REGISTRY_ADDRESS`
7. `CHAIN_STAKE_MANAGER_ADDRESS`
8. `NEXT_PUBLIC_SUPPORTED_WALLET`

如后续引入对象存储，再增加：
1. `ARCHIVE_STORAGE_BUCKET`
2. `ARCHIVE_STORAGE_REGION`
3. `ARCHIVE_STORAGE_ACCESS_KEY`
4. `ARCHIVE_STORAGE_SECRET_KEY`

---

## 23. 实现规则

为了让 AI 后续实现更稳定，本项目增加以下工程规则：

1. 所有 tRPC 输入输出必须有 zod schema。
2. 所有 hash 生成逻辑集中在 `src/lib/hash`。
3. 所有链交互集中在 `src/lib/polkadot` 与 `src/server/services/chain-service.ts`。
4. 所有 Prisma transaction 必须显式包裹关键写操作。
5. 页面组件不直接引用 Prisma。
6. 页面组件不直接写链上编码逻辑。
7. 任何需要幂等的 mutation 都必须有唯一键策略。
8. 任何会变更 VP 的行为都必须落 `VpLedger`。
9. 首屏页面取数优先走服务端，不在客户端二次请求。
10. 非范围内功能不得“顺手加上”。

---

## 24. 开发顺序

### 24.1 第一阶段：基础设施改造

1. Prisma 从 SQLite 切到 PostgreSQL
2. 建立基础数据模型
3. 建立 Session 认证
4. 清理默认 `post` 示例代码

### 24.2 第二阶段：VP 与议题

1. VP 页
2. 草稿
3. 议题列表
4. 议题详情
5. 发布同步

### 24.3 第三阶段：加入与聊天

1. 加入议题
2. `chat.estimate`
3. `chat.send`
4. SSE 实时流

### 24.4 第四阶段：链同步与归档

1. chain-sync-worker
2. 自动同步 stake/topic/join
3. close + archive-worker
4. replay 页

---

## 25. 验收标准

### 25.1 功能验收

1. 游客能浏览议题列表与详情
2. 用户能签名登录
3. 用户能看到自己的 VP 状态
4. 用户能创建议题并完成链上登记
5. 其他用户能加入议题
6. 已加入用户能发送消息并被正确扣费
7. 未加入用户不能发送消息
8. 议题关闭后能看到归档回放

### 25.2 技术验收

1. `chat.send` 不接受客户端 `cost`
2. 同一个 `idempotencyKey` 不会重复扣费
3. 所有 VP 变化都能在账本中追溯
4. 链上重复事件不会重复入库
5. 议题未完成链上登记前不会变成 `ACTIVE`
6. 加入事件未同步前不会开放聊天权限
7. 归档 `archive_hash` 与数据库 bundle 可重新计算一致

---

## 26. V2.1 以后再做的内容

只有当 V2.0 已稳定上线后，才考虑以下扩展：

1. 点赞
2. 精选区
3. 情绪计费
4. 热度倍率
5. 运营后台
6. WebSocket Gateway
7. 对象存储归档
8. 退出参与权与部分提取 vDOT

---

## 27. 最终结论

subvote V2.0 的正确实现方式，不是一次性把 OpenVoting 原方案的所有机制都搬进来，而是在当前 T3 单仓库架构上，构建一套边界清晰的最小闭环：

1. Next.js App Router 负责页面与交互
2. tRPC 负责业务接口
3. Prisma + PostgreSQL 负责持久化与事务
4. 独立 Worker 负责链同步与归档
5. 智能合约只负责 stake/topic/join/archive 四类链上锚点

只要严格按本文件实施，AI 就不需要再猜测“项目应该长什么样”，而可以直接进入结构化编码阶段。
