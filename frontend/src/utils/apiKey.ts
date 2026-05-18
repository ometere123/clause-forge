export const GROQ_API_KEY_STORAGE = 'clause-forge-groq-api-key'

export const getStoredGroqApiKey = () => {
  if (typeof window === 'undefined') return ''
  return localStorage.getItem(GROQ_API_KEY_STORAGE) ?? ''
}

export const setStoredGroqApiKey = (apiKey: string) => {
  if (typeof window === 'undefined') return

  const value = apiKey.trim()
  if (value) {
    localStorage.setItem(GROQ_API_KEY_STORAGE, value)
  } else {
    localStorage.removeItem(GROQ_API_KEY_STORAGE)
  }
}

export const getGroqApiHeaders = () => {
  const apiKey = getStoredGroqApiKey()
  return apiKey ? { 'x-groq-api-key': apiKey } : undefined
}
