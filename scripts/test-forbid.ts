// 禁手算法验证脚本
// 用 tsx 直接跑 _game.ts 的纯函数

import { checkForbidden, findWinLine, createEmptyBoard } from '../cloud-functions/api/room/_game.ts'

type Board = ('black' | 'white' | null)[][]

function makeBoard(): Board {
  return createEmptyBoard()
}

function place(b: Board, r: number, c: number, color: 'black' | 'white') {
  b[r][c] = color
}

let pass = 0
let fail = 0

function assert(name: string, cond: boolean) {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name}  <<< FAIL`) }
}

console.log('=== 1. 长连禁手 ===')
{
  const b = makeBoard()
  // 黑方横排 5 连后再下一子形成 6 连
  // 先放好 4 个，第 5 步落 (7,4) 形成 5 连——但这不是禁手（恰 5 连）
  // 我们测试：已有 4 连，再下一子使其变 6 连
  place(b, 7, 3, 'black')
  place(b, 7, 5, 'black')
  place(b, 7, 6, 'black')
  place(b, 7, 7, 'black')
  place(b, 7, 8, 'black')
  // 现在 (7,3)(7,5-8) 共 5 子，中间缺 (7,4)。落 (7,4) 会形成 (7,3..8) 共 6 连
  place(b, 7, 4, 'black')
  const f = checkForbidden(b, 7, 4)
  assert('黑方形成 6 连应判长连禁手', f === 'long')
}

console.log('=== 2. 恰好 5 连不是禁手（五连胜） ===')
{
  const b = makeBoard()
  place(b, 7, 3, 'black')
  place(b, 7, 4, 'black')
  place(b, 7, 5, 'black')
  place(b, 7, 6, 'black')
  place(b, 7, 7, 'black')
  const f = checkForbidden(b, 7, 7)
  assert('黑方恰 5 连不构成禁手', f === null)
  const w = findWinLine(b, 7, 7)
  assert('黑方恰 5 连应判胜', w !== null && w.length === 5)
}

console.log('=== 3. 三三禁手 ===')
{
  const b = makeBoard()
  // 构造两个活三交汇于 (7,7)
  // 横向活三：_ O O O _  → (7,6)(7,7)(7,8) 两端空
  place(b, 7, 6, 'black')
  place(b, 7, 7, 'black')
  place(b, 7, 8, 'black')
  // 纵向活三：纵向 (5,7)(6,7)(7,7) —— 但 (7,7) 已存在，补 (5,7)(6,7)
  place(b, 5, 7, 'black')
  place(b, 6, 7, 'black')
  // (7,7) 是最后落的点，构成横+纵两个活三
  const f = checkForbidden(b, 7, 7)
  assert('黑方三三（两个活三）应判禁手', f === 'double3')
}

console.log('=== 4. 白方不受禁手限制 ===')
{
  const b = makeBoard()
  // 白方同样的三三不应禁手
  place(b, 7, 6, 'white')
  place(b, 7, 7, 'white')
  place(b, 7, 8, 'white')
  place(b, 5, 7, 'white')
  place(b, 6, 7, 'white')
  const f = checkForbidden(b, 7, 7)
  assert('白方三三不判禁手', f === null)
}

console.log('=== 5. 四四禁手 ===')
{
  const b = makeBoard()
  // 构造两个冲四交汇
  // 横向 OOOO_ (7,5)(7,6)(7,7)(7,8)，左端被白子封 → 冲四
  place(b, 7, 5, 'black')
  place(b, 7, 6, 'black')
  place(b, 7, 7, 'black')
  place(b, 7, 8, 'black')
  place(b, 7, 4, 'white')  // 封左端
  // 纵向 OOOO (5,7)(6,7)(7,7)(8,7)
  place(b, 5, 7, 'black')
  place(b, 6, 7, 'black')
  place(b, 8, 7, 'black')
  const f = checkForbidden(b, 7, 7)
  assert('黑方四四应判禁手', f === 'double4')
}

console.log('=== 6. 非禁手正常局面 ===')
{
  const b = makeBoard()
  place(b, 7, 7, 'black')
  const f = checkForbidden(b, 7, 7)
  assert('孤立一子不判禁手', f === null)
}

console.log(`\n=== 结果: ${pass} passed, ${fail} failed ===`)
if (fail > 0) process.exit(1)
