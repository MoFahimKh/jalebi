import type { CreateConnectorFn } from 'wagmi'
import type { MetaMaskParameters } from 'wagmi/connectors'
import { metaMask } from 'wagmi/connectors'
import { preferInjectedProvider } from '../utils/preferInjectedProvider.js'
import { extendConnector } from './utils.js'

export const createMetaMaskConnector = /*#__PURE__*/ (
  params: MetaMaskParameters
) => {
  const defaultedParams: MetaMaskParameters = {
    preferDesktop: true,
    ...params,
  }
  if (defaultedParams.extensionOnly === undefined) {
    defaultedParams.extensionOnly = true
  }

  const baseConnector = metaMask(defaultedParams) as CreateConnectorFn

  const wrappedConnector: CreateConnectorFn = (config) => {
    const connector = baseConnector(config)

    if (connector.connect) {
      const originalConnect = connector.connect.bind(connector)
      connector.connect = async (...args) => {
        await preferInjectedProvider((provider) => Boolean(provider?.isMetaMask))
        return originalConnect(...(args as Parameters<typeof originalConnect>))
      }
    }

    if (connector.getProvider) {
      const originalGetProvider = connector.getProvider.bind(connector)
      connector.getProvider = async (...args) => {
        await preferInjectedProvider((provider) => Boolean(provider?.isMetaMask))
        return originalGetProvider(...(args as Parameters<typeof originalGetProvider>))
      }
    }

    if (connector.isAuthorized) {
      const originalIsAuthorized = connector.isAuthorized.bind(connector)
      connector.isAuthorized = async (...args) => {
        await preferInjectedProvider((provider) => Boolean(provider?.isMetaMask))
        return originalIsAuthorized(...(args as Parameters<typeof originalIsAuthorized>))
      }
    }

    return connector
  }

  return extendConnector(wrappedConnector, 'metaMaskSDK', 'MetaMask')
}
