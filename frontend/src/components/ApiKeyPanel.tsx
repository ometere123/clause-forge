import { useState } from 'react'
import { getStoredGroqApiKey, setStoredGroqApiKey } from '@/utils/apiKey'

export default function ApiKeyPanel() {
  const [value, setValue] = useState(getStoredGroqApiKey())
  const [saved, setSaved] = useState(false)

  const handleSave = () => {
    setStoredGroqApiKey(value)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  const handleClear = () => {
    setValue('')
    setStoredGroqApiKey('')
    setSaved(true)
    window.setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold">AI Access</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Free tier includes 7 Groq calls per day. Add your Groq key for unlimited calls.
          </p>
        </div>
        {saved && <span className="text-xs text-green-600 font-medium">Saved</span>}
      </div>
      <div className="grid grid-cols-2 sm:flex gap-2">
        <input
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="gsk_..."
          className="col-span-2 sm:col-span-1 sm:flex-1 px-3 py-2 border border-border rounded text-sm focus:outline-none focus:ring-2 focus:ring-ring bg-background"
        />
        <button
          onClick={handleSave}
          className="px-4 py-2 bg-primary text-primary-foreground rounded text-sm font-medium hover:bg-primary/90 transition"
        >
          Save
        </button>
        <button
          onClick={handleClear}
          className="px-4 py-2 border border-border rounded text-sm font-medium hover:bg-accent transition"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
