'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  const [proposal, setProposal] = useState<{
    fromChainId: number
    toChainId: number
    fromSymbol: string
    toSymbol: string
    amount: number
    sourceChainName: string
    targetChainName: string
    fromTokenAddress: string
    toTokenAddress: string
  } | null>(null)
  const [lastApplied, setLastApplied] = useState<{
    fromChainId: number
    toChainId: number
    fromSymbol: string
    toSymbol: string
    amount: number
    sourceChainName: string
    targetChainName: string
  } | null>(null)
  // Preferred assistant language: 'en-IN' or 'hi-IN'
  const [language, setLanguage] = useState<'en-IN' | 'hi-IN'>('en-IN')
  const transcribeLang = useMemo(() => (language === 'hi-IN' ? 'hi' : 'en'), [language])

  // More robust speech (cancel previous, prefer an en-US voice if available)
  const speak = useCallback((text: string, lang: string = language) => {
    try {
      if (!text) return
      // Cancel any queued utterances to avoid piling up
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = lang
      const pickVoice = () => {
        const list = window.speechSynthesis.getVoices() || []
        const preferred =
          list.find((v) => v.lang?.toLowerCase() === lang.toLowerCase()) ||
          list.find((v) => v.lang?.toLowerCase().startsWith(lang.split('-')[0].toLowerCase())) ||
          list.find((v) => v.lang?.toLowerCase() === 'en-in') ||
          list.find((v) => v.lang?.toLowerCase() === 'hi-in') ||
          list.find((v) => /en[-_]/i.test(v.lang || '')) ||
          list[0]
        if (preferred) utter.voice = preferred
      }
      // Voices can be async-loaded on some browsers
      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          pickVoice()
          window.speechSynthesis.speak(utter)
        }
      } else {
        pickVoice()
        window.speechSynthesis.speak(utter)
      }
    } catch (e) {
      console.warn('speak failed', e)
    }
  }, [language])

  const maybeSwitchLanguage = useCallback((text: string) => {
    const hasDevanagari = /[\u0900-\u097F]/.test(text)
    const hindiWords = /(haan|ha|nahi|nahin|theek|thik|krdo|kar do|karna|chalo)/i
    if (hasDevanagari || hindiWords.test(text)) {
      setLanguage('hi-IN')
    } else {
      setLanguage('en-IN')
    }
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
      formData.append('lang', transcribeLang)

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const { text } = await res.json()
      setTranscript(text)
      maybeSwitchLanguage(text)

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

          // Store a proposal and ask for confirmation instead of applying immediately
          const msg = (language === 'hi-IN'
            ? 'Aap ' + merged.amount + ' ' + fromSymbol + ' ' + (sourceChainName || 'ethereum') + ' par se ' + toSymbol + (toChainId !== fromChainId ? ' ' + (targetChainName || '') + ' par' : '') + ' swap karna chahte hain. Kya main best route dhundhu?'
            : 'You want to swap ' + merged.amount + ' ' + fromSymbol + ' on ' + (sourceChainName || 'ethereum') + ' to ' + toSymbol + (toChainId !== fromChainId ? ' on ' + (targetChainName || '') : '') + '. Should I proceed to find the best route?')
          setProposal({
            fromChainId,
            toChainId,
            fromSymbol,
            toSymbol,
            amount: merged.amount,
            sourceChainName,
            targetChainName,
            fromTokenAddress: fromToken.address,
            toTokenAddress: toToken.address,
          })
          speak(msg)
          await listenForYesNo()
        } catch (e) {
          console.error(e)
          speak(language === 'hi-IN' ? 'Maaf kijiye, kuch gadbad ho gayi.' : 'Something went wrong understanding your request.')
        }
      } else if (nextQuestion) {
        speak(language === 'hi-IN'
          ? (nextQuestion.includes('Which token') ? 'Kaun sa token bechna chahenge?'
            : nextQuestion.includes('receive') ? 'Kaun sa token lena chahenge?'
            : nextQuestion.includes('How much') ? 'Kitna amount swap karna chahenge?'
            : 'Kaunsi chain par yeh swap karna chahenge?')
          : nextQuestion)
      }

      setStatus('idle')
    }, 4000)
  }

  const listenForYesNo = useCallback(async () => {
    if (!proposal) return
    setStatus('listening')
    const rec = await recordAudio()
    rec.start()
    await new Promise((r) => setTimeout(r, 3000))
    const blob = await rec.stop()
    setStatus('processing')
    const fd = new FormData()
    fd.append('file', blob, 'confirm.webm')
    fd.append('lang', transcribeLang)
    const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
    const { text } = await res.json()
    maybeSwitchLanguage(text)
    const t = (text || '').toLowerCase().trim()
    const yes = /^(yes|yeah|yup|ok|okay|sure|confirm|do it|go ahead|haan|haa|ha|ji haan|theek hai|thik hai)\b/.test(t)
    const no = /^(no|nah|nope|cancel|stop|not now|nahi|nahin|mat karo|mat karna|ruk)\b/.test(t)
    if (yes) {
      handleConfirm()
    } else if (no) {
      handleCancel()
    } else {
      speak(language === 'hi-IN' ? 'Kripya haan ya na kahiye.' : 'Please say yes or no.')
    }
    setStatus('idle')
  }, [proposal, transcribeLang, language, speak, maybeSwitchLanguage])

  const handleConfirm = () => {
    if (!proposal) return
    formRef.current?.setFieldValue('fromChain', proposal.fromChainId)
    formRef.current?.setFieldValue('fromToken', proposal.fromTokenAddress)
    formRef.current?.setFieldValue('fromAmount', String(proposal.amount))
    formRef.current?.setFieldValue('toChain', proposal.toChainId)
    formRef.current?.setFieldValue('toToken', proposal.toTokenAddress)
    setLastApplied({
      fromChainId: proposal.fromChainId,
      toChainId: proposal.toChainId,
      fromSymbol: proposal.fromSymbol,
      toSymbol: proposal.toSymbol,
      amount: proposal.amount,
      sourceChainName: proposal.sourceChainName,
      targetChainName: proposal.targetChainName,
    })
    speak(language === 'hi-IN' ? 'Pushti ho gayi. Ab best route dhunda ja raha hai.' : 'Confirmed. Finding the best route for your swap now.')
    setProposal(null)
  }

  const handleCancel = () => {
    setProposal(null)
    speak(language === 'hi-IN' ? 'Theek hai. Aap kya badalna chahenge?' : 'Okay. What would you like to change?')
  }

  return (
    <div className="va-root" aria-live="polite">
      <div className="va-container">
        <div className="va-left">
          <div className={
            'va-orb' +
            (status === 'listening' ? ' listening' : '') +
            (status === 'processing' ? ' processing' : '')
          }>
            <span className="ring r1" />
            <span className="ring r2" />
            <span className="ring r3" />
            <span className="core" />
          </div>
          <div className="va-text">
            <div className="va-title">
              {status === 'idle' ? 'Jalebi 🍮 ' : status === 'listening' ? 'Listening…' : 'Thinking…'}
            </div>
            <div className="va-subtitle">
              {status === 'listening' ? (
                <span className="va-dots"><span />
                  <span />
                  <span />
                </span>
              ) : status === 'processing' ? (
                <span className="va-dots"><span />
                  <span />
                  <span />
                </span>
              ) : (
                transcript ? 'You said: ' + transcript : 'Tap the mic to speak your swap'
              )}
            </div>
          </div>
        </div>
        <div className="va-actions">
          {status === 'idle' ? (
            <button className="va-mic" onClick={handleRecord} aria-label="Start recording">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 18v3" stroke="currentColor" strokeWidth="1.5"/>
              </svg>
            </button>
          ) : (
            <button className="va-stop" onClick={() => setStatus('idle')} aria-label="Stop">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <rect x="6" y="6" width="12" height="12" rx="2"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {proposal ? (
        <div className="va-confirm">
          <div className="va-confirm-text">
            Confirm swap {proposal.amount} {proposal.fromSymbol} on {proposal.sourceChainName || 'ethereum'} to {proposal.toSymbol}
            {proposal.toChainId !== proposal.fromChainId ? ' on ' + (proposal.targetChainName || '') : ''}?
          </div>
          <div className="va-confirm-actions">
            <button className="va-btn secondary" onClick={handleCancel}>Change</button>
            <button className="va-btn primary" onClick={handleConfirm}>Confirm</button>
          </div>
        </div>
      ) : null}

      {/* Top-right debug modal showing current from/to & chains */}
      <div className="va-debug">
        <div className="va-debug-title">Debug: Swap State</div>
        {proposal ? (
          <>
            <div>From: {proposal.amount} {proposal.fromSymbol} on {proposal.sourceChainName || 'ethereum'}</div>
            <div>To: {proposal.toSymbol} on {proposal.targetChainName || proposal.sourceChainName || 'same chain'}</div>
          </>
        ) : lastApplied ? (
          <>
            <div>From: {lastApplied.amount} {lastApplied.fromSymbol} on {lastApplied.sourceChainName || 'ethereum'}</div>
            <div>To: {lastApplied.toSymbol} on {lastApplied.targetChainName || lastApplied.sourceChainName || 'same chain'}</div>
          </>
        ) : (
          <div>Waiting for input…</div>
        )}
      </div>

      <style jsx>{`
        .va-root { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); width: min(820px, calc(100% - 24px)); z-index: 50; pointer-events: none; }
        .va-container { pointer-events: auto; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; border-radius: 16px; background: rgba(18,18,20,0.55); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 6px 24px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.02); backdrop-filter: blur(12px) saturate(1.2); -webkit-backdrop-filter: blur(12px) saturate(1.2); color: #e7e7ea; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Inter, Roboto, Helvetica, Arial; }
        .va-left { display: flex; gap: 12px; align-items: center; min-width: 0; }
        .va-text { overflow: hidden; }
        .va-title { font-weight: 600; font-size: 14px; letter-spacing: .02em; text-transform: uppercase; opacity: .95; }
        .va-subtitle { font-size: 13px; opacity: .8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .va-actions { display: flex; gap: 8px; }
        .va-mic, .va-stop { width: 44px; height: 44px; border-radius: 999px; display: grid; place-items: center; border: 1px solid rgba(255,255,255,0.12); color: #fff; cursor: pointer; transition: transform .12s ease, background .2s ease, box-shadow .2s ease; }
        .va-mic { background: radial-gradient(100% 100% at 0% 0%, #4F46E5 0%, #0EA5E9 100%); box-shadow: 0 6px 16px rgba(14,165,233,0.35); }
        .va-mic:hover { transform: translateY(-1px); }
        .va-stop { background: rgba(244,63,94,0.85); box-shadow: 0 6px 16px rgba(244,63,94,0.35); }
        .va-stop:hover { transform: translateY(-1px); }
        .va-orb { position: relative; width: 40px; height: 40px; }
        .va-orb .core { position: absolute; inset: 8px; border-radius: 999px; background: radial-gradient(100% 100% at 30% 30%, #89f 0%, #59f 30%, #3b82f6 70%, #0ea5e9 100%); box-shadow: inset 0 0 20px rgba(255,255,255,0.5), 0 2px 10px rgba(59,130,246,0.35); animation: orb-breathe 2.4s ease-in-out infinite; }
        .va-orb.listening .core { animation-duration: 1.6s; }
        .va-orb.processing .core { filter: saturate(1.2) brightness(1.1); }
        .va-orb .ring { position: absolute; inset: 0; border-radius: 999px; border: 2px solid rgba(99,102,241,0.35); }
        .va-orb .r1 { animation: ring-pulse 2.2s ease-in-out infinite; }
        .va-orb .r2 { animation: ring-pulse 2.2s ease-in-out .4s infinite; }
        .va-orb .r3 { animation: ring-pulse 2.2s ease-in-out .8s infinite; }
        .va-dots { display: inline-flex; gap: 4px; }
        .va-dots span { width: 6px; height: 6px; background: #cbd5e1; opacity: .8; border-radius: 999px; display: inline-block; animation: dot 1.2s infinite ease-in-out; }
        .va-dots span:nth-child(2) { animation-delay: .15s; }
        .va-dots span:nth-child(3) { animation-delay: .3s; }
        .va-confirm { pointer-events: auto; margin-top: 10px; display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 14px; border-radius: 14px; background: rgba(18,18,20,0.6); border: 1px solid rgba(255,255,255,0.08); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
        .va-confirm-text { font-size: 13px; opacity: .9; }
        .va-confirm-actions { display: flex; gap: 8px; }
        .va-btn { pointer-events: auto; padding: 8px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,0.12); color: #fff; cursor: pointer; font-size: 13px; }
        .va-btn.primary { background: linear-gradient(135deg, #4F46E5 0%, #0EA5E9 100%); }
        .va-btn.secondary { background: rgba(255,255,255,0.08); }
        .va-debug { position: fixed; top: 16px; right: 16px; z-index: 60; min-width: 220px; pointer-events: auto; padding: 10px 12px; border-radius: 12px; background: rgba(18,18,20,0.6); border: 1px solid rgba(255,255,255,0.12); color: #e7e7ea; font-size: 12px; line-height: 1.4; box-shadow: 0 6px 16px rgba(0,0,0,0.35); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
        .va-debug-title { font-weight: 600; font-size: 12px; margin-bottom: 6px; opacity: .9; }
        @keyframes orb-breathe { 0%,100% { transform: scale(.96) } 50% { transform: scale(1.08) } }
        @keyframes ring-pulse { 0% { transform: scale(1); opacity: .35 } 70% { transform: scale(1.6); opacity: 0 } 100% { opacity: 0 } }
        @keyframes dot { 0%, 60%, 100% { transform: translateY(0); opacity: .8 } 30% { transform: translateY(-3px); opacity: 1 } }
      `}</style>
    </div>
  )
}
