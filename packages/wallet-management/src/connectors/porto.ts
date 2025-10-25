import type { Config } from 'porto/Porto'
import { porto } from 'porto/wagmi'
import { hostnames as defaultTrustedHosts } from 'porto/trusted-hosts'
import { extendConnector } from './utils.js'

if (typeof window !== 'undefined') {
  const { hostname } = window.location
  if (hostname && !defaultTrustedHosts.includes(hostname)) {
    defaultTrustedHosts.push(hostname)
  }
}

type PortoConnectorConfig = Partial<Config> & {
  trustedHosts?: string[]
}

const ensureTrustedHosts = (params?: PortoConnectorConfig) => {
  if (typeof window === 'undefined') {
    return params
  }

  const { hostname } = window.location
  if (!hostname) {
    return params
  }

  if (!defaultTrustedHosts.includes(hostname)) {
    defaultTrustedHosts.push(hostname)
  }

  if (!params) {
    return { trustedHosts: defaultTrustedHosts }
  }

  if (!params.trustedHosts) {
    return { ...params, trustedHosts: defaultTrustedHosts }
  }

  if (!params.trustedHosts.includes(hostname)) {
    return {
      ...params,
      trustedHosts: [...params.trustedHosts, hostname],
    }
  }

  return params
}

export const createPortoConnector = /*#__PURE__*/ (params?: Partial<Config>) =>
  extendConnector(
    porto(ensureTrustedHosts(params)),
    'xyz.ithaca.porto',
    'Porto'
  )
