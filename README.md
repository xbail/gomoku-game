# 五子棋在线对战 · Gomoku Online

一个基于 **EdgeOne Pages + 云函数 + Blob Storage** 的实时五子棋在线对战小游戏。支持创建/加入房间、随机匹配、观战、实时聊天、胜负判定、战绩排行榜与第三方登录，开箱即部署。

> 开源地址：<https://github.com/xbail/gomoku-game>

---

## 功能特性

- **房间制对战**：创建房间获得 6 位房间号，分享给好友加入；也可在大厅点击"等待中的房间"直接加入。
- **快速匹配**：一键匹配，自动加入无密码的等待中房间，没有则自动创建新房间。
- **私密房**：创建房间时可设置密码，加入需输入正确密码；大厅列表仅显示"私密"标识不暴露密码。
- **棋盘大小选择**：支持 9×9 / 13×13 / 15×15 三种规格，星位根据棋盘大小动态计算。
- **禁手规则**（默认关闭）：黑方长连、四四、三三禁手判定，可手动开启；白方不受限。
- **计时模式**（默认关闭）：每步 2 分钟、总时长不限，超时判负；娱乐模式默认不限时。
- **实时同步**：房间页 500ms 轮询拉取最新棋局状态，落子有音效与最后一手高亮。
- **获胜连线高亮**：五子连成时用金色发光线贯穿，获胜棋子脉动闪烁。
- **悔棋 / 求和 / 认输 / 再来一局**：悔棋撤回发起方自己的棋子，求和与再来一局需对手同意（双向确认），认输直接判负。
- **观战模式**：大厅"对战中"的房间可进入观战，只读不参与。
- **局内聊天**：支持文字与表情消息，最近 50 条。
- **断线重进**：本地记录"我的房间"，刷新/重进后可一键回到未结束的对局。
- **游客持久化**：游客昵称存入 localStorage，刷新页面不丢失。
- **战绩排行榜**：仅记录登录用户，以 socialUid 为唯一键防止刷榜；积分制排序（胜 3 分 / 平 1 分 / 负 0 分），展示胜率。
- **防自刷榜**：同一登录用户不能同时占黑白双方。
- **第三方登录**：聚合登录（QQ / 微信），也支持游客模式直接输入昵称游玩。
- **房间自动回收**：等待、对战、已结束三种状态分别有 TTL，空闲自动清理。

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
│       │   ├── callback.ts     # code 换取用户信息
│       │   └── return.ts       # OAuth 回调落地页
│       ├── room/               # 房间与对局逻辑
│       │   ├── _game.ts        # 棋盘创建 / 胜负判定 / 禁手判定
│       │   ├── _timer.ts       # 计时工具
│       │   ├── _utils.ts       # Blob 封装 + 排行榜读写（版本化）
│       │   ├── create.ts       # 创建房间
│       │   ├── match.ts        # 快速匹配
│       │   ├── join.ts        # 加入房间
│       │   ├── kick.ts         # 房主解散房间
│       │   ├── leave.ts        # 玩家离开
│       │   ├── list.ts         # 大厅房间列表
│       │   ├── state.ts         # 拉取房间状态
│       │   ├── move.ts         # 落子 + 胜负判定 + 禁手 + 排行榜
│       │   ├── request.ts       # 悔棋/求和/再来一局（双向确认）
│       │   ├── action.ts        # 认输
│       │   ├── rejoin.ts        # 断线重进
│       │   └── chat.ts         # 局内聊天
│       └── leaderboard.ts       # 排行榜读取（带版本校验自动清理旧数据）
├── src/                        # 前端源码
│   ├── components/
│   │   ├── Board.tsx            # 棋盘组件（获胜连线高亮）
│   │   └── ChatPanel.tsx       # 聊天面板
│   ├── pages/
│   │   ├── Login.tsx           # 登录页（含游客持久化）
│   │   ├── Callback.tsx        # 登录回调页
│   │   ├── Home.tsx            # 大厅首页
│   │   ├── Room.tsx            # 对局页
│   │   ├── Leaderboard.tsx    # 排行榜（积分制）
│   │   └── UserCenter.tsx      # 个人中心
│   ├── api.ts                  # API 封装 + 本地存储
│   ├── types.ts                # 类型定义
│   ├── sound.ts                # 落子音效
│   ├── App.tsx                 # 路由
│   ├── main.tsx                # 入口
│   └── index.css               # 全局样式
├── index.html
├── vite.config.ts
├── edgeone.json                # EdgeOne 部署配置
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

### 房间 Room（key = 房间号）

```ts
interface Room {
  id: string                              // 6 位房间号
  players: {
    black: { nickname: string; socialUid?: string }   // 房主（黑方）
    white: { nickname: string; socialUid?: string } | null  // 加入者（白方）
  }
  board: ('black' | 'white' | null)[][]    // 棋盘（9/13/15）
  boardSize: number                        // 棋盘大小（9/13/15，默认 15）
  currentTurn: 'black' | 'white'
  winner: 'black' | 'white' | 'draw' | null
  winLine?: [number, number][] | null      // 获胜的 5 连位置（用于高亮）
  status: 'waiting' | 'playing' | 'finished'
  createdAt: number
  lastActiveAt: number                    // 心跳时间戳
  moves?: MoveRecord[]                    // 棋谱
  request?: ConsentRequest | null        // 当前未决请求
  forbid: boolean                         // 是否启用禁手（默认 false）
  timer: { perMoveMs: number; totalMs: number }  // 计时配置（0 = 不限）
  password: string | null                // 私密房密码
  turnStartAt: number
  blackUsedMs: number
  whiteUsedMs: number
  timeLoser: 'black' | 'white' | null
  messages?: ChatMessage[]
}
```

### 排行榜 Leaderboard（key = `_leaderboard`）

```ts
// 版本化存储，旧格式数据自动清理
interface LeaderboardData {
  version: number                          // 当前版本号 = 2
  entries: Record<socialUid, {
    nickname: string
    wins: number
    losses: number
    draws: number
  }>
}
```

仅记录有 `socialUid` 的登录用户，以 `socialUid` 为唯一键，游客不记入排行榜。数据带版本号，旧格式数据读取时自动清空重置。

## 对局规则

### 禁手（默认关闭）

可手动开启。黑方落子若形成长连（≥6 连）、四四、三三，判黑方负、白方胜。白方不受禁手限制。

### 计时（默认关闭）

可手动开启，每步 2 分钟、总时长不限。仅单步超时判负。后端在落子和轮询两处检查超时。

### 悔棋

悔棋撤回**发起方自己**刚下的最后一步棋（从棋谱末尾向前找到发起方的最后一手），同时撤回之后对方可能已下的棋子，回合回到发起方。需对手同意。

### 求和 / 认输 / 再来一局

- **求和**：直接判平局，需对手同意。
- **认输**：发起方直接判负，无需确认。
- **再来一局**：清空棋盘重新开始，需对手同意。

### 获胜连线高亮

判定胜负时记录 `winLine`（5 连坐标），前端用金色发光线贯穿五子，获胜棋子脉动闪烁。

## 排行榜设计

- **仅登录用户**：以 `socialUid` 为唯一键，游客不记入。
- **防自刷榜**：同一 `socialUid` 不能同时占黑白双方（join 和 match 双重校验）。
- **积分制排序**：胜 +3 分、平 +1 分、负 0 分；积分相同比胜场，再比负场少。
- **版本化存储**：数据带 `version` 字段，旧格式数据自动清理，无需手动操作。
- **条目校验**：读取时校验每条数据格式，过滤无效条目。

## 防刷榜机制

| 机制 | 说明 |
| --- | --- |
| 仅登录用户记录 | 游客无 socialUid，不记入排行榜 |
| socialUid 唯一键 | 同名昵称不会合并，每个账号独立统计 |
| 禁止自对战 | 同一 socialUid 不能同时占黑白双方 |
| 强一致读写 | 排行榜读写均用强一致读，避免并发覆盖 |

## 一致性设计

EdgeOne Blob Storage 的 `get(key)` 默认是最终一致读取，`get(key, { consistency: "strong" })` 才是强一致读取。

- **判定与变更路径**（join / move / request / state / rejoin）一律使用强一致读。
- **大厅列表 `list.ts`** 对每个房间用强一致读。
- **排行榜**的读与写均使用强一致读。
- 弱一致读仅用于 `create.ts` 生成房间号时的查重（碰撞概率极低）。
- **密码安全**：所有返回给前端的接口均通过解构剔除密码明文。

## 本地开发

```bash
# 安装依赖
npm install

# 本地前端开发
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
3. 确认云函数存储依赖已配置：`edgeone.json` 中 `"node-functions": { "external_node_modules": ["@edgeone/pages-blob"] }`（本项目已配好）。
4. 在 EdgeOne 控制台为站点配置环境变量。
5. 部署后，云函数挂载在 `/api/*`，前端与 API 同源，无需额外配置跨域。

## 环境变量

| 变量名 | 说明 |
| --- | --- |
| `JHDL_APPID` | 聚合登录 juhedenglu.cn 的 AppID |
| `JHDL_APPKEY` | 聚合登录 juhedenglu.cn 的 AppKey |

未配置时登录接口返回提示，游客模式仍可使用。

## 已知限制

- 实时性依赖轮询，未使用 WebSocket / 长连接，落子有最高约 500ms 的可见延迟。
- Blob Storage 不提供原子的条件写（CAS），极端竞态理论上仍可能发生；强一致读 + 双重校验已覆盖实际场景。
- 游客昵称持久化在 localStorage，清除浏览器数据后会丢失。

---

Gomoku Online · EdgeOne Makers · [GitHub](https://github.com/xbail/gomoku-game)
