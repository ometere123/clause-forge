import { config } from '../config'

export const getContractSource = async (address: string): Promise<string | null> => {
  const response = await fetch(config.genLayer.studionetRpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'gen_getContractCode',
      params: [address],
      id: 1,
    }),
  })

  const json = await response.json() as { result?: string; error?: unknown }
  if (!json.result) return null

  // Result is base64-encoded source code
  return Buffer.from(json.result, 'base64').toString('utf-8')
}

export const getContractState = async (address: string): Promise<unknown> => {
  const response = await fetch(config.genLayer.studionetRpc, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'gen_getContractState',
      params: [address],
      id: 1,
    }),
  })

  const json = await response.json() as { result: unknown }
  return json.result
}
