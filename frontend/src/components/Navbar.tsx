import { Link, useLocation } from 'react-router-dom'
import { useWallet } from '@/hooks/useWallet'
import { cn } from '@/lib/utils'
import { useState, useRef, useEffect } from 'react'
import CopyButton from '@/components/CopyButton'

const navLinks = [
  { to: '/', label: 'Home' },
  { to: '/editor', label: 'Create' },
  { to: '/debug', label: 'Debug' },
  { to: '/marketplace', label: 'Marketplace' },
]

export default function Navbar() {
  const { pathname } = useLocation()
  const { wallets, activeWalletIndex, shortAddress, switchWallet, createWallet } = useWallet()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

        <Link to="/" className="flex items-center gap-2">
          <img src="/clause-forge-logo.png" alt="Clause Forge" className="h-14 w-auto" />
          <span className="font-bold text-lg tracking-tight whitespace-nowrap text-primary">Clause Forge</span>
        </Link>

        <div className="flex items-center gap-6">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className={cn(
                'text-sm font-medium transition-colors hover:text-primary',
                pathname === link.to ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Browser wallet switcher */}
        <div className="flex items-center gap-2" ref={dropdownRef}>
          <div className="relative">
            <button
              onClick={() => setOpen((p) => !p)}
              className="flex items-center gap-2 text-xs font-mono bg-muted px-3 py-1.5 rounded-full hover:bg-muted/80 transition"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <span>
                {wallets.length > 1 && (
                  <span className="text-muted-foreground mr-1">#{activeWalletIndex + 1}</span>
                )}
                {shortAddress ?? 'Loading...'}
              </span>
              <svg className="w-3 h-3 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-64 bg-background border border-border rounded-lg shadow-lg py-1 z-50">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-1.5">
                  Browser Wallets
                </p>

                {wallets.map((w, i) => (
                  <button
                    key={w.address}
                    onClick={() => { switchWallet(i); setOpen(false) }}
                    className={cn(
                      'w-full text-left px-3 py-2 text-xs font-mono flex items-center gap-2 hover:bg-muted transition',
                      i === activeWalletIndex && 'bg-primary/5 text-primary'
                    )}
                  >
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full shrink-0',
                      i === activeWalletIndex ? 'bg-green-500' : 'bg-muted-foreground/30'
                    )} />
                    <span className="truncate">#{i + 1} · {w.address.slice(0, 8)}...{w.address.slice(-6)}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      {i === activeWalletIndex && (
                        <span className="text-[10px] text-green-600 font-sans font-medium">active</span>
                      )}
                      <CopyButton text={w.address} />
                    </span>
                  </button>
                ))}

                <div className="border-t border-border mt-1 pt-1">
                  <button
                    onClick={() => { createWallet(); setOpen(false) }}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-primary hover:bg-muted transition"
                  >
                    <span className="text-base leading-none">+</span>
                    Generate new wallet
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </nav>
  )
}
