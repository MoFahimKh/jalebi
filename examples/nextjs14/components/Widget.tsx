'use client'

import type { Route } from '@lifi/sdk'
import type { WidgetConfig } from '@lifi/widget'
import { LiFiWidget, WidgetSkeleton, HiddenUI } from '@lifi/widget'
import { ClientOnly } from './ClientOnly'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import VoiceAssistant from './VoiceAssistant'

type WidgetFormRefLike = { setFieldValue: (name: string, value: unknown) => void }

const shortenAddress = (address?: string | null) =>
  address ? `${address.slice(0, 6)}…${address.slice(-4)}` : ''

export function Widget() {
  const formRef = useRef<WidgetFormRefLike | null>(null)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const widgetRef = useRef<HTMLDivElement | null>(null)
  const [bestRoute, setBestRoute] = useState<Route | null>(null)
  const [widgetReady, setWidgetReady] = useState(false)

  const handleBestRouteChange = useCallback((route: Route | null) => {
    setBestRoute(route)
    if (route) {
      setWidgetReady(true)
    }
  }, [])

  const glassTheme = useMemo(
    () => ({
      container: {
        borderRadius: '28px',
        padding: '24px',
        background:
          'linear-gradient(135deg, rgba(23, 25, 39, 0.78), rgba(16, 18, 30, 0.62))',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        boxShadow: '0 30px 80px rgba(10, 12, 30, 0.55)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      },
      routesContainer: {
        background: 'rgba(18, 21, 34, 0.45)',
        borderRadius: '24px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      },
      header: {
        background: 'rgba(18, 20, 32, 0.45)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
      },
      navigation: {
        edge: false,
      },
      components: {
        MuiCard: {
          styleOverrides: {
            root: {
              background: 'rgba(15, 18, 29, 0.55)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            },
          },
        },
        MuiInputCard: {
          styleOverrides: {
            root: {
              background: 'rgba(20, 23, 36, 0.5)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            },
          },
        },
        MuiButton: {
          styleOverrides: {
            root: {
              borderRadius: '999px',
              textTransform: 'none',
            },
            contained: {
              backgroundImage:
                'linear-gradient(135deg, #5b8cff 0%, #996dff 100%)',
              color: '#ffffff',
              boxShadow: '0 14px 28px rgba(90, 116, 255, 0.35)',
              '&:hover': {
                boxShadow: '0 18px 36px rgba(90, 116, 255, 0.45)',
                filter: 'brightness(1.05)',
              },
            },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              backdropFilter: 'blur(18px)',
              WebkitBackdropFilter: 'blur(18px)',
            },
          },
        },
        MuiTabs: {
          styleOverrides: {
            root: {
              background: 'rgba(16, 18, 30, 0.55)',
              borderRadius: '999px',
              padding: '4px',
            },
            indicator: {
              borderRadius: '999px',
              backgroundImage:
                'linear-gradient(135deg, #5b8cff 0%, #996dff 100%)',
            },
          },
        },
        MuiNavigationTabs: {
          styleOverrides: {
            root: {
              background: 'rgba(16, 18, 30, 0.55)',
            },
          },
        },
      },
    }),
    []
  )

  const config = useMemo<WidgetConfig>(
    () => ({
      integrator: 'nextjs-example',
      appearance: 'dark',
      variant: 'wide',
      hiddenUI: [HiddenUI.PoweredBy],
      theme: glassTheme,
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
    }),
    [glassTheme]
  )

  const updateAddressFromWidget = useCallback(() => {
    const container = widgetRef.current
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
      const container = widgetRef.current
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
    const container = widgetRef.current
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
        <div className="widget-stage">
          <div
            ref={widgetRef}
            className={`widget-glass${widgetReady ? '' : ' hidden'}`}
          >
            <LiFiWidget
              config={config}
              integrator="nextjs-example"
              formRef={formRef}
            />
          </div>
        </div>
        <VoiceAssistant
          formRef={formRef}
          onRequireWallet={triggerWalletMenu}
          bestRoute={bestRoute}
          onBestRouteChange={handleBestRouteChange}
        />
      </div>
      <style jsx>{`
        .assistant-shell {
          position: relative;
          min-height: 100vh;
          padding: 96px 24px 160px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
          background: radial-gradient(
              160% 160% at 50% 0%,
              rgba(99, 102, 241, 0.18),
              rgba(3, 7, 18, 0.94)
            ),
            radial-gradient(
              120% 120% at 0% 100%,
              rgba(56, 189, 248, 0.12),
              transparent
            );
        }
        .widget-stage {
          width: min(960px, 100%);
        }
        .widget-glass {
          position: relative;
          border-radius: 32px;
          padding: 24px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          background: linear-gradient(
            135deg,
            rgba(23, 25, 39, 0.78),
            rgba(14, 16, 27, 0.62)
          );
          box-shadow: 0 32px 80px rgba(6, 8, 20, 0.55);
          backdrop-filter: blur(26px);
          -webkit-backdrop-filter: blur(26px);
          opacity: 1;
          pointer-events: auto;
          transform: translateY(0);
          transition: opacity 0.35s ease, transform 0.35s ease;
        }
        .widget-glass::before {
          content: '';
          position: absolute;
          inset: 2px;
          border-radius: 30px;
          border: 1px solid rgba(255, 255, 255, 0.04);
          pointer-events: none;
        }
        .widget-glass.hidden {
          opacity: 0;
          pointer-events: none;
          transform: translateY(24px);
        }
        .widget-glass :global(.MuiPaper-root) {
          background: transparent;
          box-shadow: none;
        }
        .widget-glass :global(.MuiPopover-paper) {
          background: rgba(17, 19, 30, 0.85);
          backdrop-filter: blur(22px);
          -webkit-backdrop-filter: blur(22px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .assistant-wallet {
          position: fixed;
          top: 24px;
          right: 24px;
          z-index: 60;
        }
        .assistant-wallet-link {
          border-radius: 999px;
          border: 1px solid rgba(255, 255, 255, 0.18);
          background: rgba(18, 18, 26, 0.68);
          color: #f4f4f8;
          font-size: 13px;
          letter-spacing: 0.01em;
          padding: 10px 20px;
          cursor: pointer;
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          transition: transform 0.12s ease, box-shadow 0.2s ease,
            background 0.2s ease;
        }
        .assistant-wallet-link:hover {
          transform: translateY(-1px);
          background: rgba(24, 24, 32, 0.78);
          box-shadow: 0 12px 32px rgba(88, 106, 255, 0.38);
        }
        @media (max-width: 768px) {
          .assistant-shell {
            padding: 72px 16px 160px;
          }
          .assistant-wallet {
            top: 16px;
            right: 16px;
          }
          .widget-glass {
            padding: 16px;
            border-radius: 24px;
          }
          .widget-glass::before {
            border-radius: 22px;
          }
        }
      `}</style>
    </ClientOnly>
  )
}
