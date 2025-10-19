'use client'

import { getTokens, ChainType, type Token, type Route } from '@lifi/sdk'

export type Intent = {
  source_token: string | null
  target_token: string | null
  amount: number | null
  source_chain: string | null
  target_chain: string | null
}

export const CHAIN_IDS: Record<string, number> = {
  ethereum: 1,
  mainnet: 1,
  arbitrum: 42161,
  polygon: 137,
  matic: 137,
  bsc: 56,
  binance: 56,
  optimism: 10,
  base: 8453,
  avalanche: 43114,
}

export const CHAIN_ALIASES: Record<string, string> = {
  eth: 'ethereum',
  ethereum: 'ethereum',
  'ethereum mainnet': 'ethereum',
  'eth mainnet': 'ethereum',
  'ethereum chain': 'ethereum',
  mainnet: 'ethereum',
  arbitrum: 'arbitrum',
  'arbitrum one': 'arbitrum',
  'arbitrum 1': 'arbitrum',
  polygon: 'polygon',
  matic: 'polygon',
  optimism: 'optimism',
  op: 'optimism',
  base: 'base',
  avalanche: 'avalanche',
  avax: 'avalanche',
  bsc: 'bsc',
  binance: 'bsc',
  'binance smart chain': 'bsc',
  bnb: 'bsc',
  'bnb chain': 'bsc',
}

export function normalizeName(value?: string | null) {
  return (value || '').toLowerCase().trim()
}

export function normalizeTokenSymbol(value?: string | null) {
  const v = normalizeName(value)
    .replace(/\b(token|coin)\b/g, '')
    .replace(/s\b$/, '')
    .trim()
  if (v === 'weth') return 'WETH'
  if (v === 'eth') return 'ETH'
  if (v === 'usdt' || v === 'tether' || v === 'usdts') return 'USDT'
  if (v === 'usdc') return 'USDC'
  if (v === 'dai') return 'DAI'
  return v.toUpperCase()
}

export function normalizeChainAlias(value?: string | null) {
  const raw = normalizeName(value).replace(/\b(chain|network)\b/g, '').trim()
  if (!raw) return ''
  // filter out generic words misheard by STT/LLM
  if (raw === 'token' || raw === 'tokens' || raw === 'coin' || raw === 'coins') {
    return ''
  }
  if (CHAIN_ALIASES[raw]) return CHAIN_ALIASES[raw]
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (CHAIN_ALIASES[collapsed]) return CHAIN_ALIASES[collapsed]
  const stripped = collapsed.replace(/\b(one|1)\b/g, '').replace(/\s+/g, ' ').trim()
  if (CHAIN_ALIASES[stripped]) return CHAIN_ALIASES[stripped]
  return raw
}

export function extractLocalIntent(text: string): Partial<Intent> {
  const out: Partial<Intent> = {}
  const t = (text || '').toLowerCase()
  const amtToken = t.match(/\b(?:swap|bridge)\s+(\d+(?:[.,]\d+)?)\s*([a-z][a-z0-9]*)/i)
  if (amtToken) {
    const amt = parseFloat(amtToken[1].replace(',', '.'))
    if (!isNaN(amt)) out.amount = amt
    out.source_token = normalizeTokenSymbol(amtToken[2])
  }
  const pair = t.match(/\b(?:swap|convert)\s+([a-z][a-z0-9]*)\s+(?:to|into|for)\s+([a-z][a-z0-9]*)/i)
  if (pair) {
    out.source_token = normalizeTokenSymbol(pair[1])
    out.target_token = normalizeTokenSymbol(pair[2])
  }
  const tgt = t.match(/\b(?:get|receive|want to get|i want to get|i want)\s+([a-z][a-z0-9]*)/i)
  if (tgt) out.target_token = normalizeTokenSymbol(tgt[1])
  const srcOnly = !out.source_token && t.match(/\b(?:swap|sell|bridge)\s+([a-z][a-z0-9]*)/i)
  if (srcOnly) out.source_token = normalizeTokenSymbol(srcOnly[1])
  const onMatches = (() => {
    const re = /\bon\s+([a-z][\w\s-]*?)(?=\s|$|\.|,)/gi
    const found: string[] = []
    let m: RegExpExecArray | null
    while ((m = re.exec(t)) !== null) {
      found.push(normalizeChainAlias(m[1]))
    }
    return found
  })()
  if (onMatches.length === 1) {
    const idxTo = t.indexOf(' to ')
    const idxOn = t.indexOf(' on ')
    if (idxTo !== -1 && idxOn > idxTo) out.target_chain = onMatches[0]
    else out.source_chain = onMatches[0]
  } else if (onMatches.length >= 2) {
    out.source_chain = onMatches[0]
    out.target_chain = onMatches[1]
  }
  const fromChain = t.match(/\bfrom\s+([a-z][\w\s-]*?)(?=\s|$|\.|,)/i)
  if (fromChain) out.source_chain = normalizeChainAlias(fromChain[1])
  const toChain = t.match(/\bto\s+([a-z][\w\s-]*?)(?:\s+chain|\s+network)?\b(?!\s*(?:token|usdt|usdc|eth|dai|weth)\b)/i)
  if (toChain) out.target_chain = normalizeChainAlias(toChain[1])
  return out
}

const tokenCache = new Map<string, Token | null>()
export async function resolveToken(
  chainId: number,
  symbolOrName: string
): Promise<Token | undefined> {
  const key = chainId + ':' + symbolOrName.toUpperCase()
  if (tokenCache.has(key)) {
    const cached = tokenCache.get(key)
    return cached || undefined
  }
  let tokens: Token[] = []
  try {
    const response = await getTokens({
      chainTypes: [ChainType.EVM],
      extended: false,
      search: symbolOrName,
      limit: 20,
    })
    tokens = response.tokens?.[chainId] || []
  } catch {
    // Fallback via API route to avoid browser/network/CORS issues
    try {
      const res = await fetch('/api/resolve-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chainId, search: symbolOrName }),
      })
      if (res.ok) {
        const data = (await res.json()) as { token: Token | null }
        if (data.token) {
          tokenCache.set(key, data.token)
          return data.token
        }
      }
      console.warn('Token resolution failed via server route:', await res.text())
      return undefined
    } catch (e2) {
      console.warn('Token resolution network failure:', e2)
      return undefined
    }
  }
  const upper = symbolOrName.toUpperCase()
  let found = tokens.find((t) => t.symbol?.toUpperCase() === upper)
  if (!found) {
    const lower = symbolOrName.toLowerCase()
    found = tokens.find((t) => t.name?.toLowerCase().includes(lower))
  }
  tokenCache.set(key, found || null)
  return found
}

export const formatUnits = (amount: string | number | bigint, decimals?: number) => {
  try {
    const d = typeof decimals === 'number' ? Math.max(0, decimals) : 18
    const s = typeof amount === 'bigint' ? amount.toString() : String(amount || '0')
    if (s.includes('.') || d === 0) return s
    const negative = s.startsWith('-')
    const digits = negative ? s.slice(1) : s
    let whole = '0'
    let frac = digits
    if (digits.length > d) {
      whole = digits.slice(0, digits.length - d)
      frac = digits.slice(digits.length - d)
    } else {
      whole = '0'
      frac = digits.padStart(d, '0')
    }
    frac = frac.replace(/0+$/, '')
    return (negative ? '-' : '') + (frac ? `${whole}.${frac}` : whole)
  } catch {
    return String(amount || '0')
  }
}

export const formatAmountDisplay = (amount: string | number | bigint, decimals?: number) => {
  const u = formatUnits(amount, decimals)
  const n = Number(u)
  if (!isFinite(n)) return u
  if (n === 0) return '0'
  if (n < 0.000001) return n.toExponential(2)
  if (n < 1) return n.toFixed(6).replace(/0+$/, '').replace(/\.$/, '')
  return n.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

type StepLike = {
  type?: string
  tool?: string
  logoURI?: string
  toolDetails?: { name?: string; logoURI?: string; logo?: string }
  tool_details?: { name?: string; logoURI?: string; logo?: string }
  action?: {
    type?: string
    tool?: string
    logoURI?: string
    toolDetails?: { name?: string; logoURI?: string; logo?: string }
  }
}

export function getBestDexInfo(route: Route | null) {
  if (!route) return null as null | { name?: string; logoURI?: string }
  try {
    const steps = (route as unknown as { steps?: StepLike[] }).steps ?? []
    const swapStep =
      steps.find((s) => (s?.type || s?.action?.type)?.toString().toLowerCase().includes('swap')) ||
      steps[0]
    if (!swapStep) return null
    const toolDetails =
      swapStep.toolDetails || swapStep.tool_details || swapStep.action?.toolDetails || null
    const name = (toolDetails?.name || swapStep.tool || swapStep.action?.tool || '').toString()
    const logoURI =
      toolDetails?.logoURI || toolDetails?.logo || swapStep.logoURI || swapStep.action?.logoURI || undefined
    return { name, logoURI }
  } catch {
    return null
  }
}
