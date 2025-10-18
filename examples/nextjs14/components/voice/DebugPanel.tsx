'use client'

import React from 'react'
import type { Intent } from './intentUtils'

type Proposal = {
  fromChainId: number
  toChainId: number
  fromSymbol: string
  toSymbol: string
  amount: number
  sourceChainName: string
  targetChainName: string
  fromTokenAddress: string
  toTokenAddress: string
}

type LastApplied = {
  fromChainId: number
  toChainId: number
  fromSymbol: string
  toSymbol: string
  amount: number
  sourceChainName: string
  targetChainName: string
}

export const DebugPanel: React.FC<{
  intent: Intent
  proposal: Proposal | null
  lastApplied: LastApplied | null
}> = ({ intent, proposal, lastApplied }) => {
  return (
    <div className="va-debug">
      <div className="va-debug-title">Debug: Current Intent</div>
      <div>From token: {intent.source_token || '—'}</div>
      <div>To token: {intent.target_token || '—'}</div>
      <div>Amount: {intent.amount ?? '—'}</div>
      <div>Source chain: {intent.source_chain || '—'}</div>
      <div>Destination chain: {intent.target_chain || '—'}</div>
      {proposal ? (
        <>
          <div className="va-debug-title" style={{ marginTop: 6 }}>Proposed</div>
          <div>From: {proposal.amount} {proposal.fromSymbol} on {proposal.sourceChainName || 'ethereum'}</div>
          <div>To: {proposal.toSymbol} on {proposal.targetChainName || proposal.sourceChainName || 'same chain'}</div>
        </>
      ) : lastApplied ? (
        <>
          <div className="va-debug-title" style={{ marginTop: 6 }}>Last Applied</div>
          <div>From: {lastApplied.amount} {lastApplied.fromSymbol} on {lastApplied.sourceChainName || 'ethereum'}</div>
          <div>To: {lastApplied.toSymbol} on {lastApplied.targetChainName || lastApplied.sourceChainName || 'same chain'}</div>
        </>
      ) : null}
      <style jsx>{`
        .va-debug { position: absolute; top: -160px; right: 16px; z-index: 60; min-width: 220px; pointer-events: auto; padding: 10px 12px; border-radius: 12px; background: rgba(18,18,20,0.6); border: 1px solid rgba(255,255,255,0.12); color: #e7e7ea; font-size: 12px; line-height: 1.4; box-shadow: 0 6px 16px rgba(0,0,0,0.35); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); }
        .va-debug-title { font-weight: 600; font-size: 12px; margin-bottom: 6px; opacity: .9; }
      `}</style>
    </div>
  )
}
