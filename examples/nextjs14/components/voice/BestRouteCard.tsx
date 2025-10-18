'use client'

import React from 'react'
import type { Route } from '@lifi/sdk'
import { formatAmountDisplay, getBestDexInfo } from './intentUtils'

export const BestRouteCard: React.FC<{ route: Route | null }> = ({ route }) => {
  if (!route) return null
  const info = getBestDexInfo(route)
  return (
    <div className="va-best-route" role="status">
      <div className="va-br-title">Best Route</div>
      {info ? (
        <div className="va-br-dex">
          {info.logoURI ? (
            <img className="va-br-dex-logo" src={info.logoURI} alt="dex" />
          ) : (
            <span className="va-br-dex-placeholder" />
          )}
          <span className="va-br-dex-name">{info.name || 'Aggregator'}</span>
        </div>
      ) : null}
      <div className="va-br-row">
        {formatAmountDisplay(route.fromAmount ?? '0', route.fromToken?.decimals)} {route.fromToken?.symbol}
        {' '}
        → {' '}
        {formatAmountDisplay(route.toAmount ?? '0', route.toToken?.decimals)} {route.toToken?.symbol}
      </div>
      <div className="va-br-meta">
        {route.toAmountUSD ? `≈ $${Number(route.toAmountUSD).toFixed(2)}` : ''}
        {route.gasCostUSD ? ` • Gas ≈ $${Number(route.gasCostUSD).toFixed(2)}` : ''}
        {route.steps?.length ? ` • ${route.steps.length} step${route.steps.length > 1 ? 's' : ''}` : ''}
      </div>
      <style jsx>{`
        .va-best-route { position: absolute; left: 50%; top: -450px; transform: translateX(-50%); width: min(820px, calc(100% - 24px)); z-index: 60; pointer-events: auto; padding: 14px 16px; border-radius: 16px; background: linear-gradient(180deg, rgba(24,24,28,0.78) 0%, rgba(18,18,22,0.78) 100%); border: 1px solid rgba(255,255,255,0.1); color: #e7e7ea; box-shadow: 0 8px 22px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(255,255,255,0.03); font-family: var(--font-orbitron), var(--font-exo2), ui-sans-serif, system-ui, -apple-system, Segoe UI, Inter, Roboto, Helvetica, Arial; }
        .va-br-title { font-weight: 700; font-size: 12px; letter-spacing: .12em; opacity: .95; margin-bottom: 8px; text-transform: uppercase; }
        .va-br-dex { display: inline-flex; align-items: center; gap: 8px; padding: 6px 8px; border-radius: 999px; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); margin-bottom: 8px; }
        .va-br-dex-logo { width: 18px; height: 18px; border-radius: 999px; display: block; }
        .va-br-dex-placeholder { width: 18px; height: 18px; border-radius: 999px; background: rgba(255,255,255,0.15); display: inline-block; }
        .va-br-dex-name { font-size: 12px; letter-spacing: .04em; opacity: .95; }
        .va-br-row { font-size: 14px; font-weight: 600; letter-spacing: .02em; }
        .va-br-meta { font-size: 12px; opacity: .8; margin-top: 6px; }
      `}</style>
    </div>
  )
}
