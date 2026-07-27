# 五子棋在线对战 · Gomoku Online

一个基于 **EdgeOne Pages + 云函数 + Blob Storage** 的实时五子棋在线对战小游戏。支持创建/加入房间、随机匹配、观战、实时聊天、胜负判定、战绩排行榜与第三方登录，开箱即部署。

---

## 目录

- [功能特性](#功能特性)
- [技术栈](#技术栈)
- [项目结构](#项目结构)
- [整体架构](#整体架构)
- [数据模型](#数据模型)
- [房间状态机](#房间状态机)
- [云函数 API 参考](#云函数-api-参考)
- [登录流程](#登录流程)
- [一致性设计说明（重要）](#一致性设计说明重要)
- [本次修复的 Bug](#本次修复的-bug)
- [v3 体验修复](#v3-体验修复)
- [对局规则（v2 新增）](#对局规则v2-新增)
- [匹配与房间层（Phase 2 新增）](#匹配与房间层phase-2-新增)
- [本地开发](#本地开发)
- [部署到 EdgeOne](#部署到-edgeone)
- [Blob Storage 配置说明](#blob-storage-配置说明)
- [环境变量](#环境变量)
- [已知限制](#已知限制)

---

## 功能特性

- 房间制对战：创建房间获得 6 位房间号，分享给好友加入；也可在大厅点击"等待中的房间"直接加入。
- 快速匹配：一键匹配，自动加入无密码的等待中房间，没有则自动创建新房间。
- 私密房：创建房间时可设置密码，加入需输入正确密码；大厅列表仅显示"私密"标识不暴露密码。
- 棋盘大小选择：支持 9×9 / 13×13 / 15×15 三种规格，星位根据棋盘大小动态计算。
- 房间配置展示：大厅列表展示每个房间的禁手/计时/棋盘大小/加密标识，一目了然。
- 房主解散：等待阶段房主可解散房间，取消等待。
- 实时同步：房间页 500ms 轮询拉取最新棋局状态，落子有音效与最后一手高亮。
- 胜负判定：横、竖、两条对角线任一方向连成 5 子即胜；棋盘下满判平局。
- 黑方禁手：长连、四四、三三禁手判定（可开关），白方不受限。
- 计时模式：每步 2 分钟、总时长不限，超时判负（可开关）；娱乐节奏，不因总时长判负。
- 悔棋 / 求和 / 认输 / 再来一局：悔棋与求和需对手同意（双向确认），认输直接判负，再来一局也需双向确认。
- 观战模式：大厅"对战中"的房间可进入观战，只读不参与，不影响心跳。
- 局内聊天：支持文字与表情消息，最近 50 条。
- 断线重进：本地方案记录"我的房间"，刷新/重进后可一键回到未结束的对局。
- 战绩排行榜：按胜场排序，展示胜/负/平与胜率。
- 第三方登录：聚合登录（QQ / 微信），也支持游客模式直接输入昵称游玩。
- 房间自动回收：等待、对战、已结束三种状态分别有 TTL，空闲自动清理。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | React 19 + TypeScript + Vite |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite` 插件） |
| 后端 | EdgeOne Pages 云函数（`onRequest` 边缘函数） |
| 存储 | EdgeOne Blob Storage（`@edgeone/pages-blob`） |
| 登录 | 聚合登录 juhedenglu.cn（QQ / 微信 OAuth） |
| 代码规范 | oxlint |

## 项目结构

```
gomoku-game/
├── cloud-functions/            # 边缘云函数（后端 API）
│   └── api/
│       ├── auth/               # 登录相关
│       │   ├── login.ts        # 获取第三方登录跳转地址
│       │   ├── callback.ts     # code 换取用户信息（给前端调用）
│       │   └── return.ts        # OAuth 回调落地页，写 localStorage 后跳回首页
│       ├── room/               # 房间与对局逻辑
│       │   ├── _game.ts         # 棋盘创建 / 胜负判定 / 禁手判定（纯函数，支持 9/13/15 棋盘）
│       │   ├── _timer.ts        # 计时工具：超时检测 / 结算用时 / 剩余时间计算
│       │   ├── _utils.ts        # Blob 封装：getRoom / getRoomStrong / saveRoom / touchRoom / deleteRoom
│       │   ├── create.ts        # 创建房间（6 位房间号 + 配置：棋盘/禁手/计时/密码）
│       │   ├── match.ts         # 快速匹配（自动加入无密码等待房，无则创建新房）
│       │   ├── join.ts          # 加入房间（白方落座，密码校验，状态 → playing）
│       │   ├── kick.ts          # 房主解散房间（仅 waiting 阶段）
│       │   ├── leave.ts         # 玩家离开，清理房间
│       │   ├── list.ts          # 大厅房间列表（含配置标识：密码/禁手/计时/棋盘大小）
│       │   ├── state.ts         # 拉取房间状态（玩家心跳；观战不养房间；检查超时）
│       │   ├── move.ts          # 落子 + 胜负判定 + 禁手判定 + 超时判定 + 更新排行榜
│       │   ├── request.ts       # 悔棋/求和/再来一局（双向确认）
│       │   ├── action.ts        # 认输
│       │   ├── reset.ts         # 再来一局（重置棋盘，保留配置）
│       │   ├── rejoin.ts        # 断线重进校验（仅本局玩家）
│       │   └── chat.ts         # 局内聊天收发（GET 取 / POST 发）
│       └── leaderboard.ts       # 排行榜读取
├── src/                        # 前端源码
│   ├── components/
│   │   ├── Board.tsx            # 棋盘组件（动态 9/13/15，落子确认、最后一手高亮、坐标）
│   │   └── ChatPanel.tsx        # 聊天面板
│   ├── pages/
│   │   ├── Login.tsx            # 登录页（QQ / 微信 / 游客）
│   │   ├── Callback.tsx         # 登录回调处理页
│   │   ├── Home.tsx             # 大厅：创建/匹配/加入/我的房间/等待中（含配置标识）/对战中
│   │   ├── Room.tsx             # 对局页：棋盘 + 玩家信息 + 计时 + 状态 + 聊天 + 解散
│   │   ├── Leaderboard.tsx      # 排行榜
│   │   └── UserCenter.tsx       # 个人中心（我的战绩）
│   ├── api.ts                   # 前端 API 封装 + 本地存储工具
│   ├── types.ts                 # 全局类型定义
│   ├── sound.ts                 # 落子音效
│   ├── App.tsx                  # 路由与全局状态
│   ├── main.tsx                 # 入口
│   └── index.css                # 全局样式（Tailwind + 棋子样式）
├── index.html
├── vite.config.ts
├── edgeone.json                # EdgeOne Pages 部署配置
├── tsconfig*.json
└── package.json
```

## 整体架构

```
┌──────────────┐   fetch /api/*   ┌────────────────────────┐   Blob KV   ┌──────────────┐
│  浏览器前端   │ ───────────────▶ │  EdgeOne 边缘云函数      │ ──────────▶ │ Blob Storage │
│  React SPA   │ ◀─────────────── │  (cloud-functions/api)  │ ◀────────── │  GAME_BLOB   │
└──────────────┘    JSON 响应      └────────────────────────┘             └──────────────┘
       │                                                                      ▲
       │ OAuth 跳转                                                            │ 读写房间/排行榜
       ▼                                                                      │
┌──────────────────┐    code 换信息     ┌──────────────────┐                  │
│ 聚合登录 juhedenglu│ ◀──────────────▶ │  auth/login 等    │ ─────────────────┘
└──────────────────┘                   └──────────────────┘
```

- 前端为单页应用，所有数据通过 `fetch` 调用同源的 `/api/*` 边缘函数。
- 后端为无状态云函数，所有持久化都落在名为 `GAME_BLOB` 的 Blob Store 中：房间以房间号为 key，排行榜以 `_leaderboard` 为 key。
- 实时性由前端轮询实现：大厅 4s、对局 500ms、聊天 2s。

## 数据模型

### 房间 Room（key = 房间号，如 `AB12CD`）

```ts
interface Room {
  id: string                              // 6 位房间号
  players: {
    black: { nickname: string }           // 房主（黑方）
    white: { nickname: string } | null    // 加入者（白方）
  }
  board: ('black' | 'white' | null)[][]    // 棋盘（9/13/15）
  boardSize: number                        // 棋盘大小（9/13/15，默认 15）
  currentTurn: 'black' | 'white'
  winner: 'black' | 'white' | 'draw' | null
  winLine?: [number, number][] | null      // 获胜的 5 连位置（用于高亮）
  status: 'waiting' | 'playing' | 'finished'
  createdAt: number
  lastActiveAt: number                    // 心跳时间戳，用于 TTL 回收
  moves?: MoveRecord[]                    // 棋谱（含坐标、颜色、时间）
  request?: ConsentRequest | null        // 当前未决请求（悔棋/求和/再来一局）
  forbid: boolean                         // 是否启用黑方禁手规则
  timer: { perMoveMs: number; totalMs: number }  // 计时配置（0 = 不限）
  password: string | null                // 私密房密码（null = 公开房）
  turnStartAt: number                     // 当前回合开始时间戳
  blackUsedMs: number                      // 黑方已用总时间
  whiteUsedMs: number                      // 白方已用总时间
  timeLoser: 'black' | 'white' | null     // 因超时判负的一方
  messages?: ChatMessage[]                // 局内聊天（最近 50 条）
}
```

### 排行榜 Leaderboard（key = `_leaderboard`）

```ts
// Record<nickname, 统计>
interface LeaderboardEntry {
  nickname: string
  wins: number
  losses: number
  draws: number
}
```

仅在落子产生胜负/平局时由 `move.ts` 的 `updateLeaderboard` 更新；以游戏昵称为 key，游客与登录用户均会记录。

## 房间状态机

```
            create()                 join()
   (无) ─────────────▶ waiting ─────────────▶ playing
                         │                      │
                         │ leave() / TTL        │ 出现胜者 / 平局 (move)
                         ▼                      ▼
                       (删除)                finished
                                                 │  reset()（双方仍在）
                                                 ▼
                                              playing（无白方则 waiting）
                                       finished TTL / leave() → (删除)
```

TTL（基于 `lastActiveAt`，见 `list.ts`）：

| 状态 | 空闲回收时长 |
| --- | --- |
| waiting | 3 分钟 |
| playing | 60 秒（双方都不再心跳） |
| finished | 30 秒 |

## 云函数 API 参考

所有接口均返回 `{ ok: boolean, data?: T, error?: string }`。

### 房间 `/api/room/*`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/create` | 创建房间。body: `{ nickname, forbid?, timed?, boardSize?, password? }`。`forbid`/`timed` 默认 true，`boardSize` 默认 15（可选 9/13/15），`password` 留空为公开房。返回 Room（不含密码）。 |
| POST | `/match` | 快速匹配。body: `{ nickname, forbid?, timed?, boardSize? }`。自动加入无密码的等待中房间，无则创建新房。返回 `{ ok, data, matched }`。 |
| POST | `/join` | 加入房间成为白方。body: `{ roomId, nickname, password? }`。强一致校验 + 密码校验。 |
| POST | `/kick` | 房主解散房间。body: `{ roomId, nickname }`。仅 waiting 阶段、仅黑方可操作。 |
| POST | `/leave` | 玩家主动离开。body: `{ roomId, nickname }`。玩家离开即删除房间。 |
| GET  | `/list` | 返回大厅列表 `{ waiting: [...], playing: [...] }`，waiting 含 hasPassword/forbid/timed/boardSize，并执行 TTL 回收。 |
| GET  | `/state?roomId=xxx&observer=1` | 拉取房间最新状态。非观战者更新心跳，并检查超时判负。 |
| POST | `/move` | 落子。body: `{ roomId, nickname, row, col }`。校验回合/位置/禁手/超时，判定胜负并写排行榜。 |
| POST | `/request` | 悔棋/求和/再来一局（双向确认）。body: `{ roomId, nickname, action, type? }`。见下表。 |
| POST | `/action` | 认输。body: `{ roomId, nickname, action:'resign' }`。 |
| POST | `/rejoin` | 断线重进校验。body: `{ roomId, nickname }`。仅本局玩家可重进。 |
| GET  | `/chat?roomId=xxx` | 获取局内聊天。 |
| POST | `/chat` | 发送聊天。body: `{ roomId, nickname, type:'emoji'|'text', content }`。 |

#### `/request` 接口动作说明

`action` 取值：`request`（发起）/ `accept`（同意）/ `decline`（拒绝）/ `cancel`（取消，仅发起方）。

| type | 可发起阶段 | 接受后效果 |
| --- | --- | --- |
| `undo` | playing | 撤回最后一步，回合回到落子方 |
| `draw` | playing | 直接平局 |
| `reset` | finished | 清空棋盘再来一局 |

存在未决请求时，落子接口会拒绝（需先处理请求）。

### 登录 `/api/auth/*`

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/login?type=qq|wx&origin=...` | 获取聚合登录跳转地址。 |
| GET | `/callback?type=...&code=...` | 用 code 换取用户信息（前端调用）。 |
| GET | `/return?code=...` | OAuth 回调落地页：写 `gomoku_user` 到 localStorage 并跳回首页。 |

### 排行榜

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/leaderboard` | 返回 `Record<nickname, LeaderboardEntry>`。 |

## 登录流程

1. 用户在 `Login.tsx` 选择 QQ / 微信 → 调 `/api/auth/login` 拿到跳转地址。
2. 浏览器跳转到聚合登录页完成授权，回调到 `/api/auth/return?code=xxx`。
3. `return.ts` 用 code 调聚合登录接口换取用户信息（昵称、头像、socialUid 等）。
4. 将用户信息写入返回 HTML 的 `<script>`，由前端写入 `localStorage("gomoku_user")`，再跳回 `/`。
5. `App.tsx` 读取 `gomoku_user` 恢复登录态；游客模式则直接用输入的昵称进入。

## 一致性设计说明（重要）

EdgeOne Blob Storage 的 `get(key)` 默认是**最终一致**读取，`get(key, { consistency: "strong" })` 才是**强一致**读取。本项目的核心 Bug 多源于此。

- `_utils.ts` 同时提供 `getRoom`（弱一致）与 `getRoomStrong`（强一致）。
- **判定与变更路径**（join / move / reset / state / rejoin / chat）一律使用强一致读，避免基于陈旧数据做决策。
- **大厅列表 `list.ts`** 对每个房间用强一致读，保证首页展示的状态是最新的。
- **排行榜**的读与写均使用强一致读，避免并发结算时后写覆盖先写导致条目丢失。
- 仍保留弱一致读的地方：`create.ts` 生成房间号时的查重（碰撞概率极低，弱读可接受）。
- **密码安全**：`password` 字段仅存储在 Blob 中，所有返回给前端的接口（create / join / state / rejoin / match）均通过解构 `const { password, ...safeRoom } = room` 剔除密码明文，前端永远拿不到密码。

## 本次修复的 Bug

### Bug 1：首页“等待中”的房间，明明有人加入了却没变成“对战中”

**根因**：`list.ts` 用最终一致读拉取房间数据，会读到陈旧的 `waiting` 状态，导致已开始的对局仍显示在“等待中”列表里。

**修复**：`list.ts` 对每个房间改用 `store.get(key, { consistency: "strong" })` 强一致读，首页状态实时准确。

### Bug 2：别人还能加入“对战中”的房间，把里面某位玩家挤掉

**根因**：`join.ts` 用 `getRoom`（弱一致读）判断房间状态，可能读到陈旧的 `waiting`，于是后加入者通过校验，直接覆盖掉已有的白方玩家（`room.players.white = { nickname }`），原白方被“踢”出。

**修复**：
- `join.ts` 改用 `getRoomStrong` 强一致读；
- 增加**双重校验**：`room.status !== "waiting" || room.players?.white` 均判为“房间已满”，即使状态字段异常也能挡住重复加入。

### Bug 3：排行榜只显示部分人（条目丢失）

**根因**：`move.ts` 的 `updateLeaderboard` 与 `leaderboard.ts` 都用弱一致读读写 `_leaderboard`。并发结算时两者都读到陈旧数据，后写覆盖先写，导致部分玩家战绩条目丢失，排行榜看起来“只剩个别人”。

**修复**：`updateLeaderboard`（写前读）与 `leaderboard.ts`（展示读）均改用强一致读，大幅缩小竞态窗口，保证战绩完整。

> 说明：本次按“排行榜应完整展示所有对战过的玩家（含游客）”来修复数据一致性。若你实际希望排行榜**仅展示已登录用户、排除游客昵称**，可在此基础上增加登录态标记并过滤，告诉我即可补上。

### 附带：`reset.ts` 强一致化

“再来一局”同样属于变更路径，原为弱读，一并改为 `getRoomStrong`，避免基于陈旧数据误判权限/状态。

## v3 体验修复

针对娱乐场景的三处优化：

### 1. Blob Storage 连接失败：云函数未打包存储 SDK

**现象**：部署后创建/加入/列表接口全部 500，像「数据库没连上」。

**根因**：本项目是「Vite 前端 + 云函数」混合工程，`edgeone.json` 指定了 `buildCommand` 与 `outputDirectory`，构建器默认只处理前端产物，不会自动把 `@edgeone/pages-blob` 复制到云函数运行时。导致云函数 `import { getStore } from "@edgeone/pages-blob"` 失败，所有依赖存储的接口崩溃。

**修复**：
- `edgeone.json` 增加 `"node-functions": { "external_node_modules": ["@edgeone/pages-blob"] }`，让构建器正确打包该依赖。
- Blob 命名空间 `GAME_BLOB` 由平台首次调用 `getStore()` 时自动创建，控制台不能手动新建——之前误提示用户去控制台创建命名空间，已更正。
- 各接口 catch 改为 `e.message`，错误信息更可读。
- `_utils.ts` 还原为官方标准写法（顶层 `getStore`），去除之前为绕开问题而加的懒加载 Proxy。

### 2. 边缘棋子被裁切只显示一半

**根因**：棋盘交叉点坐标从 `0%` 到 `100%`，最外圈棋子中心贴在容器边缘，被 `overflow-hidden` 裁掉一半。

**修复**：`Board.tsx` 的 `intersectionPct` 改为从半格处（`50/GAPS %`）开始、到 `100% - 半格` 结束，交叉点内缩半格，边缘棋子完整显示。SVG 网格线、星位、点击热区同步对齐。

### 3. 计时过于严格

**根因**：默认每步 30 秒、总时长 10 分钟，娱乐对局容易因总时长耗尽判负。

**修复**：`_timer.ts` 的 `DEFAULT_TIMER` 改为每步 2 分钟（`perMoveMs: 120_000`）、总时长不限（`totalMs: 0`），仅单步超时判负，节奏更宽松。

## 对局规则（v2 新增）

本版本将对局从"自由五子棋"升级为接近竞技连珠的正规规则：

### 黑方禁手

创建房间默认启用禁手（`forbid: true`）。黑方落子若形成以下任一形态，判黑方负、白方胜：

| 禁手 | 说明 |
| --- | --- |
| 长连 | 任一方向连续同色 ≥ 6 |
| 四四 | 同时形成两个「四」（活四/冲四） |
| 三三 | 同时形成两个「活三」 |

判定逻辑见 `cloud-functions/api/room/_game.ts` 的 `checkForbidden`。白方不受禁手限制，长连仍判胜。

### 计时

创建房间默认启用计时（`timed: true`），配置为：每步 2 分钟、总时长不限（`totalMs: 0`）。仅单步超时会判超时方负，不再因总时长判负，节奏更偏娱乐。

- 计时由后端在 `move.ts`（落子时）和 `state.ts`（轮询时）两处检查，保证即使一方挂机也能判负。
- 前端在玩家信息条实时显示剩余时间（每步/总时长）。

### 悔棋 / 求和 / 认输 / 再来一局

对局进行中，玩家可发起：
- **悔棋**：撤回最后一步，回合回到落子方。需对手同意。
- **求和**：直接判平局。需对手同意。
- **认输**：发起方直接判负，无需对手确认。

对局结束后可发起**再来一局**（reset），同样需对手同意——此前 reset 是任一方单方面触发，现改为双向确认。

所有"需对手同意"的操作走 `/api/room/request` 接口，形成 `ConsentRequest` 记录挂载在房间上。存在未决请求时，落子接口会拒绝，必须先处理请求（同意/拒绝/取消）。前端在房间页顶部展示请求横幅。

### 获胜连线高亮

判定胜负时记录 `winLine`（5 连坐标），前端在棋盘上高亮获胜的 5 子。

### 棋谱记录

每步落子记录到 `room.moves`（含坐标、颜色、时间），用于悔棋回退与未来复盘功能。

## 匹配与房间层（Phase 2 新增）

### 快速匹配

点击"快速匹配"按钮，后端 `match.ts` 扫描所有等待中的无密码房间，强一致校验后自动加入。若无合适房间则自动创建一个公开房间。匹配仅加入无密码房间，私密房需手动输入房间号加入。

### 私密房

创建房间时可设置密码（最长 20 字符）。设密码的房间在大厅列表中标记"私密"图标，点击加入时弹出密码输入框。密码校验在后端 `join.ts` 完成，密码明文从不返回给前端。

### 棋盘大小

支持 9×9 / 13×13 / 15×15 三种棋盘规格。创建时选择，棋盘大小存储在 `room.boardSize` 中，所有游戏逻辑（胜负判定、禁手检测、边界检查）均基于 `board.length` 动态适配。棋盘组件的星位也根据大小动态计算。

### 房间配置展示

大厅列表中每个等待中的房间显示配置标识：
- **私密** — 有密码
- **9×9 / 13×13** — 非标准棋盘（15×15 不显示）
- **禁手** — 启用禁手规则
- **计时** — 启用计时模式

### 房主解散

等待阶段（waiting），房主（黑方）可点击"解散房间"按钮取消等待。后端 `kick.ts` 校验权限后直接删除房间。对局开始后不可解散（需使用认输或离开）。

### 测试

禁手算法附带单元测试：

```bash
npx tsx scripts/test-forbid.ts
```

覆盖长连、恰五连、三三、四四、白方豁免等场景。

## 本地开发

```bash
# 安装依赖
npm install

# 本地前端开发（Vite dev server）
npm run dev

# 类型检查 + 构建
npm run build

# 预览构建产物
npm run preview

# 代码检查
npm run lint
```

> 注意：云函数依赖 EdgeOne 运行时与 Blob Storage，本地 `npm run dev` 仅能调试前端；完整联调请在 EdgeOne Pages 环境中进行。

## 部署到 EdgeOne

1. 将本仓库导入 EdgeOne Pages。
2. `edgeone.json` 已配置：构建命令 `npm run build`，输出目录 `dist`。
3. **确认云函数存储依赖已配置（重要，不配则所有接口报错）**：`edgeone.json` 中需配置 `"node-functions": { "external_node_modules": ["@edgeone/pages-blob"] }`（本项目已配好）。该配置让构建器把 `@edgeone/pages-blob` SDK 正确打包进云函数产物；缺失时云函数 `import` 失败，所有接口 500，表现为"数据库连不上"。Blob 命名空间 `GAME_BLOB` 由平台在首次调用 `getStore()` 时自动创建，控制台不支持手动新建，无需任何额外操作。
4. 在 EdgeOne 控制台为站点配置环境变量（见下）。
5. 部署后，云函数挂载在 `/api/*`，前端与 API 同源，无需额外配置跨域。

## Blob Storage 配置说明

本项目所有持久化（房间、对局状态、排行榜）都落在名为 `GAME_BLOB` 的 Blob Storage 命名空间上，**这是「数据库」**。首次部署后若出现以下现象，多半是云函数未正确加载 `@edgeone/pages-blob` SDK：

- 创建/加入/匹配房间失败，接口返回 500
- 大厅列表加载失败 / 一直空白
- 落子等任意接口报错

**根因与修复：**

本项目是「Vite 前端 + 云函数」混合工程，`edgeone.json` 指定了 `buildCommand` 与 `outputDirectory`，构建器默认只处理前端产物，不会自动把 `@edgeone/pages-blob` 复制到云函数运行时。必须显式声明：

```jsonc
{
  "node-functions": {
    "external_node_modules": ["@edgeone/pages-blob"]
  }
}
```

本项目 `edgeone.json` 已包含此配置。若你 fork 后精简过该文件，请确保这一项存在，否则云函数 `import { getStore } from "@edgeone/pages-blob"` 会直接失败。

> Blob 命名空间 `GAME_BLOB` 由平台在首次调用 `getStore("GAME_BLOB")` 时自动创建，控制台仅支持只读浏览，不能手动新建。命名空间名称可在 `cloud-functions/api/room/_utils.ts` 顶部的 `getStore("GAME_BLOB")` 调用处修改。

## 环境变量

云函数 `auth/*` 需要以下聚合登录参数（在 EdgeOne 环境变量中配置）：

| 变量名 | 说明 |
| --- | --- |
| `JHDL_APPID` | 聚合登录 juhedenglu.cn 的 AppID |
| `JHDL_APPKEY` | 聚合登录 juhedenglu.cn 的 AppKey |

未配置时，登录接口会返回“未配置聚合登录参数”，游客模式仍可使用。

## 已知限制

- 实时性依赖轮询，未使用 WebSocket / 长连接，落子有最高约 500ms 的可见延迟。
- Blob Storage 不提供原子的条件写（CAS），理论上“两人同一毫秒加入同一房间”的极端竞态仍可能发生；本次修复（强一致读 + 双重校验）已覆盖实际使用中遇到的场景。
- 游客模式昵称仅存于浏览器内存，刷新页面会回到登录页（登录用户的 `gomoku_user` 持久化在 localStorage）。
- 排行榜以昵称为 key，同名昵称会合并统计。

---

Gomoku Online · EdgeOne Makers
