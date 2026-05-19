import { useState } from 'react'
import { useContractGeneration } from '@/hooks/useContractGeneration'
import { useContractStore } from '@/store'
import { cn } from '@/lib/utils'
import ApiKeyPanel from '@/components/ApiKeyPanel'

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

interface DescriptionInputProps {
  onGenerated: () => void
}

export default function DescriptionInput({ onGenerated }: DescriptionInputProps) {
  const [description, setDescription] = useState('')
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null)
  const { generate, isLoading } = useContractGeneration()
  const { generationError } = useContractStore()

  const handleGenerate = async () => {
    if (description.trim().length < 20) return
    const ok = await generate(description)
    if (ok) onGenerated()
  }

  const handleTemplate = (template: typeof TEMPLATES[number]) => {
    setDescription(template.example)
    setSelectedTemplate(template.id)
  }

  return (
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
  )
}
