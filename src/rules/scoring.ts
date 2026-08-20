export type WinMethod = 'ron' | 'tsumo'

export interface ScoreInput {
  han: number
  fu: number
  dealer: boolean
  method: WinMethod
  honba?: number
}

export interface ScoreResult {
  limit: string
  total: number
  payments: readonly number[]
  label: string
}

function ceil100(value: number): number {
  return Math.ceil(value / 100) * 100
}

export function calculateScore({ han, fu, dealer, method, honba = 0 }: ScoreInput): ScoreResult {
  let base = fu * 2 ** (han + 2)
  let limit = ''
  if (han >= 13) { base = 8000; limit = '役满' }
  else if (han >= 11) { base = 6000; limit = '三倍满' }
  else if (han >= 8) { base = 4000; limit = '倍满' }
  else if (han >= 6) { base = 3000; limit = '跳满' }
  else if (han >= 5 || base >= 2000) { base = 2000; limit = '满贯' }

  if (method === 'ron') {
    const total = ceil100(base * (dealer ? 6 : 4)) + honba * 300
    return { limit, total, payments: [total], label: `${total}点` }
  }

  if (dealer) {
    const each = ceil100(base * 2) + honba * 100
    return { limit, total: each * 3, payments: [each, each, each], label: `${each}点∀` }
  }
  const child = ceil100(base) + honba * 100
  const dealerPayment = ceil100(base * 2) + honba * 100
  return { limit, total: child * 2 + dealerPayment, payments: [child, child, dealerPayment], label: `${child} / ${dealerPayment}点` }
}

export const COMMON_FU = [20, 25, 30, 40, 50, 60, 70] as const

export function scoreExplanation(input: ScoreInput): string {
  const result = calculateScore(input)
  const role = input.dealer ? '亲家' : '子家'
  const method = input.method === 'ron' ? '荣和' : '自摸'
  const limit = result.limit ? `，属于${result.limit}` : ''
  return `${role}${method}，${input.han}番${input.fu}符${limit}：${result.label}。本课程不采用切上满贯。`
}
