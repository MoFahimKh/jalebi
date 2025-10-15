import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json()

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: [
            'You are a precise crypto swap intent extractor for a voice assistant named Jalebi.',
            'Return a single JSON object with keys:',
            '{ "source_token": string|null, "target_token": string|null, "amount": number|null, "source_chain": string|null, "target_chain": string|null }',
            '- If the user mentions only ONE token with verbs like "swap <token>", treat it as source_token.',
            '- If the user says "swap <tokenA> to/into <tokenB>", set source_token=<tokenA>, target_token=<tokenB>.',
            '- Recognize chains like ethereum/mainnet, polygon/matic, arbitrum, optimism, base, avalanche, bsc/binance.',
            '- Accept pluralization and synonyms (e.g., usdts => usdt, tether => usdt).',
            '- Extract numeric amount if specified (e.g., "2.5 usdt" => amount: 2.5). If not present, set amount to null.',
            '- If chain is not specified, set both source_chain and target_chain to null.',
            '- Do NOT invent values; only extract from the user input.',
            'Examples:',
            'User: "I want to swap USDT" => {"source_token":"usdt","target_token":null,"amount":null,"source_chain":null,"target_chain":null}',
            'User: "swap 100 usdt to eth on base" => {"source_token":"usdt","target_token":"eth","amount":100,"source_chain":"base","target_chain":"base"}',
            'User: "bridge usdc from polygon to arbitrum" => {"source_token":"usdc","target_token":null,"amount":null,"source_chain":"polygon","target_chain":"arbitrum"}',
          ].join('\n'),
        },
        { role: 'user', content: text },
      ],
      response_format: { type: 'json_object' },
    })

    const parsed = completion.choices[0].message.content
    return NextResponse.json({ intent: parsed })
  } catch (err: any) {
    console.error('Intent error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
