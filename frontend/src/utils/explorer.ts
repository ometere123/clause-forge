const STUDIONET_EXPLORER_BASE_URL = 'https://explorer-studio.genlayer.com'

export const getStudionetAddressUrl = (address: string) =>
  `${STUDIONET_EXPLORER_BASE_URL}/transactions?address=${encodeURIComponent(address)}`
