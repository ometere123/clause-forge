import type {
  ContractGenerationReport,
  ContractKind,
  ContractStructure,
  FrontendCallMapItem,
} from '../types'

const hasAny = (text: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text))
const hasWorkingHeader = (code: string) => {
  const lines = code.replace(/^\uFEFF/, '').split(/\r?\n/)
  return (
    /^#\s*v0\.2\.(?:16|17)\s*$/.test(lines[0] ?? '') &&
    /^\s*#\s*\{\s*"Depends"\s*:\s*"py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6"\s*\}\s*$/.test(
      lines[1] ?? ''
    )
  )
}

export const classifyContractKind = (description: string, code: string): ContractKind => {
  const combined = `${description}\n${code}`.toLowerCase()

  if (
    hasAny(combined, [
      /gl\.nondet\.exec_prompt/,
      /\b(ai|llm|judge|judging|evaluate|score|classify|moderate|dispute|fraud|evidence|reasoning|subjective)\b/,
    ])
  ) {
    return 'ai-judgement'
  }

  if (
    hasAny(combined, [
      /gl\.nondet\.web/,
      /\b(url|api|web|github|docs|news|source|fetch|external evidence|public data)\b/,
    ])
  ) {
    return 'web-aware'
  }

  return 'deterministic'
}

const getEquivalenceStrategy = (kind: ContractKind, code: string) => {
  if (/run_nondet_unsafe|validator_fn/.test(code)) {
    return {
      strategy: 'custom leader/validator',
      explanation:
        'The contract uses explicit leader and validator logic to check output shape, allowed values, and material decision fields before storing state.',
    }
  }

  if (/prompt_comparative/.test(code)) {
    return {
      strategy: 'prompt_comparative',
      explanation:
        'Validators compare whether independently produced outputs reach the same material conclusion, allowing wording to differ.',
    }
  }

  if (/prompt_non_comparative/.test(code)) {
    return {
      strategy: 'prompt_non_comparative',
      explanation:
        'Validators judge whether the leader output satisfies stated criteria instead of reproducing the same answer byte-for-byte.',
    }
  }

  if (/strict_eq|eq_principle_strict_eq/.test(code)) {
    return {
      strategy: 'strict_eq',
      explanation:
        'Strict equality is only appropriate when the expected nondeterministic output is exact and stable.',
    }
  }

  if (kind === 'deterministic') {
    return {
      strategy: 'deterministic state transition',
      explanation:
        'No AI or web nondeterminism was detected, so consensus should come from deterministic GenVM execution of the same state transition.',
    }
  }

  return {
    strategy: 'missing or unclear equivalence guard',
    explanation:
      'This contract appears to use AI/web behaviour, but no obvious equivalence guard was detected. Add strict_eq, prompt_comparative, prompt_non_comparative, or custom leader/validator logic before writing nondeterministic output to state.',
  }
}

const buildFitCheck = (
  kind: ContractKind,
  description: string,
  code: string
): ContractGenerationReport['fitCheck'] => {
  const hasValue = /payable|gl\.message\.value|deposit|escrow|payout|reward|fund/i.test(
    `${description}\n${code}`
  )

  if (kind === 'deterministic') {
    return {
      genLayerDecision:
        'Whether the submitted inputs satisfy deterministic contract rules and allowed state transitions.',
      acceptedStateChange:
        'A contract-owned record, counter, ownership field, status, or balance changes only after the deterministic checks pass.',
      validatorEvidence:
        'Current contract state, caller address, method inputs, and any value sent with the transaction.',
      exactAgreementFields: hasValue
        ? ['record_id', 'caller/role', 'amount', 'status']
        : ['record_id', 'caller/role', 'status'],
      semanticAgreementFields: ['short display labels or optional UI notes, if any'],
      uncertainRejectedAppealedPath:
        'Invalid inputs or invalid transitions should revert with gl.vm.UserError; deterministic contracts usually do not need appeal logic unless the app adds dispute handling.',
    }
  }

  if (kind === 'web-aware') {
    return {
      genLayerDecision:
        'Whether independently verifiable public web/API evidence supports the requested state change.',
      acceptedStateChange:
        'The record status, outcome, evidence reference, reason_code, and compact reason are updated from the verified public evidence.',
      validatorEvidence:
        'Public URL, API endpoint, transaction hash, GitHub repo, public post, public app link, or another independently checkable evidence reference.',
      exactAgreementFields: ['verdict', 'final_status', 'reason_code', 'confidence_band'],
      semanticAgreementFields: ['short_reason', 'public evidence summary'],
      uncertainRejectedAppealedPath:
        'If evidence is unavailable, contradictory, malformed, or too weak, set ESCALATED/NEEDS_REVIEW/UNDETERMINED instead of forcing approval or rejection.',
    }
  }

  return {
    genLayerDecision:
      'What verdict validators should accept for the submitted claim, evidence, criteria, or dispute.',
    acceptedStateChange:
      'The contract stores final judgement fields such as verdict, status, reason_code, confidence_band, short_reason, submitter, and evidence reference.',
    validatorEvidence:
      'Claim text plus public or independently verifiable evidence, not a private frontend/backend AI result.',
    exactAgreementFields: ['verdict', 'final_status', 'reason_code', 'confidence_band'],
    semanticAgreementFields: ['short_reason', 'reasoning wording, as long as it supports the same decision'],
    uncertainRejectedAppealedPath:
      'Malformed AI output, weak evidence, contradictory evidence, rejection, or appeal should move the record to ESCALATED/NEEDS_REVIEW/UNDETERMINED or a defined appeal status.',
  }
}

const buildStateTransitions = (kind: ContractKind, code: string) => {
  if (/escrow|deposit|fund|release|refund|settle|payout/i.test(code)) {
    return [
      'CREATED -> FUNDED',
      'FUNDED -> SUBMITTED',
      'SUBMITTED -> RELEASED',
      'SUBMITTED -> DISPUTED',
      'DISPUTED -> RESOLVED_RELEASE',
      'DISPUTED -> RESOLVED_REFUND',
      'DISPUTED -> RESOLVED_SPLIT',
      'Any final settlement status rejects later release/refund/settlement writes',
    ]
  }

  if (kind === 'ai-judgement' || kind === 'web-aware') {
    return [
      'PENDING -> UNDER_REVIEW',
      'UNDER_REVIEW -> APPROVED',
      'UNDER_REVIEW -> REJECTED',
      'UNDER_REVIEW -> ESCALATED',
      'REJECTED -> APPEALED',
      'APPEALED -> FINAL_APPROVED',
      'APPEALED -> FINAL_REJECTED',
      'Final statuses reject duplicate judging, overwriting, or invalid appeal attempts',
    ]
  }

  return [
    'CREATED -> ACTIVE',
    'ACTIVE -> UPDATED',
    'ACTIVE -> CLOSED or FINALIZED when the app has a terminal state',
    'Duplicate IDs, unauthorized updates, and writes to final records should be rejected',
  ]
}

const buildConsensusCriticalFields = (
  kind: ContractKind
): ContractGenerationReport['consensusCriticalFields'] => {
  if (kind === 'deterministic') {
    return {
      exact: ['record_id', 'caller/role', 'status', 'stored value'],
      semantic: ['optional UI-facing notes only'],
    }
  }

  return {
    exact: ['verdict', 'final_status', 'reason_code', 'confidence_band'],
    semantic: ['short_reason', 'evidence summary wording'],
  }
}

const buildSourceOfTruth = (): ContractGenerationReport['sourceOfTruth'] => ({
  genLayer: [
    'Final judgement',
    'Verification status',
    'Dispute result',
    'Appeal result',
    'Reward/rejection status',
  ],
  offChain: [
    'Search',
    'Notifications',
    'Dashboards',
    'Cached profiles',
    'File uploads',
    'Off-chain logs',
    'UI history',
  ],
})

const buildFrontendBackendCallTable = (
  callMap: FrontendCallMapItem[]
): ContractGenerationReport['frontendBackendCallTable'] => {
  const frontend = callMap.map((item) => {
    const args = item.args.length ? item.args.join(', ') : 'no args'
    const afterWrite =
      item.type === 'view'
        ? 'display the returned contract state'
        : 'submit a transaction, then re-read the relevant view method before updating final UI state'
    const value = item.valueRequired ? '; value required' : ''
    return `${item.method}(${args}): ${item.type}${value}; ${afterWrite}.`
  })

  return {
    frontend:
      frontend.length > 0
        ? frontend
        : ['No frontend call map was detected; add public view/write methods before deployment.'],
    backend: [
      'Optionally mirror view-method results for search, dashboards, and UI history.',
      'Backend must not invent final judgement, verification status, dispute result, appeal result, or reward/rejection status.',
      'After writes, backend jobs should read contract view methods before mirroring state off-chain.',
    ],
  }
}

const hasWriteMethod = (callMap: FrontendCallMapItem[]) =>
  callMap.some((item) => item.type === 'write' || item.type === 'payable')

const hasReadMethod = (callMap: FrontendCallMapItem[]) =>
  callMap.some((item) => item.type === 'view')

const scanBadPatterns = (code: string, kind: ContractKind, callMap: FrontendCallMapItem[]) => {
  const declaredState = new Set(
    Array.from(code.matchAll(/^\s{4}([A-Za-z_]\w*)\s*:\s*[^\n#=]+/gm)).map((match) => match[1])
  )
  const selfAssignments = Array.from(code.matchAll(/self\.([A-Za-z_]\w*)\s*=/g)).map(
    (match) => match[1]
  )
  const undeclaredSelfAssignments = Array.from(
    new Set(selfAssignments.filter((name) => !declaredState.has(name)))
  )

  const checks: ContractGenerationReport['badPatternReport'] = [
    {
      pattern: 'working GenLayer Studio header',
      status: hasWorkingHeader(code)
        ? 'pass'
        : /py-genlayer:test/.test(code)
        ? 'fail'
        : 'warning',
      detail: /py-genlayer:test/.test(code)
        ? 'py-genlayer:test is only appropriate for local throwaway testing.'
        : 'Use # v0.2.16 or # v0.2.17 on line 1 and the py-genlayer Depends runner hash on line 2.',
    },
    {
      pattern: 'dict/list persistent storage',
      status: /^\s{4}[A-Za-z_]\w*\s*:\s*(dict|list|set)\b/m.test(code) ? 'fail' : 'pass',
      detail: 'Persistent mappings/arrays should use TreeMap/DynArray, not Python dict/list/set.',
    },
    {
      pattern: 'undeclared self-created persistent fields',
      status: undeclaredSelfAssignments.length ? 'warning' : 'pass',
      detail: undeclaredSelfAssignments.length
        ? `These self fields are assigned but not declared in the class body: ${undeclaredSelfAssignments.join(', ')}.`
        : 'Important persistent fields appear declared in the class body.',
    },
    {
      pattern: 'random/time/uuid',
      status: /\b(time\.time|datetime\.now|random\.random|uuid\.uuid4)\s*\(/.test(code)
        ? 'fail'
        : 'pass',
      detail: 'Avoid nondeterministic Python runtime helpers inside GenVM contracts.',
    },
    {
      pattern: 'external Python HTTP libraries',
      status: /\b(import requests|requests\.|urllib|httpx|aiohttp)\b/.test(code) ? 'fail' : 'pass',
      detail: 'Use GenLayer nondeterministic web access, not normal Python HTTP libraries.',
    },
    {
      pattern: 'raw nondeterministic output stored directly',
      status: /self\.[A-Za-z_]\w*\s*=\s*gl\.nondet|self\.[A-Za-z_]\w*\s*=\s*\w+\s*#?\s*(?:raw|nondet)/i.test(code)
        ? 'fail'
        : kind !== 'deterministic' && !/strict_eq|prompt_comparative|prompt_non_comparative|run_nondet_unsafe|validator_fn/.test(code)
        ? 'warning'
        : 'pass',
      detail: 'AI/web output should pass through an equivalence or validation guard before it is written to state.',
    },
    {
      pattern: 'vague AI prompts',
      status: /judge if this is good|is this good|what do you think/i.test(code) ? 'warning' : 'pass',
      detail: 'AI prompts should force compact JSON, enum values, and explicit criteria.',
    },
    {
      pattern: 'state-changing view methods',
      status: /@gl\.public\.view\s+def\s+\w+[\s\S]*?self\.[A-Za-z_]\w*\s*(?:=|\+=|-=|\*=|\/=)/.test(code)
        ? 'fail'
        : 'pass',
      detail: 'View methods must be read-only. Any state mutation belongs in @gl.public.write.',
    },
    {
      pattern: 'uncertain/escalation path',
      status:
        kind !== 'deterministic' && !/ESCALATED|NEEDS_REVIEW|UNDETERMINED|UNVERIFIABLE/i.test(code)
          ? 'warning'
          : 'pass',
      detail:
        'AI/web judgement should handle weak evidence, malformed output, rejected results, and appeals through ESCALATED/NEEDS_REVIEW/UNDETERMINED-style states.',
    },
    {
      pattern: 'confidence band',
      status:
        kind === 'ai-judgement' && /confidence/i.test(code) && !/confidence_band|LOW|MEDIUM|HIGH/.test(code)
          ? 'warning'
          : 'pass',
      detail:
        'Consensus should depend on verdict, reason_code, and LOW/MEDIUM/HIGH confidence_band rather than an exact confidence number.',
    },
    {
      pattern: 'bounded prompt sections',
      status:
        kind === 'ai-judgement' && !/TASK\s*:|RULES\s*:|OUTPUT(?: FORMAT)?\s*:/i.test(code)
          ? 'warning'
          : 'pass',
      detail:
        'AI prompts should use labelled TASK, RULES, CLAIM, UNTRUSTED EVIDENCE, and OUTPUT FORMAT sections.',
    },
    {
      pattern: 'frontend-only verification',
      status: /frontend.*verif|client.*verif|verified_by_frontend/i.test(code) ? 'fail' : 'pass',
      detail: 'Final verification state must be contract-controlled, not trusted from the frontend.',
    },
    {
      pattern: 'Firebase/Admin SDK as final truth',
      status: /firebase|admin sdk|firestore/i.test(code) ? 'fail' : 'pass',
      detail: 'Firebase/Admin SDK logic belongs off-chain; the contract should store final verified state.',
    },
    {
      pattern: 'missing owner/admin checks',
      status: /(admin|owner|resolver|reset|withdraw|configure|set_)/i.test(code) &&
        !/gl\.message\.sender_address|gl\.message\.origin_address/.test(code)
        ? 'warning'
        : 'pass',
      detail: 'Privileged write methods should check owner/admin/resolver authority.',
    },
    {
      pattern: 'missing read methods',
      status: hasReadMethod(callMap) ? 'pass' : 'fail',
      detail: 'Every generated contract should expose at least one @gl.public.view method for schema/UI use.',
    },
    {
      pattern: 'unclear frontend call map',
      status: callMap.length && (hasWriteMethod(callMap) || hasReadMethod(callMap)) ? 'pass' : 'warning',
      detail: 'Frontend/backend calls should be clear enough to wire into the UI after deployment.',
    },
  ]

  return checks
}

export const buildContractGenerationReport = (params: {
  description: string
  code: string
  structure: ContractStructure
  frontendCallMap: FrontendCallMapItem[]
}): ContractGenerationReport => {
  const { description, code, structure, frontendCallMap } = params
  const kind = classifyContractKind(description, code)
  const equivalenceStrategy = getEquivalenceStrategy(kind, code)
  const hasAi = kind === 'ai-judgement'
  const hasWeb = kind === 'web-aware' || code.includes('gl.nondet.web')

  const whatThisContractDoes =
    description.trim() ||
    `This contract exposes ${structure.methods.length} public method(s) and ${Object.keys(
      structure.stateVariables
    ).length} persistent state field(s).`

  const whyGenLayer =
    kind === 'deterministic'
      ? 'This contract is mostly deterministic. It can run as a simple GenLayer Intelligent Contract, but the GenLayer advantage is limited unless AI judgement, web evidence, or validator consensus is added.'
      : hasAi
      ? 'This belongs on GenLayer because it asks validators to agree on an AI-assisted judgement over language, evidence, quality, fraud, moderation, scoring, or another subjective outcome.'
      : 'This belongs on GenLayer because it uses public web/API evidence and needs validators to agree on the fetched evidence and resulting state transition.'

  return {
    contractKind: kind,
    whatThisContractDoes,
    whyGenLayer,
    fitCheck: buildFitCheck(kind, description, code),
    stateTransitions: buildStateTransitions(kind, code),
    consensusCriticalFields: buildConsensusCriticalFields(kind),
    responsibilityBoundary: {
      insideContract: [
        'Verified state and final status',
        hasAi || hasWeb ? 'Evidence URL/hash references and compact reasoning output' : 'Deterministic state changes and public records',
        'Public read/write/payable methods',
        'Owner/admin/resolver checks where needed',
      ],
      outsideContract: [
        'Frontend UI rendering',
        'Private API keys and Firebase/Admin SDK writes',
        'File uploads and off-chain notifications',
        'Large analytics, full raw webpage archives, and private user authentication',
      ],
    },
    equivalenceStrategy,
    sourceOfTruth: buildSourceOfTruth(),
    frontendBackendCallTable: buildFrontendBackendCallTable(frontendCallMap),
    integrationNotes: [
      'Store final verified state, status, compact reasons, and evidence references on-chain.',
      'Mirror searchable metadata, UI labels, and large history off-chain when needed.',
      'Do not trust final judgement, verification, or privileged actions from the frontend alone.',
      'Frontend/backend should generate user-facing IDs when required, while the contract remains the source of final state.',
      'UI should display read methods, transaction status, final status, compact reason fields, and any evidence references.',
      'After every write call, the frontend should re-read contract state using the relevant view method instead of relying only on optimistic UI state.',
      'Read methods should be UI-ready, preferably returning primitive values or compact JSON strings with id, status, submitter, evidence_url, reason_code, short_reason, and confidence_band where relevant.',
    ],
    testPlan: [
      'Syntax/import check',
      'Storage initialisation check',
      'Write method happy path',
      'Read method check',
      'Bad input check',
      'Bad LLM JSON check',
      'Repeated call/idempotency check',
      'Frontend call simulation',
      'Studio/manual interaction check',
      'Multi-validator/equivalence behaviour check',
    ],
    badPatternReport: scanBadPatterns(code, kind, frontendCallMap),
  }
}
