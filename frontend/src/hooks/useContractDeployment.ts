import { useMutation } from '@tanstack/react-query'
import { deployContract } from '@/services/api'
import { useContractStore } from '@/store'
import type { DeployRequest, DeploymentMode } from '@/types'

export const useContractDeployment = () => {
  const {
    setIsDeploying,
    setDeploymentStatus,
    setDeploymentResult,
    addToHistory,
    wallet,
  } = useContractStore()

  const mutation = useMutation({
    mutationFn: (payload: DeployRequest) => deployContract(payload),
    onMutate: () => {
      setIsDeploying(true)
      setDeploymentStatus('pending')
    },
    onSuccess: (data) => {
      setDeploymentResult(data)
      setDeploymentStatus('finalized')
      addToHistory(data)
      setIsDeploying(false)
    },
    onError: () => {
      setDeploymentStatus('failed')
      setIsDeploying(false)
    },
  })

  const deploy = (
    generationId: string,
    code: string,
    mode: DeploymentMode
  ) => {
    const payload: DeployRequest = {
      generationId,
      code,
      mode,
      network: 'studionet',
      ...(mode === 'wallet' && wallet?.privateKey
        ? { walletPrivateKey: wallet.privateKey }
        : {}),
    }
    mutation.mutate(payload)
  }

  return {
    deploy,
    isDeploying: mutation.isPending,
    error: mutation.error,
  }
}
