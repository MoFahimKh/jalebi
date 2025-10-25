type InjectedProvider = Record<string, any>
type ProviderMatcher = (provider: InjectedProvider) => boolean

const providerProxyFlag = '__isPreferredProviderProxy__'

const collectFromProvidersArray = (
  providers: InjectedProvider[] | undefined
) => {
  if (!Array.isArray(providers)) {
    return []
  }
  return providers.filter(Boolean)
}

const collectFromProviderMap = (providerMap: any) => {
  if (!providerMap || typeof providerMap.values !== 'function') {
    return []
  }
  return Array.from(providerMap.values()).filter(Boolean)
}

const uniqueProviders = (providers: InjectedProvider[]) => {
  return providers.filter(
    (provider, index) => providers.indexOf(provider) === index
  )
}

const gatherKnownProviders = (): InjectedProvider[] => {
  const anyWindow = window as any
  const candidates: InjectedProvider[] = []
  const { ethereum } = anyWindow ?? {}

  const register = (provider?: InjectedProvider) => {
    if (provider && typeof provider === 'object') {
      candidates.push(provider)
    }
  }

  register(ethereum)
  collectFromProvidersArray(ethereum?.providers).forEach(register)
  collectFromProviderMap(ethereum?.providerMap).forEach(register)

  const eipSymbol =
    typeof Symbol !== 'undefined' ? Symbol.for('eip6963:providers') : undefined
  if (eipSymbol && Array.isArray(anyWindow?.[eipSymbol])) {
    anyWindow[eipSymbol].forEach((entry: any) => register(entry?.provider))
  }

  const phantom = anyWindow?.phantom
  if (phantom) {
    register(phantom?.ethereum)
    collectFromProvidersArray(phantom?.providers).forEach(register)
  }

  return uniqueProviders(candidates)
}

const requestEip6963Providers = async (): Promise<InjectedProvider[]> => {
  const providers = new Set<InjectedProvider>()

  const handler = (event: any) => {
    const provider = event?.detail?.provider
    if (provider) {
      providers.add(provider)
    }
  }

  window.addEventListener('eip6963:providers', handler)
  window.dispatchEvent(new Event('eip6963:request'))

  await new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })

  window.removeEventListener('eip6963:providers', handler)

  return Array.from(providers)
}

const assignPreferredProvider = (
  currentEthereum: InjectedProvider,
  preferredProvider: InjectedProvider,
  allProviders: InjectedProvider[]
) => {
  if (currentEthereum === preferredProvider) {
    return
  }

  const orderedProviders = [
    preferredProvider,
    ...allProviders.filter((provider) => provider !== preferredProvider),
  ]

  const proxy = new Proxy(preferredProvider, {
    get(target, prop, receiver) {
      if (prop === 'providers') {
        return orderedProviders
      }
      if (prop === 'providerMap') {
        return currentEthereum?.providerMap
      }
      if (prop === providerProxyFlag) {
        return true
      }
      return Reflect.get(target, prop, receiver)
    },
  })

  const anyWindow = window as any
  try {
    anyWindow.ethereum = proxy
  } catch {
    try {
      Object.defineProperty(anyWindow, 'ethereum', {
        value: proxy,
        configurable: true,
        writable: true,
      })
    } catch {
      // Ignore if reassignment fails.
    }
  }
}

export const preferInjectedProvider = async (matcher: ProviderMatcher) => {
  if (typeof window === 'undefined') {
    return
  }

  const anyWindow = window as any
  const { ethereum } = anyWindow ?? {}

  if (!ethereum) {
    return
  }

  if (ethereum?.[providerProxyFlag]) {
    return
  }

  if (matcher(ethereum)) {
    return
  }

  let candidates = gatherKnownProviders()
  let preferredProvider = candidates.find((provider) => {
    try {
      return matcher(provider)
    } catch (error) {
      return false
    }
  })

  if (!preferredProvider) {
    const discovered = await requestEip6963Providers()
    if (discovered.length) {
      candidates = uniqueProviders([...candidates, ...discovered])
      preferredProvider = candidates.find((provider) => {
        try {
          return matcher(provider)
        } catch (error) {
          return false
        }
      })
    }
  }

  if (!preferredProvider) {
    return
  }

  assignPreferredProvider(ethereum, preferredProvider, candidates)
}
