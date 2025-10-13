'use client'

import { useCallback, useMemo, useRef, useState } from 'react'
import { recordAudio } from '../utils/recorder'
import { getTokens, ChainType, type Token } from '@lifi/sdk'

type Intent = {
  source_token: string | null
  target_token: string | null
  amount: number | null
  source_chain: string | null
  target_chain: string | null
}

// Minimal chain name to id mapping. Extend as needed.
const CHAIN_IDS: Record<string, number> = {
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

function normalizeName(value?: string | null) {
  return (value || '').toLowerCase().trim()
}

function normalizeTokenSymbol(value?: string | null) {
  const v = normalizeName(value).replace(/s\b$/, '') // handle plurals like usdts -> usdt
  if (v === 'weth') return 'WETH'
  if (v === 'eth') return 'ETH'
  if (v === 'usdt' || v === 'tether' || v === 'usdts') return 'USDT'
  if (v === 'usdc') return 'USDC'
  if (v === 'dai') return 'DAI'
  return v.toUpperCase()
}

async function resolveToken(
  chainId: number,
  symbolOrName: string
): Promise<Token | undefined> {
  const search = symbolOrName
  const response = await getTokens({
    chainTypes: [ChainType.EVM],
    extended: true,
    search,
    limit: 50,
  })
  const tokens = response.tokens?.[chainId] || []
  // Prefer exact symbol match
  const upper = symbolOrName.toUpperCase()
  const bySymbol = tokens.find((t) => t.symbol?.toUpperCase() === upper)
  if (bySymbol) return bySymbol
  // Fallback by name contains
  const lower = symbolOrName.toLowerCase()
  return tokens.find((t) => t.name?.toLowerCase().includes(lower))
}

export default function VoiceAssistant({
  formRef,
}: {
  formRef: React.MutableRefObject<any>
}) {
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing'>(
    'idle'
  )
  const [transcript, setTranscript] = useState('')
  const [intent, setIntent] = useState<Intent>({
    source_token: null,
    target_token: null,
    amount: null,
    source_chain: null,
    target_chain: null,
  })

  const speak = useCallback((text: string, lang: string = 'en-US') => {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = lang
    speechSynthesis.speak(utter)
  }, [])

  const allFilled = useMemo(
    () =>
      Boolean(
        intent.source_token &&
          intent.target_token &&
          intent.amount &&
          (intent.source_chain || intent.target_chain)
      ),
    [intent]
  )

  const nextQuestion = useMemo(() => {
    if (!intent.source_token) return 'Which token do you want to swap from?'
    if (!intent.target_token) return 'Which token do you want to receive?'
    if (!intent.amount) return 'How much do you want to swap?'
    if (!intent.source_chain && !intent.target_chain)
      return 'On which chain should I do this swap?'
    return ''
  }, [intent])

  const handleRecord = async () => {
    setStatus('listening')
    const recorder = await recordAudio()
    recorder.start()

    setTimeout(async () => {
      const audioBlob = await recorder.stop()
      setStatus('processing')

      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const { text } = await res.json()
      setTranscript(text)

      const intentRes = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const { intent: intentStr } = await intentRes.json()
      const newIntent: Intent = JSON.parse(intentStr)

      const merged: Intent = {
        source_token: newIntent.source_token ?? intent.source_token,
        target_token: newIntent.target_token ?? intent.target_token,
        amount: newIntent.amount ?? intent.amount,
        source_chain: newIntent.source_chain ?? intent.source_chain,
        target_chain: newIntent.target_chain ?? intent.target_chain,
      }
      setIntent(merged)

      if (
        merged.source_token &&
        merged.target_token &&
        merged.amount &&
        (merged.source_chain || merged.target_chain)
      ) {
        try {
          const sourceChainName = normalizeName(merged.source_chain)
          const targetChainName = normalizeName(merged.target_chain) || sourceChainName
          const fromChainId = CHAIN_IDS[sourceChainName] || CHAIN_IDS['ethereum']
          const toChainId = CHAIN_IDS[targetChainName] || fromChainId

          const fromSymbol = normalizeTokenSymbol(merged.source_token)
          const toSymbol = normalizeTokenSymbol(merged.target_token)

          const [fromToken, toToken] = await Promise.all([
            resolveToken(fromChainId, fromSymbol),
            resolveToken(toChainId, toSymbol),
          ])

          if (!fromToken || !toToken) {
            speak('I could not resolve the tokens. Please try again.')
            setStatus('idle')
            return
          }

          // Feed the widget form via formRef
          formRef.current?.setFieldValue('fromChain', fromChainId)
          formRef.current?.setFieldValue('fromToken', fromToken.address)
          formRef.current?.setFieldValue('fromAmount', String(merged.amount))
          formRef.current?.setFieldValue('toChain', toChainId)
          formRef.current?.setFieldValue('toToken', toToken.address)

          const msg =
            'Okay. Swapping ' +
            merged.amount +
            ' ' +
            fromSymbol +
            ' on ' +
            (sourceChainName || 'ethereum') +
            ' to ' +
            toSymbol +
            (toChainId !== fromChainId ? ' on ' + (targetChainName || '') : '') +
            '. Finding best route now.'
          speak(msg)
        } catch (e) {
          console.error(e)
          speak('Something went wrong configuring the swap.')
        }
      } else if (nextQuestion) {
        speak(nextQuestion)
      }

      setStatus('idle')
    }, 4000)
  }

  return (
    <div style={{ padding: 12 }}>
      <button onClick={handleRecord} disabled={status !== 'idle'}>
        {status === 'listening' ? 'Listening…' : status === 'processing' ? 'Processing…' : 'Speak'}
      </button>
      {transcript ? <p>You said: {transcript}</p> : null}
      <pre style={{ background: '#111', color: '#0f0', padding: 8 }}>
        {JSON.stringify(intent, null, 2)}
      </pre>
    </div>
  )
}
