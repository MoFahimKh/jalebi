import { NextRequest, NextResponse } from 'next/server'
export const runtime = 'nodejs'
import { getTokens, ChainType } from '@lifi/sdk'

export async function POST(req: NextRequest) {
  try {
    const { chainId, search } = (await req.json()) as {
      chainId: number
      search: string
    }
    if (!chainId || !search || typeof search !== 'string') {
      return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
    }
    const response = await getTokens({
      chainTypes: [ChainType.EVM],
      extended: false,
      search,
      limit: 20,
    })
    const tokens = response.tokens?.[chainId] || []
    const upper = search.toUpperCase()
    let found = tokens.find((t) => t.symbol?.toUpperCase() === upper)
    if (!found) {
      const lower = search.toLowerCase()
      found = tokens.find((t) => t.name?.toLowerCase().includes(lower))
    }
    if (!found) return NextResponse.json({ token: null })
    return NextResponse.json({ token: found })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

