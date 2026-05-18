import type { ContractMethod, ContractStructure, FrontendCallMapItem } from '../types'

const normalizeParam = (param: string) => {
  const cleaned = param.trim().replace(/=.*/, '').trim()
  const [name, type] = cleaned.split(':').map((s) => s.trim())
  return {
    name: name || cleaned,
    type: type || 'any',
  }
}

export const extractContractStructure = (code: string): ContractStructure => {
  const methods: ContractMethod[] = []
  const stateVariables: Record<string, string> = {}

  const methodRegex = /@gl\.public\.(view|write)(?:\.payable)?\s+def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:\n]+))?/g
  let match
  while ((match = methodRegex.exec(code)) !== null) {
    const decoratorStart = code.lastIndexOf('@gl.public', match.index)
    const decoratorText = code.slice(Math.max(0, decoratorStart), match.index + match[0].length)
    const isWrite = match[1] === 'write'
    const isPayable = decoratorText.includes('.payable')
    const name = match[2]
    const inputs = match[3]
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && p !== 'self')
      .map(normalizeParam)

    methods.push({
      name,
      inputs,
      outputs: match[4]?.trim() ? [{ name: 'return', type: match[4].trim() }] : [],
      isWrite,
      isPayable,
    })
  }

  const classBodyRegex = /class\s+\w+\(gl\.Contract\):([\s\S]*)/
  const classBody = classBodyRegex.exec(code)?.[1] ?? code
  const stateRegex = /^\s{4}([A-Za-z_]\w*)\s*:\s*([^\n=#]+)/gm
  while ((match = stateRegex.exec(classBody)) !== null) {
    if (!match[1].startsWith('_')) {
      stateVariables[match[1]] = match[2].trim()
    }
  }

  return { methods, stateVariables }
}

const inferAction = (method: ContractMethod) => {
  if (method.isPayable) return 'payable write'
  return method.isWrite ? 'write' : 'view'
}

const inferDisplay = (method: ContractMethod) => {
  const name = method.name.toLowerCase()

  if (name.startsWith('get_') || name.startsWith('read_')) {
    return 'Display the returned contract data in the UI.'
  }
  if (name.includes('count') || name.includes('total')) {
    return 'Display the returned count or aggregate value.'
  }
  if (method.isPayable) {
    return 'Prompt for value, submit a payable transaction, then refresh status/getters.'
  }
  if (method.isWrite) {
    return 'Submit a transaction, then refresh relevant view methods after acceptance/finality.'
  }
  return 'Display the returned value.'
}

export const buildFrontendCallMap = (structure: ContractStructure): FrontendCallMapItem[] => {
  return structure.methods.map((method) => ({
    action: inferAction(method),
    method: method.name,
    type: method.isPayable ? 'payable' : method.isWrite ? 'write' : 'view',
    args: method.inputs.map((input) => `${input.name}: ${input.type}`),
    valueRequired: Boolean(method.isPayable),
    display: inferDisplay(method),
  }))
}
