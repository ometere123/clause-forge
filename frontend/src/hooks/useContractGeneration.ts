import { useMutation } from '@tanstack/react-query'
import { generateContract } from '@/services/api'
import { useContractStore } from '@/store'
import type { GenerateRequest } from '@/types'

export const useContractGeneration = () => {
  const {
    setGeneratedContract,
    setIsGenerating,
    setGenerationError,
    setDescription,
  } = useContractStore()

  const mutation = useMutation({
    mutationFn: (payload: GenerateRequest) => generateContract(payload),
    onMutate: () => {
      setIsGenerating(true)
      setGenerationError(null)
    },
    onSuccess: (data) => {
      setGeneratedContract(data)
      setIsGenerating(false)
    },
    onError: (error: Error) => {
      setGenerationError(error.message)
      setIsGenerating(false)
    },
  })

  const generate = (description: string): Promise<boolean> => {
    setDescription(description)
    return new Promise((resolve) => {
      mutation.mutate(
        { description, model: 'groq' },
        {
          onSuccess: () => resolve(true),
          onError: () => resolve(false),
        }
      )
    })
  }

  return {
    generate,
    isLoading: mutation.isPending,
    error: mutation.error,
    reset: mutation.reset,
  }
}
