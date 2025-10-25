'use client'

import type { WidgetConfig } from '@lifi/widget'
import { LiFiWidget, WidgetSkeleton, HiddenUI } from '@lifi/widget'
import { ClientOnly } from './ClientOnly'
import { useCallback, useEffect, useRef, useState } from 'react'
import VoiceAssistant from './VoiceAssistant'

type WidgetFormRefLike = { setFieldValue: (name: string, value: unknown) => void }

const shortenAddress = (address?: string | null) =>
  address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''

export function Widget() {
  const formRef = useRef<WidgetFormRefLike | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const hiddenWidgetRef = useRef<HTMLDivElement | null>(null)
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

  const updateAddressFromWidget = useCallback(() => {
    const container = hiddenWidgetRef.current
    if (!container) return false
    const buttons = Array.from(
      container.querySelectorAll('button')
    ) as HTMLButtonElement[]
    const walletButton = buttons.find((btn) => {
      const text = btn.textContent?.toLowerCase().trim() ?? ''
      if (!text) return false
      return text.includes('connect wallet') || text.startsWith('0x')
    })
    if (!walletButton) return false
    const text = walletButton.textContent?.trim() ?? ''
    if (/connect wallet/i.test(text)) {
      setWalletAddress((prev) => (prev !== null ? null : prev))
    } else if (text) {
      setWalletAddress((prev) => (prev !== text ? text : prev))
    }
    return true
  }, [])

  const triggerWalletMenu = useCallback(() => {
    const attemptClick = () => {
      const container = hiddenWidgetRef.current
      if (!container) {
        return false
      }
      const buttons = Array.from(
        container.querySelectorAll('button')
      ) as HTMLButtonElement[]
      const target = buttons.find((btn) => {
        const text = btn.textContent?.toLowerCase().trim() ?? ''
        if (!text) return false
        if (text.includes('connect wallet')) return true
        if (walletAddress) {
          const short = shortenAddress(walletAddress).toLowerCase()
          if (short && text.includes(short.replace('…', ''))) return true
          if (text.includes(walletAddress.slice(0, 6).toLowerCase())) return true
        }
        return false
      })
      if (target) {
        target.dispatchEvent(
          new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
          })
        )
        updateAddressFromWidget()
        return true
      }
      return false
    }

    if (attemptClick()) {
      return
    }

    let tries = 0
    const maxTries = 10
    const interval = window.setInterval(() => {
      tries += 1
      const clicked = attemptClick()
      updateAddressFromWidget()
      if (clicked || tries >= maxTries) {
        window.clearInterval(interval)
        if (tries >= maxTries) {
          console.warn('Wallet controls not ready yet.')
        }
      }
    }, 120)
  }, [updateAddressFromWidget, walletAddress])

  useEffect(() => {
    const container = hiddenWidgetRef.current
    if (!container) return
    const observer = new MutationObserver(() => {
      updateAddressFromWidget()
    })
    observer.observe(container, {
      subtree: true,
      characterData: true,
      childList: true,
    })
    updateAddressFromWidget()
    return () => observer.disconnect()
  }, [updateAddressFromWidget])

  return (
    <ClientOnly fallback={<WidgetSkeleton config={config} />}>
      <div className="assistant-shell">
        <div className="assistant-wallet">
          <button
            type="button"
            className="assistant-wallet-link"
            onClick={triggerWalletMenu}
          >
            {walletAddress ? shortenAddress(walletAddress) : 'Connect Wallet'}
          </button>
        </div>
        <VoiceAssistant
          formRef={formRef}
          onRequireWallet={triggerWalletMenu}
        />
      </div>
      <div ref={hiddenWidgetRef} className="widget-hidden">
        <LiFiWidget
          config={{ ...config, variant: 'wide', hiddenUI: [HiddenUI.PoweredBy] }}
          integrator="nextjs-example"
          formRef={formRef}
        />
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
        .widget-hidden {
          position: fixed;
          top: -9999px;
          left: -9999px;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
          overflow: hidden;
        }
      `}</style>
    </ClientOnly>
  )
}
