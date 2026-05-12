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

const runSecurityChecks = (
  code: string,
  errors: ValidationError[],
  _warnings: ValidationError[]
) => {
  const forbidden = [
    { pattern: 'eval(', name: 'eval()' },
    { pattern: 'exec(', name: 'exec()' },
    { pattern: '__import__', name: '__import__' },
    { pattern: 'os.system', name: 'os.system' },
    { pattern: 'subprocess', name: 'subprocess' },
    { pattern: 'pickle', name: 'pickle' },
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
}

const runConsensusChecks = (code: string, warnings: ValidationError[]) => {
  if (code.includes('gl.exec_prompt') && !code.includes('YES') && !code.includes('NO') && !code.includes('json')) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'LLM prompt may not use structured output',
      suggestion: 'Ask for YES/NO or JSON to ensure validator consensus',
    })
  }

  if (code.includes('gl.http_get') && !code.includes('timeout')) {
    warnings.push({
      type: 'ConsensusWarning',
      severity: 'warning',
      message: 'Web request missing timeout',
      suggestion: 'Add timeout=5 to gl.http_get()',
    })
  }
}

const runCostChecks = (code: string, warnings: ValidationError[]) => {
  const llmCalls = (code.match(/gl\.exec_prompt/g) ?? []).length
  if (llmCalls > 5) {
    warnings.push({
      type: 'CostWarning',
      severity: 'warning',
      message: `${llmCalls} LLM calls detected (may be expensive)`,
    })
  }
}
