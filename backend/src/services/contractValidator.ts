import type { ValidationResult, ValidationError } from '../types'

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
}

const runSpecChecks = (
  code: string,
  errors: ValidationError[],
  warnings: ValidationError[]
) => {
  if (!code.includes('{ "Depends"')) {
    errors.push({
      type: 'SpecError',
      severity: 'critical',
      message: 'Missing Depends header',
      suggestion: '# { "Depends": "py-genlayer:..." }',
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

    const userParams = params
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && p !== 'self')

    for (const param of userParams) {
      const withoutDefault = param.replace(/=.*/, '').trim()
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
    }
  }
}

const runStorageChecks = (
  code: string,
  errors: ValidationError[],
  warnings: ValidationError[]
) => {
  const stateLines = code.match(/^\s{4}[A-Za-z_]\w*\s*:\s*[^\n#]+/gm) ?? []

  for (const line of stateLines) {
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
    { pattern: 'import urllib', name: 'urllib' },
    { pattern: 'import random', name: 'random' },
    { pattern: 'import datetime', name: 'datetime' },
    { pattern: 'import time', name: 'time' },
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
      message: 'Solidity-style syntax detected in a GenLayer Python contract',
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
}

const runConsensusChecks = (code: string, warnings: ValidationError[]) => {
  const usesNondetPrompt = code.includes('gl.nondet.exec_prompt')
  const usesAnyPrompt = usesNondetPrompt || code.includes('gl.exec_prompt')
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

  if (usesNondetPrompt && !code.includes('response_format="json"') && /decision|verdict|outcome|classif|approve|reject|resolve/i.test(code)) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'Decision-making LLM call may be missing response_format="json"',
      suggestion: 'Use bounded JSON output and validate enum fields before storing.',
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
