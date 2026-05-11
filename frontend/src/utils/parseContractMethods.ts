import type { ContractMethod } from '@/types'

export function parseContractMethods(source: string): ContractMethod[] {
  const methods: ContractMethod[] = []

  // Match @gl.public.view / @gl.public.write / @gl.public.write.payable
  const pattern =
    /@gl\.public\.(view|write(?:\.payable)?)\s+def\s+(\w+)\s*\(self(?:,\s*([\s\S]*?))?\)\s*(?:->\s*([^:\n]+))?:/g

  let match
  while ((match = pattern.exec(source)) !== null) {
    const decorator = match[1]
    const name = match[2]
    const paramsStr = (match[3] ?? '').trim()
    const returnType = (match[4] ?? 'None').trim()
    const isWrite = decorator.startsWith('write')

    const inputs: Array<{ name: string; type: string }> = []

    if (paramsStr) {
      for (const part of paramsStr.split(',')) {
        const p = part.trim()
        if (!p || p === '*') continue

        const colonIdx = p.indexOf(':')
        if (colonIdx !== -1) {
          const paramName = p.substring(0, colonIdx).trim()
          const rest = p.substring(colonIdx + 1).trim()
          const eqIdx = rest.indexOf('=')
          const paramType = (eqIdx !== -1 ? rest.substring(0, eqIdx) : rest).trim()
          if (paramName) inputs.push({ name: paramName, type: paramType })
        } else if (!p.startsWith('*')) {
          inputs.push({ name: p, type: 'str' })
        }
      }
    }

    methods.push({
      name,
      inputs,
      outputs: returnType !== 'None' ? [{ name: 'result', type: returnType }] : [],
      isWrite,
    })
  }

  return methods
}
