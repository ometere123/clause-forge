import { useState } from 'react'
import DescriptionInput from '@/components/DescriptionInput'
import CodePreview from '@/components/CodePreview'
import DeployPanel from '@/components/DeployPanel'
import ContractSimulator from '@/components/ContractSimulator'
import { useContractStore } from '@/store'
import { cn } from '@/lib/utils'
import type { Network } from '@/types'

type EditorStep = 'describe' | 'preview' | 'deploy' | 'simulate'

const STEPS: { id: EditorStep; label: string }[] = [
  { id: 'describe', label: 'Describe' },
  { id: 'preview', label: 'Preview' },
  { id: 'deploy', label: 'Deploy' },
  { id: 'simulate', label: 'Simulate' },
]

export default function Editor() {
  const [step, setStep] = useState<EditorStep>('describe')
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null)
  const [deployedNetwork, setDeployedNetwork] = useState<Network>('studionet')
  const { generatedContract } = useContractStore()

  const clearCurrentDeployment = () => {
    setDeployedAddress(null)
    setDeployedNetwork('studionet')
  }

  const canNavigate = (s: EditorStep) => {
    if (s === 'describe') return true
    if (!generatedContract) return false
    if (s === 'simulate' && !deployedAddress) return false
    return true
  }

  return (
    <div className="max-w-7xl mx-auto px-3 sm:px-4 py-5 sm:py-8">
      {/* Step Indicator */}
      <div className="-mx-3 sm:mx-0 px-3 sm:px-0 overflow-x-auto pb-2 mb-6 sm:mb-10">
        <div className="flex items-center gap-2 min-w-max">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              onClick={() => canNavigate(s.id) && setStep(s.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-1.5 rounded text-sm font-medium transition whitespace-nowrap',
                step === s.id
                  ? 'bg-primary text-primary-foreground'
                  : canNavigate(s.id)
                  ? 'text-muted-foreground hover:text-foreground'
                  : 'text-muted-foreground/40 cursor-not-allowed'
              )}
            >
              <span className={cn(
                'w-5 h-5 rounded-full border flex items-center justify-center text-xs',
                step === s.id ? 'border-primary-foreground' : 'border-current'
              )}>
                {i + 1}
              </span>
              <span className="capitalize">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && <div className="w-5 sm:w-8 h-px bg-border" />}
          </div>
        ))}
        </div>
      </div>

      {/* Step Content */}
      {step === 'describe' && (
        <DescriptionInput
          onGenerated={() => {
            clearCurrentDeployment()
            setStep('preview')
          }}
        />
      )}

      {step === 'preview' && generatedContract && (
        <CodePreview
          onCodeChanged={clearCurrentDeployment}
          onDeploy={() => setStep('deploy')}
        />
      )}

      {step === 'deploy' && generatedContract && (
        <DeployPanel
          onDeployed={(address, network) => {
            setDeployedAddress(address)
            setDeployedNetwork(network)
            setStep('simulate')
          }}
        />
      )}

      {step === 'simulate' && generatedContract && deployedAddress && (
        <ContractSimulator
          contractAddress={deployedAddress}
          network={deployedNetwork}
        />
      )}
    </div>
  )
}
