'use client'

import type { WidgetConfig } from '@lifi/widget'
import { LiFiWidget, WidgetSkeleton } from '@lifi/widget'
import { ClientOnly } from './ClientOnly'
import {
  useRef,
  useState,
  useEffect,
} from 'react'
import VoiceAssistant from './VoiceAssistant'

type WidgetFormRefLike = { setFieldValue: (name: string, value: unknown) => void }

const shortenAddress = (address?: string | null) =>
  address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''

export function Widget() {
  const formRef = useRef<WidgetFormRefLike | null>(null)
  const [widgetOpen, setWidgetOpen] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const config: WidgetConfig = {
    integrator: 'nextjs-example',
    appearance: 'light',
    theme: {
      container: {
        border: '1px solid rgb(234, 234, 234)',
        borderRadius: '16px',
      },
    },
    chains: {
      allow: [1, 10, 137, 42161, 8453, 43114],
    },
    sdkConfig: {
      routeOptions: {
        allowSwitchChain: true,
      },
    },
    exchanges: {
      deny: ['relay'],
    },
  }

  type Ethereumish = {
    request?: (args: { method: string; params?: unknown[] }) => Promise<unknown>
    on?: (event: string, listener: (...args: unknown[]) => void) => void
    removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
  }

  useEffect(() => {
    if (typeof window === 'undefined') return
    const eth = (window as unknown as { ethereum?: Ethereumish }).ethereum
    if (!eth?.request) return

    const updateAccounts = (accounts: string[] = []) => {
      setWalletAddress(accounts[0] ?? null)
    }

    eth
      .request({ method: 'eth_accounts' })
      .then((accounts: string[]) => updateAccounts(accounts))
      .catch(() => {})

    const handleAccountsChanged = (accounts: string[]) => {
      updateAccounts(accounts)
    }

    eth.on?.('accountsChanged', handleAccountsChanged)

    return () => {
      eth.removeListener?.('accountsChanged', handleAccountsChanged)
    }
  }, [])

  const handleCloseOverlay = () => setWidgetOpen(false)
  const handleOpenOverlay = () => setWidgetOpen(true)

  return (
    <ClientOnly fallback={<WidgetSkeleton config={config} />}>
      <div className="assistant-shell">
        <div className="assistant-wallet">
          {walletAddress ? (
            <span className="assistant-wallet-chip">
              {shortenAddress(walletAddress)}
            </span>
          ) : null}
          <button
            type="button"
            className="assistant-wallet-link"
            onClick={handleOpenOverlay}
          >
            {walletAddress ? 'Manage Wallet' : 'Connect Wallet'}
          </button>
        </div>
        <VoiceAssistant
          formRef={formRef}
          onRequireWallet={handleOpenOverlay}
        />
      </div>
      <div
        className={'widget-overlay' + (widgetOpen ? ' open' : '')}
        aria-hidden={!widgetOpen}
        role="dialog"
      >
        <div className="widget-frame">
          <div className="widget-header">
            <span>{walletAddress ? 'Wallet & Swap Controls' : 'Connect Wallet'}</span>
            <button type="button" onClick={handleCloseOverlay} aria-label="Close widget">
              ×
            </button>
          </div>
          <div className="widget-content">
            <LiFiWidget
              config={{ ...config, variant: 'wide' }}
              integrator="nextjs-example"
              formRef={formRef}
            />
          </div>
        </div>
      </div>
      <style jsx>{`
        .assistant-shell {
          position: relative;
          display: grid;
          gap: 16px;
        }
        .assistant-wallet {
          position: fixed;
          top: 16px;
          right: 16px;
          z-index: 60;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .assistant-wallet-chip {
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(18, 18, 20, 0.45);
          color: #f4f4f8;
          font-size: 13px;
          padding: 8px 14px;
        }
        .assistant-wallet-link {
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(18, 18, 20, 0.6);
          color: #f4f4f8;
          font-size: 13px;
          padding: 8px 16px;
          cursor: pointer;
          transition: transform 0.12s ease, box-shadow 0.2s ease,
            background 0.2s ease;
        }
        .assistant-wallet-link:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(59, 130, 246, 0.3);
        }
        .widget-overlay {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(7, 10, 26, 0.65);
          backdrop-filter: blur(12px);
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s ease;
          z-index: 70;
        }
        .widget-overlay.open {
          opacity: 1;
          pointer-events: auto;
        }
        .widget-frame {
          width: min(480px, 90vw);
          max-height: 90vh;
          background: #0b0d1e;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 24px 64px rgba(0, 0, 0, 0.45);
          display: flex;
          flex-direction: column;
        }
        .widget-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 12px 16px;
          color: #f4f4f8;
          font-size: 14px;
          font-weight: 500;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }
        .widget-header button {
          background: transparent;
          border: none;
          color: inherit;
          font-size: 24px;
          cursor: pointer;
          line-height: 1;
        }
        .widget-content {
          flex: 1;
          overflow: auto;
          background: #10142d;
          padding: 12px;
        }
        :global(.widget-content > div) {
          pointer-events: auto;
        }
      `}</style>
    </ClientOnly>
  )
}
