import type {
  ContractMethod,
  ContractStructure,
  FrontendCallMapItem,
  GeneratedContract,
} from '@/types'
import { normalizeContractCode } from '@/utils/contractCode'
import { parseContractMethods } from '@/utils/parseContractMethods'
import { buildContractGenerationReport } from '@/utils/contractReport'

const inferContractName = (code: string) => {
  const match = code.match(/class\s+([A-Za-z_]\w*)\s*\(\s*gl\.Contract\s*\)\s*:/)
  return match?.[1] ?? 'Imported Contract'
}

const extractStateVariables = (code: string) => {
  const stateVariables: Record<string, string> = {}
  const classBody = /class\s+\w+\s*\(\s*gl\.Contract\s*\)\s*:([\s\S]*)/.exec(code)?.[1] ?? code
  const stateRegex = /^\s{4}([A-Za-z_]\w*)\s*:\s*([^\n=#]+)/gm
  let match

  while ((match = stateRegex.exec(classBody)) !== null) {
    if (!match[1].startsWith('_')) {
      stateVariables[match[1]] = match[2].trim()
    }
  }

  return stateVariables
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

const buildFrontendCallMap = (structure: ContractStructure): FrontendCallMapItem[] =>
  structure.methods.map((method) => ({
    action: inferAction(method),
    method: method.name,
    type: method.isPayable ? 'payable' : method.isWrite ? 'write' : 'view',
    args: method.inputs.map((input) => `${input.name}: ${input.type}`),
    valueRequired: Boolean(method.isPayable),
    display: inferDisplay(method),
  }))

const estimateCapabilities = (code: string) => ({
  needsLlm: code.includes('gl.nondet.exec_prompt'),
  needsWebFetch:
    code.includes('gl.nondet.web.get') ||
    code.includes('gl.nondet.web.post') ||
    code.includes('gl.nondet.web.patch') ||
    code.includes('gl.nondet.web.delete') ||
    code.includes('gl.nondet.web.head'),
  needsDataAccess: code.includes('gl.nondet.web.render') || code.includes('images='),
  estimatedGasUsage: Math.ceil(code.length / 100),
})

export const createImportedContract = (source: string): GeneratedContract => {
  const generatedCode = normalizeContractCode(source)
  const methods = parseContractMethods(generatedCode)
  const stateVariables = extractStateVariables(generatedCode)
  const structure = { methods, stateVariables }
  const contractName = inferContractName(generatedCode)
  const originalDescription = 'Imported existing GenLayer Intelligent Contract in Python'
  const frontendCallMap = buildFrontendCallMap(structure)

  return {
    generationId: crypto.randomUUID(),
    generatedCode,
    contractName,
    methods,
    stateVariables,
    frontendCallMap,
    generationReport: buildContractGenerationReport({
      description: originalDescription,
      code: generatedCode,
      structure,
      frontendCallMap,
    }),
    estimation: {
      tokensInput: 0,
      tokensOutput: 0,
      estimatedCostUsd: 0,
      generationTimeMs: 0,
      capabilities: estimateCapabilities(generatedCode),
    },
    originalDescription,
    modelUsed: 'manual-import',
    generatedAt: new Date().toISOString(),
  }
}
