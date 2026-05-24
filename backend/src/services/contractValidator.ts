import type { ValidationResult, ValidationError } from '../types'
import { GENLAYER_DEPENDS_HEADER, startsWithRunnerComment } from './contractCode'

// TODO Phase 3: Full implementation
// Skeleton with all 6 validation steps ready to fill in

export const validateContract = (code: string): ValidationResult => {
  const errors: ValidationError[] = []
  const warnings: ValidationError[] = []

  // 1. Syntax check
  runSyntaxChecks(code, errors)

  // 2. GenLayer spec check
  runSpecChecks(code, errors, warnings)

  // 3. Security check
  runSecurityChecks(code, errors, warnings)

  // 4. Consensus check
  runConsensusChecks(code, warnings)

  // 5. Cost check
  runCostChecks(code, warnings)

  const criticals = errors.filter((e) => e.severity === 'critical')
  const isValid = criticals.length === 0

  return {
    isValid,
    errors,
    warnings,
    summary: isValid
      ? `Valid. ${warnings.length} warning(s).`
      : `${criticals.length} critical error(s) found.`,
  }
}

const runSyntaxChecks = (code: string, errors: ValidationError[]) => {
  if (!code.trim()) {
    errors.push({ type: 'SyntaxError', severity: 'critical', message: 'Contract is empty' })
  }

  const appendedTextLine = findAppendedPlainEnglishLine(code)
  if (appendedTextLine) {
    errors.push({
      type: 'SyntaxError',
      severity: 'critical',
      message: `Plain English text appears inside the .py contract file at line ${appendedTextLine.lineNumber}: "${appendedTextLine.text}"`,
      suggestion:
        'Delete appended explanations/reports after the final contract method. The contract file must contain only Python code, comments, or strings.',
    })
  }
}

const findAppendedPlainEnglishLine = (code: string) => {
  const lines = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  let seenContractClass = false

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]
    const trimmed = line.trim()

    if (/^class\s+\w+\s*\(\s*gl\.Contract\s*\)\s*:/.test(trimmed)) {
      seenContractClass = true
      continue
    }

    if (!seenContractClass || !trimmed || line.startsWith(' ') || line.startsWith('\t')) {
      continue
    }

    const looksLikeCode =
      trimmed.startsWith('#') ||
      /^(from|import)\s+/.test(trimmed) ||
      /^@/.test(trimmed) ||
      /^(class|def)\s+/.test(trimmed) ||
      /^[A-Za-z_]\w*\s*(?::[^=]+)?=/.test(trimmed)

    const looksLikePlainEnglish =
      /^(?:This|The|It|We|I|Fixed|Changed|Added|Removed|Note|Warning|Explanation|Frontend|GenLayer)\b/i.test(trimmed) &&
      /\s/.test(trimmed)

    if (!looksLikeCode && looksLikePlainEnglish) {
      return { lineNumber: i + 1, text: trimmed }
    }
  }

  return null
}

const runSpecChecks = (
  code: string,
  errors: ValidationError[],
  warnings: ValidationError[]
) => {
  if (!startsWithRunnerComment(code)) {
    errors.push({
      type: 'SpecError',
      severity: 'critical',
      message: 'Depends runner comment must be the first line with no blank space before it',
      suggestion: GENLAYER_DEPENDS_HEADER,
    })
  }

  if (/py-genlayer:test/.test(code)) {
    warnings.push({
      type: 'SpecWarning',
      severity: 'warning',
      message: 'Contract uses py-genlayer:test',
      suggestion:
        'Use the current documented py-genlayer runner hash by default. py-genlayer:test should only be used for local throwaway testing.',
    })
  }

  if (!code.includes('from genlayer import')) {
    errors.push({
      type: 'SpecError',
      severity: 'critical',
      message: 'Missing: from genlayer import *',
    })
  }

  if (!code.includes('gl.Contract')) {
    errors.push({
      type: 'SpecError',
      severity: 'critical',
      message: 'Contract must inherit from gl.Contract',
    })
  }

  if (!code.includes('@gl.public')) {
    errors.push({
      type: 'SpecError',
      severity: 'critical',
      message: 'No @gl.public methods found',
    })
  }

  if (!code.includes('@gl.public.view')) {
    errors.push({
      type: 'SpecError',
      severity: 'critical',
      message: 'Contract must include at least one @gl.public.view method for schema/UI inspection',
      suggestion: 'Add a simple getter such as get_count() or get_record(id: int).',
    })
  }

  if (!code.includes('def __init__')) {
    warnings.push({
      type: 'SpecWarning',
      severity: 'warning',
      message: 'Missing __init__ method',
    })
  }

  runPublicMethodChecks(code, errors, warnings)
  runDecoratorBodyChecks(code, errors, warnings)
  runStorageChecks(code, errors, warnings)
  runPayableChecks(code, warnings)

  const storageScanPatterns = [
    { pattern: /\.values\(\)/, label: '.values() over storage collections' },
    { pattern: /\.items\(\)/, label: '.items() over storage collections' },
    { pattern: /for\s+\w+\s+in\s+self\.\w+/, label: 'looping directly over storage collections' },
  ]

  for (const { pattern, label } of storageScanPatterns) {
    if (pattern.test(code)) {
      warnings.push({
        type: 'SpecWarning',
        severity: 'warning',
        message: `Avoid ${label}; it can break GenLayer schema/deploy behavior`,
        suggestion: 'Use direct TreeMap lookups or a secondary TreeMap index for duplicate checks.',
      })
    }
  }
}

const runDecoratorBodyChecks = (
  code: string,
  errors: ValidationError[],
  warnings: ValidationError[]
) => {
  const viewBlocks =
    code.match(/@gl\.public\.view\s+def\s+\w+[\s\S]*?(?=\n\s*@gl\.public|\nclass\s|$)/g) ?? []

  for (const block of viewBlocks) {
    const name = block.match(/def\s+(\w+)\s*\(/)?.[1] ?? 'unknown'
    if (/self\.[A-Za-z_]\w*\s*(?:=|\+=|-=|\*=|\/=)|(?:self\.[A-Za-z_]\w*\.append\s*\()|(?:del\s+self\.)/.test(block)) {
      errors.push({
        type: 'DecoratorError',
        severity: 'critical',
        message: `View method ${name} appears to mutate contract state`,
        suggestion: 'Use @gl.public.view only for read-only methods. Move state changes to @gl.public.write.',
      })
    }

    if (/return\s+self\.[A-Za-z_]\w*\s*(?:\[|\n|$)/.test(block)) {
      warnings.push({
        type: 'FrontendWarning',
        severity: 'warning',
        message: `View method ${name} may return raw storage directly`,
        suggestion:
          'Prefer UI-ready primitive values or a manually built JSON string with id, status, submitter, evidence_url, reason_code, short_reason, and confidence_band where relevant.',
      })
    }
  }
}

const runPublicMethodChecks = (
  code: string,
  errors: ValidationError[],
  warnings: ValidationError[]
) => {
  const publicMethodRegex = /@gl\.public\.(?:view|write)(?:\.payable)?\s+def\s+(\w+)\s*\(([^)]*)\)\s*(?:->\s*([^:\n]+))?/g
  let match

  while ((match = publicMethodRegex.exec(code)) !== null) {
    const [, name, params, returnType] = match
    if (!returnType?.trim()) {
      warnings.push({
        type: 'SchemaWarning',
        severity: 'warning',
        message: `Public method ${name} is missing a return type annotation`,
        suggestion: 'Add -> None for writes or a concrete return type for views.',
      })
    }

    if (returnType && /\blist\s*(?:\[|$)/.test(returnType.trim())) {
      warnings.push({
        type: 'FrontendWarning',
        severity: 'warning',
        message: `Public method ${name} returns a Python list type`,
        suggestion:
          'For GenLayer/frontend safety, return a manually built JSON string for lists, tables, nested records, or winner/submission arrays.',
      })
    }

    if (returnType && isCustomPublicReturnType(returnType.trim())) {
      warnings.push({
        type: 'SchemaWarning',
        severity: 'warning',
        message: `Public method ${name} returns custom type ${returnType.trim()}`,
        suggestion:
          'Prefer primitive returns or a manually built JSON string instead of returning storage dataclass objects directly.',
      })
    }

    const userParams = params
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && p !== 'self')

    for (const param of userParams) {
      const withoutDefault = param.replace(/=.*/, '').trim()
      const typeAnnotation = withoutDefault.includes(':')
        ? withoutDefault.split(':').slice(1).join(':').trim()
        : ''

      if (!withoutDefault.includes(':')) {
        errors.push({
          type: 'SchemaError',
          severity: 'critical',
          message: `Parameter "${withoutDefault}" in ${name} is missing a type annotation`,
          suggestion: 'Annotate public parameters with frontend-safe types such as str, int, bool, or Address.',
        })
      }

      if (/\b(u8|u16|u24|u32|u64|u128|u160|u256|i8|i16|i32|i64|i128|i256)\b/.test(withoutDefault)) {
        warnings.push({
          type: 'FrontendWarning',
          severity: 'warning',
          message: `Parameter "${withoutDefault}" in ${name} uses a GenLayer integer type directly`,
          suggestion: 'For public ABI inputs, prefer int and cast internally to u64/u256 after validation.',
        })
      }

      if (/\bOptional\s*\[|\|\s*None\b/.test(typeAnnotation)) {
        errors.push({
          type: 'SchemaError',
          severity: 'critical',
          message: `Parameter "${withoutDefault}" in ${name} uses an optional type`,
          suggestion:
            'Avoid Optional/T | None in public GenLayer interfaces. Use explicit values and a boolean has_* flag when needed.',
        })
      }

      if (/\b(DynArray|TreeMap|Array)\s*\[/.test(typeAnnotation)) {
        warnings.push({
          type: 'FrontendWarning',
          severity: 'warning',
          message: `Parameter "${withoutDefault}" in ${name} requires a GenLayer collection type`,
          suggestion:
            'Public write methods should accept frontend-friendly str/int/bool/address values. Use comma-separated strings or separate add_* methods instead.',
        })
      }

      if (
        /^[A-Z]\w+$/.test(typeAnnotation) &&
        typeAnnotation !== 'Address' &&
        !/^bytes\d+$/.test(typeAnnotation)
      ) {
        warnings.push({
          type: 'FrontendWarning',
          severity: 'warning',
          message: `Parameter "${withoutDefault}" in ${name} requires custom type ${typeAnnotation}`,
          suggestion:
            'Do not require the frontend to construct GenLayer dataclass objects. Flatten this into simple int/str/bool/address parameters.',
        })
      }
    }
  }
}

const isCustomPublicReturnType = (typeName: string) => {
  const normalized = typeName.replace(/\s/g, '')
  const simpleReturns = new Set([
    'None',
    'str',
    'int',
    'bool',
    'bytes',
    'dict',
    'Address',
    'u8',
    'u16',
    'u24',
    'u32',
    'u64',
    'u128',
    'u160',
    'u256',
    'i8',
    'i16',
    'i32',
    'i64',
    'i128',
    'i256',
  ])

  if (simpleReturns.has(normalized)) {
    return false
  }

  if (/^dict\[/.test(normalized)) {
    return false
  }

  return /^[A-Z]\w+$/.test(normalized)
}

const runStorageChecks = (
  code: string,
  errors: ValidationError[],
  warnings: ValidationError[]
) => {
  const stateLines = code.match(/^\s{4}[A-Za-z_]\w*\s*:\s*[^\n#]+/gm) ?? []
  const declaredState = new Set(
    stateLines
      .map((line) => line.match(/^\s{4}([A-Za-z_]\w*)\s*:/)?.[1])
      .filter(Boolean) as string[]
  )

  for (const line of stateLines) {
    if (/\bOptional\s*\[|\|\s*None\b/.test(line)) {
      errors.push({
        type: 'StorageError',
        severity: 'critical',
        message: `Optional persistent storage can break GenLayer schema/storage: ${line.trim()}`,
        suggestion:
          'Replace optional nested objects with explicit fields and flags, for example has_score plus score_* fields.',
      })
    }

    if (/=\s*None\b/.test(line)) {
      errors.push({
        type: 'StorageError',
        severity: 'critical',
        message: `Persistent storage default uses None: ${line.trim()}`,
        suggestion:
          'Avoid storing None in GenLayer storage. Use default primitive values and a has_* boolean flag.',
      })
    }

    if (/\b(list|dict|set)\s*(\[|$)/.test(line)) {
      errors.push({
        type: 'StorageError',
        severity: 'critical',
        message: `Unsupported persistent storage type: ${line.trim()}`,
        suggestion: 'Use DynArray[T] for arrays and TreeMap[K, V] for mappings.',
      })
    }

    if (/\bfloat\b/.test(line)) {
      errors.push({
        type: 'StorageError',
        severity: 'critical',
        message: `Float storage is unsupported: ${line.trim()}`,
        suggestion: 'Use scaled integers such as basis points.',
      })
    }

    if (/\bint\b/.test(line)) {
      errors.push({
        type: 'StorageError',
        severity: 'critical',
        message: `Plain int persistent storage is unsupported: ${line.trim()}`,
        suggestion: 'Use GenLayer integer types such as u64 for counters or u256 for token/value amounts.',
      })
    }

    if (/TreeMap\[[^\]]*(dict|list|set|tuple)/.test(line) || /DynArray\[[^\]]*(dict|list|set|tuple)/.test(line)) {
      errors.push({
        type: 'StorageError',
        severity: 'critical',
        message: `Unsupported collection type parameter: ${line.trim()}`,
        suggestion: 'TreeMap/DynArray type parameters must also be storage-safe GenLayer types.',
      })
    }
  }

  if (/@dataclass/.test(code) && !/@allow_storage\s*\n\s*@dataclass/.test(code)) {
    errors.push({
      type: 'StorageError',
      severity: 'critical',
      message: 'Storage dataclass is missing @allow_storage',
      suggestion: 'Place @allow_storage directly above @dataclass for custom persistent storage classes.',
    })
  }

  if (/@dataclass/.test(code) && !/from dataclasses import dataclass/.test(code)) {
    errors.push({
      type: 'ImportError',
      severity: 'critical',
      message: 'Contract uses @dataclass but does not import dataclass',
      suggestion: 'Add: from dataclasses import dataclass',
    })
  }

  if (/def\s+__init__\s*\(\s*self\s*,/.test(code)) {
    warnings.push({
      type: 'SchemaWarning',
      severity: 'warning',
      message: 'Constructor accepts arguments',
      suggestion: 'For reusable app contracts, put per-user business data in create_* write methods instead of constructor args.',
    })
  }

  if (/self\.\w+\s*=\s*(\{\}|\[\])/.test(code)) {
    errors.push({
      type: 'StorageError',
      severity: 'critical',
      message: 'Persistent storage is initialized with a normal Python dict/list',
      suggestion: 'Declare TreeMap/DynArray at class level and do not instantiate them with {} or [] in __init__.',
    })
  }

  if (/self\.\w+\s*=\s*None\b/.test(code) || /\w+\s*=\s*None\b/.test(code)) {
    warnings.push({
      type: 'StorageWarning',
      severity: 'warning',
      message: 'Contract assigns None, which is risky for GenLayer storage/schema flows',
      suggestion:
        'Use explicit defaults such as empty strings, zero scores, and has_* booleans instead of None.',
    })
  }

  if (/json\.dumps\s*\([^)]*\.__dict__/.test(code) || /\.__dict__/.test(code)) {
    errors.push({
      type: 'SchemaError',
      severity: 'critical',
      message: 'Contract serializes storage objects with __dict__',
      suggestion:
        'Do not use json.dumps(obj.__dict__) on GenLayer storage objects. Manually build JSON and convert u64/u256/Address/DynArray values clearly.',
    })
  }

  const undeclaredSelfAssignments = Array.from(
    new Set(
      Array.from(code.matchAll(/self\.([A-Za-z_]\w*)\s*=/g))
        .map((match) => match[1])
        .filter((name) => !declaredState.has(name))
    )
  )

  if (undeclaredSelfAssignments.length) {
    warnings.push({
      type: 'StorageWarning',
      severity: 'warning',
      message: `self fields assigned without class-level declarations: ${undeclaredSelfAssignments.join(', ')}`,
      suggestion:
        'Persistent fields should be declared in the contract class body with type annotations before assignment.',
    })
  }
}

const runPayableChecks = (code: string, warnings: ValidationError[]) => {
  const payableMethods = code.match(/@gl\.public\.write\.payable\s+def\s+\w+[\s\S]*?(?=\n\s*@gl\.public|\nclass\s|$)/g) ?? []
  const nonPayableValueUse = /@gl\.public\.write\s+def\s+\w+[\s\S]*?gl\.message\.value/.test(code)

  for (const method of payableMethods) {
    if (!method.includes('gl.message.value')) {
      warnings.push({
        type: 'ValueWarning',
        severity: 'warning',
        message: 'Payable method does not read gl.message.value',
        suggestion: 'Read and validate gl.message.value so received value is accounted for.',
      })
    }

    if (!/(status|resolved|released|refunded|settled)/i.test(method)) {
      warnings.push({
        type: 'ValueWarning',
        severity: 'warning',
        message: 'Payable/value method has no obvious settlement/status guard',
        suggestion: 'Use explicit statuses to prevent double funding, release, refund, or settlement.',
      })
    }
  }

  if (nonPayableValueUse && !code.includes('@gl.public.write.payable')) {
    warnings.push({
      type: 'ValueWarning',
      severity: 'warning',
      message: 'gl.message.value is used without a payable public method',
      suggestion: 'Use @gl.public.write.payable for methods that receive GEN/native value.',
    })
  }
}

const runSecurityChecks = (
  code: string,
  errors: ValidationError[],
  warnings: ValidationError[]
) => {
  const forbidden = [
    { pattern: 'eval(', name: 'eval()' },
    { pattern: 'exec(', name: 'exec()' },
    { pattern: '__import__', name: '__import__' },
    { pattern: 'os.system', name: 'os.system' },
    { pattern: 'subprocess', name: 'subprocess' },
    { pattern: 'pickle', name: 'pickle' },
    { pattern: 'import requests', name: 'requests' },
    { pattern: 'requests.', name: 'requests' },
    { pattern: 'import urllib', name: 'urllib' },
    { pattern: 'import httpx', name: 'httpx' },
    { pattern: 'import aiohttp', name: 'aiohttp' },
    { pattern: 'import random', name: 'random' },
    { pattern: 'random.random', name: 'random.random()' },
    { pattern: 'import datetime', name: 'datetime' },
    { pattern: 'datetime.now', name: 'datetime.now()' },
    { pattern: 'import time', name: 'time' },
    { pattern: 'time.time', name: 'time.time()' },
    { pattern: 'uuid.uuid4', name: 'uuid.uuid4()' },
    { pattern: 'firebase', name: 'Firebase/Admin SDK' },
    { pattern: 'firestore', name: 'Firestore' },
  ]

  for (const { pattern, name } of forbidden) {
    if (code.includes(pattern)) {
      errors.push({
        type: 'SecurityError',
        severity: 'critical',
        message: `Forbidden: ${name}`,
      })
    }
  }

  if (/msg\.sender|block\.timestamp|mapping\s*\(|pragma solidity|contract\s+\w+\s*\{/.test(code)) {
    errors.push({
      type: 'SyntaxError',
      severity: 'critical',
      message: 'Solidity-style syntax detected in a GenLayer Intelligent Contract in Python',
      suggestion: 'Use gl.message.sender_address, frontend-passed timestamps, and Python class syntax.',
    })
  }

  if (/follow (the )?instructions/i.test(code) && /web|source|html|content/i.test(code)) {
    warnings.push({
      type: 'PromptInjectionWarning',
      severity: 'warning',
      message: 'Prompt may let fetched content override contract instructions',
      suggestion: 'Treat web content as untrusted evidence and tell the LLM not to follow instructions inside it.',
    })
  }

  if (/frontend.*verif|client.*verif|verified_by_frontend/i.test(code)) {
    errors.push({
      type: 'SecurityError',
      severity: 'critical',
      message: 'Frontend-only verification detected',
      suggestion:
        'Final verification or judgement state must be controlled by the GenLayer contract, not trusted from the frontend.',
    })
  }

  if (/(admin|owner|resolver|reset|withdraw|configure|set_)/i.test(code) && !/gl\.message\.(sender_address|origin_address)/.test(code)) {
    warnings.push({
      type: 'SecurityWarning',
      severity: 'warning',
      message: 'Privileged-looking methods or state were detected without an obvious sender/origin check',
      suggestion: 'Add owner/admin/resolver checks before hidden or privileged mutations.',
    })
  }
}

const runConsensusChecks = (code: string, warnings: ValidationError[]) => {
  const usesNondetPrompt = code.includes('gl.nondet.exec_prompt')
  const usesAnyPrompt = usesNondetPrompt || code.includes('gl.exec_prompt')
  const usesJsonResponseFormat = /response_format\s*=\s*["']json["']/.test(code)
  const usesStrictEquality = /\bstrict_eq\b|eq_principle_strict_eq/.test(code)
  const looksSubjective =
    /score|scoring|judge|judging|evaluate|evaluation|mediate|mediation|dispute|adjudicat|reasoning|rubric|bounty|winner|impact|innovation|presentation/i.test(code)
  const hasEquivalence =
    code.includes('gl.eq_principle') ||
    code.includes('gl.vm.run_nondet_unsafe') ||
    code.includes('validator_fn')

  if (code.includes('gl.exec_prompt')) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'Contract uses gl.exec_prompt instead of gl.nondet.exec_prompt',
      suggestion: 'Use gl.nondet.exec_prompt for GenLayer LLM calls.',
    })
  }

  if (usesAnyPrompt && !code.includes('YES') && !code.includes('NO') && !code.toLowerCase().includes('json')) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'LLM prompt may not use structured output',
      suggestion: 'Ask for YES/NO or JSON to ensure validator consensus',
    })
  }

  if (usesNondetPrompt && !hasEquivalence) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'Nondeterministic LLM call has no obvious equivalence or validation strategy',
      suggestion: 'Use gl.eq_principle.* or gl.vm.run_nondet_unsafe with a validator function.',
    })
  }

  if (/self\.[A-Za-z_]\w*\s*=\s*gl\.nondet/i.test(code)) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'Raw nondeterministic output appears to be written directly to storage',
      suggestion:
        'Wrap AI/web output in strict_eq, prompt_comparative, prompt_non_comparative, or run_nondet_unsafe before storing it.',
    })
  }

  if (usesNondetPrompt && !code.includes('response_format="json"') && /decision|verdict|outcome|classif|approve|reject|resolve/i.test(code)) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'Decision-making LLM call may be missing response_format="json"',
      suggestion: 'Use bounded JSON output and validate enum fields before storing.',
    })
  }

  if (usesJsonResponseFormat && /json\.loads\s*\(/.test(code)) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'Contract uses json.loads even though response_format="json" is requested',
      suggestion:
        'If exec_prompt returns an already parsed dict, validate it directly. Only parse strings after checking the returned type.',
    })
  }

  if (usesStrictEquality && usesNondetPrompt && looksSubjective) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'Strict equality is risky for subjective AI judging/scoring/evaluation',
      suggestion:
        'Use leader_fn + validator_fn + gl.vm.run_nondet_unsafe. Validate required fields, score ranges such as 0-100, and reason strings.',
    })
  }

  if (usesNondetPrompt && /prompt\s*=\s*["'`]([^"'`]{0,40})["'`]/.test(code)) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'LLM prompt appears very short or underspecified',
      suggestion: 'Include task, evidence, allowed enum outputs, JSON schema, and unverifiable/undetermined fallback.',
    })
  }

  if (/judge if this is good|is this good|what do you think/i.test(code)) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'AI prompt is too vague for validator consensus',
      suggestion:
        'Force compact valid JSON, no markdown, allowed enum values, explicit criteria, confidence range, and short reasons.',
    })
  }

  if (usesNondetPrompt && !/ESCALATED|NEEDS_REVIEW|UNDETERMINED|UNVERIFIABLE/i.test(code)) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'AI/web judgement has no obvious uncertain or escalation path',
      suggestion:
        'Add ESCALATED, NEEDS_REVIEW, UNDETERMINED, or UNVERIFIABLE handling for weak evidence, malformed output, or validator uncertainty.',
    })
  }

  if (usesNondetPrompt && /confidence/i.test(code) && !/confidence_band|LOW|MEDIUM|HIGH/.test(code)) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'AI judgement uses confidence without a confidence band',
      suggestion:
        'Use LOW, MEDIUM, HIGH confidence_band for consensus-critical logic; exact numeric confidence can remain display-only.',
    })
  }

  if (usesNondetPrompt && !/TASK\s*:|RULES\s*:|OUTPUT(?: FORMAT)?\s*:/i.test(code)) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'AI prompt may not use bounded labelled sections',
      suggestion:
        'Build prompts with TASK, RULES, CLAIM, UNTRUSTED EVIDENCE, and OUTPUT FORMAT sections so user/evidence text cannot become instructions.',
    })
  }

  if (usesJsonResponseFormat && !/\bnot\s+in\b|\.get\s*\(|isinstance\s*\(/.test(code)) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'JSON AI output may not be validated after parsing',
      suggestion:
        'Validate verdict, reason_code, status, confidence, and confidence_band before storing. Invalid values should escalate instead of approving.',
    })
  }

  if ((code.includes('gl.http_get') || code.includes('gl.nondet.web')) && !/status|resp\.status|response\.status/.test(code)) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'Web request may not handle HTTP error status',
      suggestion: 'Check response status and include unavailable/undetermined behavior.',
    })
  }
}

const runCostChecks = (code: string, warnings: ValidationError[]) => {
  const llmCalls = (code.match(/gl\.(?:nondet\.)?exec_prompt/g) ?? []).length
  if (llmCalls > 5) {
    warnings.push({
      type: 'CostWarning',
      severity: 'warning',
      message: `${llmCalls} LLM calls detected (may be expensive)`,
    })
  }
}
