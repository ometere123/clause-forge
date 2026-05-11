import { useState } from 'react'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  text: string
  className?: string
}

export default function CopyButton({ text, className }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy address'}
      className={cn(
        'inline-flex items-center justify-center w-5 h-5 rounded transition shrink-0',
        copied
          ? 'text-green-500'
          : 'text-muted-foreground hover:text-foreground hover:bg-muted',
        className
      )}
    >
      {copied ? (
        // Checkmark
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="2,6 5,9 10,3" />
        </svg>
      ) : (
        // Two overlapping squares (copy icon)
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <path d="M2 8V2a1 1 0 0 1 1-1h6" />
        </svg>
      )}
    </button>
  )
}
