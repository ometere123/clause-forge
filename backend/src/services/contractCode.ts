export const GENLAYER_DEPENDS_HEADER =
  '# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }'

const DEPENDS_LINE_RE = /^\s*#\s*\{\s*"Depends"\s*:\s*"py-genlayer:[^"]+"\s*\}\s*$/i

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
