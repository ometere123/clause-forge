import { useState } from 'react'
import { useContractGeneration } from '@/hooks/useContractGeneration'
import { useContractStore } from '@/store'
import { cn } from '@/lib/utils'
import ApiKeyPanel from '@/components/ApiKeyPanel'
import { createImportedContract } from '@/utils/contractImport'

const TEMPLATES = [
  {
    id: 'kyc',
    name: 'KYC Verification',
    example:
      'Create a contract that takes a person\'s name and ID number. Use AI to verify if the person exists in public records. Store the verification result and timestamp.',
  },
  {
    id: 'scoring',
    name: 'Candidate Scoring',
    example:
      'Create a contract that evaluates a candidate based on their resume text. Score them from 1 to 10 using AI and store the result. Only the owner can reset scores.',
  },
  {
    id: 'voting',
    name: 'Proposal Voting',
    example:
      'Create a contract where users can vote YES or NO on a proposal. Track all votes, prevent double voting, and return the aggregated result.',
  },
  {
    id: 'enrichment',
    name: 'Data Enrichment',
    example:
      'Create a contract that takes a company name, fetches public information about it from the web, and stores a summary of the company profile.',
  },
]

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

  const handleTemplate = (template: typeof TEMPLATES[number]) => {
    setDescription(template.example)
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
              <p>This path skips AI generation and does not use Groq calls.</p>
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
      {/* Templates */}
      <div className="lg:col-span-1">
        <p className="text-sm font-semibold mb-3 text-muted-foreground uppercase tracking-wide">
          Templates
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-1 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              onClick={() => handleTemplate(t)}
              className={cn(
                'w-full text-left px-3 py-2.5 rounded border text-sm transition min-h-12',
                selectedTemplate === t.id
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/40'
              )}
            >
              {t.name}
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
            placeholder="Example: Create a contract that verifies if a claim is factually accurate using AI. Store the result as YES or NO. Anyone can submit a claim, anyone can read the result."
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
            <li>• Mention if AI decision-making is needed</li>
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
