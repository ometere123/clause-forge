import { cn } from '@/lib/utils'
import type { FrontendCallMapItem } from '@/types'

interface FrontendCallMapPanelProps {
  items?: FrontendCallMapItem[]
  title?: string
}

const typeLabel: Record<FrontendCallMapItem['type'], string> = {
  view: 'view',
  write: 'write',
  payable: 'payable',
}

export default function FrontendCallMapPanel({
  items,
  title = 'Frontend Call Map',
}: FrontendCallMapPanelProps) {
  if (!items?.length) return null

  return (
    <div className="border border-border rounded-lg p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </p>
      </div>

      <div className="space-y-3">
        {items.map((item) => (
          <div key={`${item.method}-${item.type}`} className="border border-border rounded p-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm font-semibold text-primary">
                {item.method}()
              </span>
              <span
                className={cn(
                  'shrink-0 text-xs px-2 py-0.5 rounded-full font-medium',
                  item.type === 'view' && 'bg-green-50 text-green-700',
                  item.type === 'write' && 'bg-red-50 text-red-700',
                  item.type === 'payable' && 'bg-amber-50 text-amber-700'
                )}
              >
                {typeLabel[item.type]}
              </span>
            </div>

            <div className="text-xs text-muted-foreground space-y-1">
              <p>
                <span className="font-medium text-foreground">Args:</span>{' '}
                {item.args.length ? item.args.join(', ') : 'none'}
              </p>
              {item.valueRequired && (
                <p>
                  <span className="font-medium text-foreground">Value:</span> required
                </p>
              )}
              <p>{item.display}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
