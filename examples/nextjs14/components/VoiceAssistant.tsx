'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { recordAudio } from '../utils/recorder'
import type { Route } from '@lifi/sdk'
import { useWidgetEvents, WidgetEvent } from '@lifi/widget'
import {
  CHAIN_IDS,
  normalizeChainAlias,
  normalizeTokenSymbol,
  extractLocalIntent,
  resolveToken,
  type Intent,
} from './voice/intentUtils'
import { getBestDexInfo } from './voice/intentUtils'
import { useRouteExecution } from './voice/useRouteExecution'

// token resolution now provided by intentUtils.resolveToken

type WidgetFormRefLike = { setFieldValue: (name: string, value: unknown) => void }

interface VoiceAssistantProps {
  formRef: React.MutableRefObject<WidgetFormRefLike | null>
  onRequireWallet?: () => void
  bestRoute: Route | null
  onBestRouteChange?: (route: Route | null) => void
}

export default function VoiceAssistant({
  formRef,
  onRequireWallet,
  bestRoute,
  onBestRouteChange,
}: VoiceAssistantProps) {
  type EIP1193Provider = {
    request: (args: { method: string; params?: unknown[] }) => Promise<unknown>
  }
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
  const [, setLastApplied] = useState<{
    fromChainId: number
    toChainId: number
    fromSymbol: string
    toSymbol: string
    amount: number
    sourceChainName: string
    targetChainName: string
  } | null>(null)
  // English-only assistant; use 'en' transcription and en-IN voice
  const transcribeLang = 'en'
  const recorderRef = useRef<Awaited<ReturnType<typeof recordAudio>> | null>(null)
  const keyDownRef = useRef(false)
  const widgetEvents = useWidgetEvents()
  const [execProposal, setExecProposal] = useState<Route | null>(null)
  const [execAsking, setExecAsking] = useState(false)
  const lastPromptedRouteIdRef = useRef<string | null>(null)
  const { status: execStatus, execute, reset: resetExec } =
    useRouteExecution({
      onUpdate: () => {
        // No-op for now; widget UI handles progress if user navigates there.
      },
    })

  // formatting moved to utils

  // English-only speech (prefer en-IN voice), cancel previous
  const speak = useCallback((text: string, lang: string = 'en-IN') => {
    try {
      if (!text) return
      // Cancel any queued utterances to avoid piling up
      window.speechSynthesis.cancel()
      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = lang
      const pickVoice = () => {
        const list = window.speechSynthesis.getVoices() || []
        const preferred =
          list.find((v) => v.lang?.toLowerCase() === 'en-in') ||
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
  }, [])

  const handleConfirm = useCallback(() => {
    if (!proposal) return
    if (
      proposal.fromChainId === proposal.toChainId &&
      proposal.fromTokenAddress.toLowerCase() ===
        proposal.toTokenAddress.toLowerCase()
    ) {
      speak('That is the same token on the same chain. Please change the token or destination chain.')
      return
    }
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
    speak('Confirmed. Finding the best route for your swap now.')
    setProposal(null)
  }, [formRef, proposal, speak])

  const handleCancel = useCallback(() => {
    setProposal(null)
    speak('Okay. What would you like to change?')
  }, [speak])

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
    const t = (text || '').toLowerCase().trim()
    const yes = /^(yes|yeah|yup|ok|okay|sure|confirm|do it|go ahead)\b/.test(t)
    const no = /^(no|nah|nope|cancel|stop|not now)\b/.test(t)
    if (yes) {
      handleConfirm()
    } else if (no) {
      handleCancel()
    } else {
      speak('Please say yes or no.')
    }
    setStatus('idle')
  }, [handleCancel, handleConfirm, proposal, speak, transcribeLang])

  // English-only: no language switching

  // Derived completeness not used in UI currently

  // next question computed per-merge to avoid stale reads

  const startRecording = useCallback(async () => {
    if (status !== 'idle') return
    try {
      setStatus('listening')
      const rec = await recordAudio()
      recorderRef.current = rec
      rec.start()
    } catch (e) {
      console.error(e)
      setStatus('idle')
    }
  }, [status])

  const stopAndProcess = useCallback(async () => {
    const rec = recorderRef.current
    if (!rec) return
    try {
      setStatus('processing')
      const audioBlob = await rec.stop()
      recorderRef.current = null

      const formData = new FormData()
      formData.append('file', audioBlob, 'recording.webm')
      formData.append('lang', transcribeLang)

      const res = await fetch('/api/transcribe', { method: 'POST', body: formData })
      const { text } = await res.json()
      setTranscript(text)
      const local = extractLocalIntent(text)

      const intentRes = await fetch('/api/intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      const { intent: intentStr } = await intentRes.json()
      const newIntent: Intent = JSON.parse(intentStr)

      const merged: Intent = {
        source_token: newIntent.source_token || local.source_token || intent.source_token,
        target_token: newIntent.target_token || local.target_token || intent.target_token,
        amount:
          typeof newIntent.amount === 'number'
            ? newIntent.amount
            : typeof local.amount === 'number'
            ? local.amount
            : intent.amount,
        source_chain: newIntent.source_chain || local.source_chain || intent.source_chain,
        target_chain: newIntent.target_chain || local.target_chain || intent.target_chain,
      }
      setIntent(merged)

      if (
        merged.source_token &&
        merged.target_token &&
        merged.amount &&
        merged.source_chain &&
        merged.target_chain
      ) {
        try {
          const sourceChainName = normalizeChainAlias(merged.source_chain)
          const targetChainName = normalizeChainAlias(merged.target_chain)
          const fromChainId = CHAIN_IDS[sourceChainName]
          const toChainId = CHAIN_IDS[targetChainName] ?? fromChainId

          const fromSymbol = normalizeTokenSymbol(merged.source_token)
          const toSymbol = normalizeTokenSymbol(merged.target_token)

          if (!fromChainId) {
            speak('On which source chain should I look?')
            setStatus('idle')
            return
          }
          const [fromToken, toToken] = await Promise.all([
            resolveToken(fromChainId, fromSymbol),
            toChainId ? resolveToken(toChainId, toSymbol) : Promise.resolve(undefined),
          ])

          if (!fromToken || !toToken) {
            const offline = typeof navigator !== 'undefined' && navigator && navigator.onLine === false
            speak(
              offline
                ? 'Network looks offline. Please check your connection and try again.'
                : 'I could not resolve the tokens. Please try again.'
            )
            setStatus('idle')
            return
          }

          if (!toChainId) {
            speak('On which destination chain should I send it?')
            setStatus('idle')
            return
          }
          const msg =
            'You want to ' +
            (fromSymbol === toSymbol && fromChainId !== toChainId ? 'bridge ' : 'swap ') +
            merged.amount +
            ' ' +
            fromSymbol +
            ' on ' +
            (sourceChainName || '') +
            ' to ' +
            toSymbol +
            (toChainId !== fromChainId ? ' on ' + (targetChainName || '') : '') +
            '. Should I proceed to find the best route?'
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
          speak('Something went wrong understanding your request.')
        }
      } else {
        const nextQ = !merged.source_token
          ? 'Which token do you want to swap from?'
          : !merged.target_token
          ? 'Which token do you want to receive?'
          : !merged.amount
          ? 'How much do you want to swap?'
          : !merged.source_chain
          ? 'On which source chain?'
          : !merged.target_chain
          ? 'On which destination chain?'
          : ''
        if (nextQ) speak(nextQ)
      }
    } finally {
      setStatus('idle')
    }
  }, [transcribeLang, intent, speak, listenForYesNo])

  // Listen for available routes and selection to show a small best route card
  useEffect(() => {
    const onAvailable = (routes: Route[]) => {
      if (routes && routes.length > 0) {
        onBestRouteChange?.(routes[0])
      } else {
        onBestRouteChange?.(null)
      }
    }
    const onSelected = ({ route }: { route: Route }) => {
      onBestRouteChange?.(route)
    }
    widgetEvents.on(WidgetEvent.AvailableRoutes, onAvailable)
    widgetEvents.on(WidgetEvent.RouteSelected, onSelected)
    return () => {
      widgetEvents.off(WidgetEvent.AvailableRoutes, onAvailable)
      widgetEvents.off(WidgetEvent.RouteSelected, onSelected)
    }
  }, [widgetEvents, onBestRouteChange])

  // Passive voice confirmation for execution (declare before effect to avoid TDZ)
  const handleExecConfirm = useCallback(async () => {
    if (!execProposal) return
    try {
      const info = getBestDexInfo(execProposal)
      const dex = info?.name || 'the selected route'

      const eth: EIP1193Provider | null =
        typeof window !== 'undefined'
          ? ((window as unknown as { ethereum?: EIP1193Provider }).ethereum || null)
          : null
      if (!eth) {
        speak('No EVM wallet detected. Please use the connect button to link your wallet and try again.')
        onRequireWallet?.()
        return
      }

      let accounts: string[] = []
      try {
        accounts = ((await eth.request({ method: 'eth_accounts' })) || []) as string[]
      } catch (preErr) {
        console.warn('Failed to read eth_accounts:', preErr)
      }

      if (!accounts.length) {
        speak('Please connect your wallet using the connect button and try again.')
        onRequireWallet?.()
        return
      }

      if (execProposal.fromAddress) {
        const normalized = execProposal.fromAddress.toLowerCase()
        const matches = accounts.some((addr) => addr?.toLowerCase() === normalized)
        if (!matches) {
          speak('Please switch to the wallet that matches this route and try again.')
          onRequireWallet?.()
          return
        }
      }

      const ensureChain = async (targetChainId: number) => {
        const readChainId = async () => {
          const hex = (await eth.request({ method: 'eth_chainId' })) as string
          return parseInt(hex, 16)
        }
        const current = await readChainId()
        if (current === targetChainId) return true
        try {
          await eth.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: '0x' + targetChainId.toString(16) }],
          })
        } catch (switchErr) {
          console.warn('wallet_switchEthereumChain failed:', switchErr)
          return false
        }
        const ok = await new Promise<boolean>((resolve) => {
          let settled = false
          const timeout = setTimeout(async () => {
            if (settled) return
            const c = await readChainId()
            settled = true
            resolve(c === targetChainId)
          }, 1200)
          const handler = (chainIdHex: string | number) => {
            if (settled) return
            const id =
              typeof chainIdHex === 'string' ? parseInt(chainIdHex, 16) : Number(chainIdHex)
            if (id === targetChainId) {
              settled = true
              clearTimeout(timeout)
              resolve(true)
            }
          }
          const prov = eth as unknown as {
            on?: (event: string, cb: (arg: unknown) => void) => void
          }
          prov.on?.('chainChanged', (cid) => handler(cid as string | number))
        })
        return ok
      }

      const aligned = await ensureChain(execProposal.fromChainId)
      if (!aligned) {
        speak('Please switch your wallet network to the source chain and try again.')
        onRequireWallet?.()
        return
      }

      speak(`Starting the swap via ${dex}. Please confirm the transaction in your wallet.`)
      await execute(execProposal)
      speak('Swap executed successfully.')
      setExecProposal(null)
      setExecAsking(false)
      resetExec()
    } catch (e: unknown) {
      const m = e instanceof Error ? e.message : String(e)
      console.error('Route execution failed:', e)
      const ml = m.toLowerCase()
      const msg =
        ml.includes('not connected') || ml.includes('account is not connected')
          ? 'Please connect your wallet to execute the swap.'
          : ml.includes('user rejected') || ml.includes('user rejected the request')
            ? 'Transaction rejected in wallet.'
            : 'Execution failed. Please try again.'
      speak(msg)
    }
  }, [execProposal, execute, onRequireWallet, resetExec, speak])

  const handleExecCancel = useCallback(() => {
    setExecAsking(false)
    setExecProposal(null)
    if (execStatus === 'executing') {
      speak('Execution is already in progress.')
    } else {
      speak('Okay, I will not execute the swap.')
    }
  }, [execStatus, speak])

  const listenForExecYesNo = useCallback(async () => {
    if (!execProposal) return
    setStatus('listening')
    const rec = await recordAudio()
    rec.start()
    await new Promise((r) => setTimeout(r, 3000))
    const blob = await rec.stop()
    setStatus('processing')
    const fd = new FormData()
    fd.append('file', blob, 'confirm-exec.webm')
    fd.append('lang', transcribeLang)
    const res = await fetch('/api/transcribe', { method: 'POST', body: fd })
    const { text } = await res.json()
    const t = (text || '').toLowerCase().trim()
    const yes = /^(yes|yeah|yup|ok|okay|sure|confirm|do it|execute|go ahead)\b/.test(t)
    const no = /^(no|nah|nope|cancel|stop|not now)\b/.test(t)
    if (yes) {
      handleExecConfirm()
    } else if (no) {
      handleExecCancel()
    } else {
      speak('Please say yes or no.')
    }
    setStatus('idle')
  }, [execProposal, transcribeLang, speak, handleExecCancel, handleExecConfirm])

  // When best route becomes available, propose execution and ask for confirmation
  useEffect(() => {
    if (!bestRoute || execAsking || execStatus === 'executing') return
    if (lastPromptedRouteIdRef.current === bestRoute.id) return
    // Only prompt when we have just applied a search (i.e., after proposal confirm)
    // Heuristic: when lastApplied matches current intent summary, we can offer execution
    const info = getBestDexInfo(bestRoute)
    const dex = info?.name || 'the best available route'
    const fromSym = bestRoute.fromToken?.symbol || 'token'
    const toSym = bestRoute.toToken?.symbol || 'token'
    const msg = `I found the best route via ${dex}. Swap ${fromSym} to ${toSym}. Should I execute it?`
    setExecProposal(bestRoute)
    setExecAsking(true)
    lastPromptedRouteIdRef.current = bestRoute.id
    speak(msg)
    // Start passive confirmation listening window
    listenForExecYesNo()
    // We do not auto-listen here to avoid interrupting user; provide quick confirm UI and allow voice confirm via space again
    // Users can press Space to answer; but we also provide a small confirm bar below.
  }, [bestRoute, execAsking, execStatus, speak, listenForExecYesNo])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        if (keyDownRef.current) return
        keyDownRef.current = true
        e.preventDefault()
        startRecording()
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.key === ' ') {
        if (!keyDownRef.current) return
        keyDownRef.current = false
        e.preventDefault()
        stopAndProcess()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [startRecording, stopAndProcess])
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
                transcript ? 'You said: ' + transcript : 'Press Space to push to talk'
              )}
            </div>
          </div>
        </div>
        <div className="va-actions">
          <button
            className={"va-mic" + (status === 'listening' ? ' active' : '')}
            onMouseDown={startRecording}
            onMouseUp={stopAndProcess}
            onTouchStart={startRecording}
            onTouchEnd={stopAndProcess}
            aria-label="Push to talk (hold Space)"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3Z" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M19 11a7 7 0 0 1-14 0" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M12 18v3" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </button>
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

      {execProposal ? (
        <div className="va-confirm" style={{ marginTop: 10 }}>
          <div className="va-confirm-text">
            Execute best route via {getBestDexInfo(execProposal)?.name || 'selected route'}?
          </div>
          <div className="va-confirm-actions">
            <button className="va-btn secondary" onClick={handleExecCancel}>Later</button>
            <button className="va-btn primary" onClick={handleExecConfirm} disabled={execStatus === 'executing'}>
              {execStatus === 'executing' ? 'Executing…' : 'Execute'}
            </button>
          </div>
        </div>
      ) : null}
      <style jsx>{`
        .va-root { position: fixed; left: 50%; bottom: 16px; transform: translateX(-50%); width: min(820px, calc(100% - 24px)); z-index: 50; pointer-events: none; }
        .va-container { pointer-events: auto; display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; border-radius: 16px; background: rgba(18,18,20,0.55); border: 1px solid rgba(255,255,255,0.08); box-shadow: 0 6px 24px rgba(0,0,0,0.35), inset 0 0 0 1px rgba(255,255,255,0.02); backdrop-filter: blur(12px) saturate(1.2); -webkit-backdrop-filter: blur(12px) saturate(1.2); color: #e7e7ea; font-family: inherit; }
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
        .va-btn[disabled] { opacity: .6; cursor: not-allowed; }
        @keyframes orb-breathe { 0%,100% { transform: scale(.96) } 50% { transform: scale(1.08) } }
        @keyframes ring-pulse { 0% { transform: scale(1); opacity: .35 } 70% { transform: scale(1.6); opacity: 0 } 100% { opacity: 0 } }
        @keyframes dot { 0%, 60%, 100% { transform: translateY(0); opacity: .8 } 30% { transform: translateY(-3px); opacity: 1 } }
      `}</style>
      <style jsx>{`
        .va-mic.active { filter: brightness(1.1); transform: translateY(-1px); box-shadow: 0 8px 18px rgba(14,165,233,0.45); }
      `}</style>
    </div>
  )
}
