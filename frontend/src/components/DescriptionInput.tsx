import { useState } from 'react'
import { useContractGeneration } from '@/hooks/useContractGeneration'
import { useContractStore } from '@/store'
import { cn } from '@/lib/utils'
import ApiKeyPanel from '@/components/ApiKeyPanel'
import { createImportedContract } from '@/utils/contractImport'
import { CONTRACT_TEMPLATES, type ContractTemplate, type TemplateKind } from '@/config/templates'

const KIND_BADGE: Record<TemplateKind, { label: string; className: string }> = {
  'ai-judgement': { label: 'Judgement', className: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300' },
  'web-aware': { label: 'Web', className: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300' },
  deterministic: { label: 'Code', className: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300' },
}

const IMPORT_PLACEHOLDER = `# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *

class MyContract(gl.Contract):
    ...`

interface DescriptionInputProps {
  onGenerated: () => void
}

export default function DescriptionInput({ onGenerated }: DescriptionInputProps) {
  const [mode, setMode] = useState<'generate' | 'paste'>('generate')
  const [description, setDescription] = useState('')
  const [existingCode, setExistingCode] = useState('')
  const [importError, setImportError] = useState<string | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const { generate, isLoading } = useContractGeneration()
  const {
    generationError,
    setDescription: setStoredDescription,
    setGeneratedContract,
  } = useContractStore()

  const handleGenerate = async () => {
    if (description.trim().length < 20) return
    const ok = await generate(description)
    if (ok) onGenerated()
  }

  const handleTemplate = (template: ContractTemplate) => {
    setDescription(template.prompt)
    setSelectedTemplate(template.id)
    setMode('generate')
  }

  const handleImport = () => {
    setImportError(null)

    if (existingCode.trim().length < 40) {
      setImportError('Paste a complete GenLayer Intelligent Contract in Python.')
      return
    }

    try {
      const importedContract = createImportedContract(existingCode)
      if (
        !importedContract.generatedCode.includes('class') ||
        !importedContract.generatedCode.includes('gl.Contract')
      ) {
        setImportError('The pasted code must include a contract class that extends gl.Contract.')
        return
      }

      setStoredDescription(importedContract.originalDescription)
      setGeneratedContract(importedContract)
      onGenerated()
    } catch (error: any) {
      setImportError(error?.message ?? 'Could not import this contract.')
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-lg border border-border bg-muted/30 p-1">
        <button
          onClick={() => setMode('generate')}
          className={cn(
            'rounded-md px-4 py-2.5 text-sm font-semibold transition',
            mode === 'generate'
              ? 'bg-background text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Generate from description
        </button>
        <button
          onClick={() => setMode('paste')}
          className={cn(
            'rounded-md px-4 py-2.5 text-sm font-semibold transition',
            mode === 'paste'
              ? 'bg-background text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          Paste existing contract
        </button>
      </div>

      {mode === 'paste' ? (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 sm:gap-6">
          <div className="lg:col-span-1 space-y-3">
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Import
            </p>
            <div className="border border-border rounded-lg px-4 py-3 text-sm text-muted-foreground space-y-2">
              <p>Paste a complete GenLayer Intelligent Contract in Python.</p>
              <p>This path skips generation entirely and uses no API calls.</p>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div>
              <label className="block text-sm font-semibold mb-2">
                Existing contract code
              </label>
              <textarea
                value={existingCode}
                onChange={(e) => setExistingCode(e.target.value)}
                placeholder={IMPORT_PLACEHOLDER}
                spellCheck={false}
                className="w-full h-[56vh] min-h-[360px] px-4 py-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono text-xs sm:text-sm"
              />
              <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground mt-1">
                <span>{existingCode.length} chars</span>
                <span>Code will be normalized before preview/deploy</span>
              </div>
            </div>

            {importError && (
              <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                {importError}
              </p>
            )}

            <button
              onClick={handleImport}
              disabled={existingCode.trim().length < 40}
              className={cn(
                'w-full py-3 rounded-lg font-semibold text-sm transition',
                existingCode.trim().length < 40
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-primary text-primary-foreground hover:bg-primary/90'
              )}
            >
              Preview Existing Contract
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 sm:gap-6">
      {/* Templates - curated from the official GenLayer ideas catalogue */}
      <div className="lg:col-span-1">
        <p className="text-sm font-semibold mb-1 text-muted-foreground uppercase tracking-wide">
          Templates
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Start from a proven GenLayer pattern, then edit the description.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2 lg:max-h-[60vh] lg:overflow-y-auto lg:pr-1">
          {CONTRACT_TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTemplate(t)}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded border text-sm transition',
                selectedTemplate === t.id
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/40'
              )}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={cn('font-medium', selectedTemplate === t.id && 'text-primary')}>
                  {t.name}
                </span>
                <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0', KIND_BADGE[t.kind].className)}>
                  {KIND_BADGE[t.kind].label}
                </span>
              </span>
              <span className="block text-xs text-muted-foreground mt-0.5">{t.tagline}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main input */}
      <div className="lg:col-span-3 space-y-4">
        <div>
          <label className="block text-sm font-semibold mb-2">
            Describe your contract
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Example: Create a contract that verifies whether a claim is factually accurate. Store the result as YES or NO. Anyone can submit a claim, anyone can read the result."
            className="w-full h-52 sm:h-44 px-4 py-3 border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm"
          />
          <div className="flex flex-wrap justify-between gap-1 text-xs text-muted-foreground mt-1">
            <span>{description.length} chars</span>
            <span>Minimum 20 characters</span>
          </div>
        </div>

        {/* Tips */}
        <div className="bg-muted/50 border border-border rounded-lg px-4 py-3 text-sm space-y-1">
          <p className="font-medium">Tips for better results</p>
          <ul className="text-muted-foreground space-y-0.5 text-xs">
            <li>• Specify inputs and outputs clearly</li>
            <li>• Mention if the contract must judge, verify, or interpret something</li>
            <li>• Describe what state to store on-chain</li>
            <li>• Say who can call each method (anyone, owner only, etc)</li>
          </ul>
        </div>

        <ApiKeyPanel />

        {generationError && (
          <p className="text-sm text-destructive">{generationError}</p>
        )}

        <button
          onClick={handleGenerate}
          disabled={isLoading || description.trim().length < 20}
          className={cn(
            'w-full py-3 rounded-lg font-semibold text-sm transition',
            isLoading || description.trim().length < 20
              ? 'bg-muted text-muted-foreground cursor-not-allowed'
              : 'bg-primary text-primary-foreground hover:bg-primary/90'
          )}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating contract...
            </span>
          ) : (
            'Generate Contract'
          )}
        </button>
      </div>
        </div>
      )}
    </div>
  )
}
