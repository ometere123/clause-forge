import type {
  ContractKind,
  ContractMethod,
  ContractPlainSummary,
  ContractStructure,
} from '../types'

// Builds a deterministic plain-English explanation of a generated contract so
// non-developers can verify the contract matches their intent without reading
// Python. No AI calls — everything is derived from the extracted structure.

const FRIENDLY_TYPE: Record<string, string> = {
  str: 'text',
  int: 'a number',
  bool: 'yes/no',
  float: 'a number',
  Address: 'a wallet address',
}

const friendlyType = (type: string) => FRIENDLY_TYPE[type.trim()] ?? type.trim()

const humanizeName = (name: string) => name.replace(/_/g, ' ').trim()

const extractMethodBody = (code: string, methodName: string): string => {
  const defRegex = new RegExp(`def\\s+${methodName}\\s*\\([^)]*\\)[^:]*:`, 'm')
  const match = defRegex.exec(code)
  if (!match) return ''
  const start = match.index + match[0].length
  // Body ends at the next decorator or def at the same-or-lower indentation
  const rest = code.slice(start)
  const end = rest.search(/\n    @gl\.public|\n    def\s|\nclass\s/)
  return end === -1 ? rest : rest.slice(0, end)
}

const isOwnerRestricted = (body: string) =>
  /sender_address\s*!=\s*self\.(owner|admin|resolver)|self\.(owner|admin|resolver)\s*!=\s*gl\.message\.sender_address/.test(
    body
  )

const describeInputs = (method: ContractMethod) => {
  if (!method.inputs.length) return ''
  const parts = method.inputs.map((i) => `${humanizeName(i.name)} (${friendlyType(i.type)})`)
  return ` providing ${parts.join(', ')}`
}

const describeMethod = (method: ContractMethod, code: string): string => {
  const body = extractMethodBody(code, method.name)
  const who = isOwnerRestricted(body) ? 'Only the contract owner/admin' : 'Anyone'
  const action = humanizeName(method.name)

  if (method.isPayable) {
    return `${who} can call "${action}"${describeInputs(method)} and must send GEN tokens with the call. This changes the contract's records.`
  }
  if (method.isWrite) {
    const usesAi = /gl\.nondet\.exec_prompt|run_nondet_unsafe|eq_principle/.test(body)
    const usesWeb = /gl\.nondet\.web/.test(body)
    const extras = [
      usesAi ? 'validators run an AI judgement and must agree on the result' : '',
      usesWeb ? 'live public web data is fetched as evidence' : '',
    ]
      .filter(Boolean)
      .join('; ')
    return `${who} can call "${action}"${describeInputs(method)}. This changes the contract's records${
      extras ? ` — ${extras}` : ''
    }.`
  }
  return `${who} can call "${action}"${describeInputs(method)} to read stored information. Reading never changes anything.`
}

const describeStorage = (stateVariables: Record<string, string>): string[] =>
  Object.entries(stateVariables).map(([name, type]) => {
    const label = humanizeName(name)
    if (/TreeMap/.test(type)) return `A lookup table of ${label}`
    if (/DynArray|Array/.test(type)) return `A list of ${label}`
    if (type === 'Address') return `The wallet address for ${label}`
    if (/^u\d+|^i\d+/.test(type)) return `A number tracking ${label}`
    if (type === 'bool') return `A yes/no flag for ${label}`
    return `Stored ${label}`
  })

const KIND_HEADLINE: Record<ContractKind, string> = {
  deterministic:
    'This contract follows fixed rules written in code. No AI decisions are involved — the same input always produces the same result.',
  'web-aware':
    'This contract checks live public web data as evidence before it updates its records, and GenLayer validators must agree on what that evidence says.',
  'ai-judgement':
    'This contract asks AI to make a judgement (with clear rules and an "unsure" escape hatch), and multiple independent GenLayer validators must agree before anything is saved.',
}

export const buildPlainSummary = (params: {
  description: string
  code: string
  structure: ContractStructure
  kind: ContractKind
}): ContractPlainSummary => {
  const { description, code, structure, kind } = params

  const readMethods = structure.methods.filter((m) => !m.isWrite)
  const writeMethods = structure.methods.filter((m) => m.isWrite)
  const acceptsPayments = structure.methods.some((m) => m.isPayable)
  const hasOwner = 'owner' in structure.stateVariables || /self\.owner\s*=/.test(code)

  const notes: string[] = []
  if (hasOwner) {
    notes.push('The wallet that deploys this contract becomes its owner.')
  }
  if (acceptsPayments) {
    notes.push('This contract can hold GEN tokens sent to it. Double-check payout logic before deploying real value.')
  }
  if (kind !== 'deterministic') {
    notes.push(
      'AI/web results can occasionally be uncertain — the contract routes unclear cases to an escalated/needs-review state instead of guessing.'
    )
  }
  notes.push('Changing data costs a transaction; reading data is free.')

  return {
    headline: KIND_HEADLINE[kind],
    whatItDoes:
      description.trim() ||
      `A contract with ${structure.methods.length} public action(s) and ${
        Object.keys(structure.stateVariables).length
      } stored record(s).`,
    whatItStores: describeStorage(structure.stateVariables),
    actions: writeMethods.map((m) => describeMethod(m, code)),
    reads: readMethods.map((m) => describeMethod(m, code)),
    notes,
  }
}
