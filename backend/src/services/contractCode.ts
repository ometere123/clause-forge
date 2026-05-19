export const GENLAYER_DEPENDS_HEADER =
  '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'

const DEPENDS_LINE_RE = /^\s*#\s*\{\s*"Depends"\s*:\s*"py-genlayer:[^"]+"\s*\}\s*$/i
const REPORT_HEADING_RE =
  /^(?:A\.\s+|B\.\s+|C\.\s+|D\.\s+|E\.\s+|DIAGNOSIS|ISSUE_CATEGORY|EXPLANATION|CHANGES|WARNINGS|NOTES|WHAT\s+CHANGED|WHAT\s+THIS\s+CONTRACT\s+DOES|FRONTEND\s+CALLS|GENLAYER-SPECIFIC\s+NOTES|POSSIBLE\s+LIMITATIONS)\b/i
const PLAIN_ENGLISH_RE =
  /^(?:This|The|It|We|I|Fixed|Changed|Added|Removed|Note|Warning|Explanation|Frontend|GenLayer)\b/i

const stripTrailingReportText = (source: string): string => {
  const lines = source.split('\n')
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

    if (REPORT_HEADING_RE.test(trimmed) || /^[-*]\s+/.test(trimmed)) {
      return lines.slice(0, i).join('\n').trimEnd()
    }

    const looksLikeCode =
      DEPENDS_LINE_RE.test(trimmed) ||
      /^(from|import)\s+/.test(trimmed) ||
      /^@/.test(trimmed) ||
      /^(class|def)\s+/.test(trimmed) ||
      /^[A-Za-z_]\w*\s*(?::[^=]+)?=/.test(trimmed)

    if (!looksLikeCode && PLAIN_ENGLISH_RE.test(trimmed) && /\s/.test(trimmed)) {
      return lines.slice(0, i).join('\n').trimEnd()
    }
  }

  return source
}

export const normalizeContractCode = (source: string): string => {
  let code = source
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')

  code = code
    .replace(/^\s*```(?:python|py)?\s*\n?/i, '')
    .replace(/\n?\s*```\s*$/i, '')
    .trim()

  const rawLines = code.split('\n')
  const firstDependsIndex = rawLines.findIndex((line) => DEPENDS_LINE_RE.test(line))
  const firstImportIndex = rawLines.findIndex((line) => line.includes('from genlayer import'))

  if (firstDependsIndex > 0) {
    code = rawLines.slice(firstDependsIndex).join('\n')
  } else if (firstDependsIndex === -1 && firstImportIndex > 0) {
    code = rawLines.slice(firstImportIndex).join('\n')
  }

  code = stripTrailingReportText(code)

  const bodyLines = code
    .split('\n')
    .filter((line) => !DEPENDS_LINE_RE.test(line))

  let normalized = [GENLAYER_DEPENDS_HEADER, ...bodyLines].join('\n')

  if (!normalized.includes('from genlayer import')) {
    const lines = normalized.split('\n')
    lines.splice(1, 0, 'from genlayer import *')
    normalized = lines.join('\n')
  }

  return normalized.replace(/\n{3,}/g, '\n\n').trimEnd()
}

export const startsWithRunnerComment = (code: string): boolean =>
  code.replace(/^\uFEFF/, '').startsWith(GENLAYER_DEPENDS_HEADER)
