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
- [本地开发](#本地开发)
- [部署到 EdgeOne](#部署到-edgeone)
- [环境变量](#环境变量)
- [已知限制](#已知限制)

---

## 功能特性

- 房间制对战：创建房间获得 6 位房间号，分享给好友加入；也可在大厅点击“等待中的房间”直接加入。
- 实时同步：房间页 500ms 轮询拉取最新棋局状态，落子有音效与最后一手高亮。
- 胜负判定：横、竖、两条对角线任一方向连成 5 子即胜；棋盘下满判平局。
- 观战模式：大厅“对战中”的房间可进入观战，只读不参与，不影响心跳。
- 局内聊天：支持文字与表情消息，最近 50 条。
- 断线重进：本地方案记录“我的房间”，刷新/重进后可一键回到未结束的对局。
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
│       │   ├── _game.ts         # 棋盘创建 / 胜负判定 / 平局判定（纯函数）
│       │   ├── _utils.ts        # Blob 封装：getRoom / getRoomStrong / saveRoom / touchRoom / deleteRoom
│       │   ├── create.ts        # 创建房间（生成 6 位房间号）
│       │   ├── join.ts          # 加入房间（白方落座，状态 → playing）
│       │   ├── leave.ts         # 玩家离开，清理房间
│       │   ├── list.ts          # 大厅房间列表（waiting / playing）
│       │   ├── state.ts         # 拉取房间状态（玩家心跳；观战不养房间）
│       │   ├── move.ts          # 落子 + 胜负判定 + 更新排行榜
│       │   ├── reset.ts         # 再来一局（重置棋盘）
│       │   ├── rejoin.ts        # 断线重进校验（仅本局玩家）
│       │   └── chat.ts         # 局内聊天收发（GET 取 / POST 发）
│       └── leaderboard.ts       # 排行榜读取
├── src/                        # 前端源码
│   ├── components/
│   │   ├── Board.tsx            # 15×15 棋盘，落子确认、最后一手高亮、坐标
│   │   └── ChatPanel.tsx        # 聊天面板
│   ├── pages/
│   │   ├── Login.tsx            # 登录页（QQ / 微信 / 游客）
│   │   ├── Callback.tsx         # 登录回调处理页
│   │   ├── Home.tsx             # 大厅：创建/加入/我的房间/等待中/对战中
│   │   ├── Room.tsx             # 对局页：棋盘 + 玩家信息 + 状态 + 聊天
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
  board: ('black' | 'white' | null)[][]    // 15×15 棋盘
  currentTurn: 'black' | 'white'
  winner: 'black' | 'white' | 'draw' | null
  status: 'waiting' | 'playing' | 'finished'
  createdAt: number
  lastActiveAt: number                    // 心跳时间戳，用于 TTL 回收
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
| POST | `/create` | 创建房间。body: `{ nickname }`。返回完整 Room。 |
| POST | `/join` | 加入房间成为白方。body: `{ roomId, nickname }`。强一致校验房间仍为 waiting 且白方空缺，否则返回“房间已满”。 |
| POST | `/leave` | 玩家主动离开。body: `{ roomId, nickname }`。玩家离开即删除房间。 |
| GET  | `/list` | 返回大厅列表 `{ waiting: [...], playing: [...] }`，并顺带执行 TTL 回收。 |
| GET  | `/state?roomId=xxx&observer=1` | 拉取房间最新状态。非观战者会更新心跳 `lastActiveAt`（30s 节流）。 |
| POST | `/move` | 落子。body: `{ roomId, nickname, row, col }`。校验回合归属、位置有效性，判定胜负并写排行榜。 |
| POST | `/reset` | 再来一局。body: `{ roomId, nickname }`。清空棋盘；白方仍在则 playing，否则 waiting。 |
| POST | `/rejoin` | 断线重进校验。body: `{ roomId, nickname }`。仅本局玩家可重进。 |
| GET  | `/chat?roomId=xxx` | 获取局内聊天。 |
| POST | `/chat` | 发送聊天。body: `{ roomId, nickname, type:'emoji'|'text', content }`。 |

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
3. 在 EdgeOne 控制台为站点配置环境变量（见下）。
4. 部署后，云函数挂载在 `/api/*`，前端与 API 同源，无需额外配置跨域。

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
