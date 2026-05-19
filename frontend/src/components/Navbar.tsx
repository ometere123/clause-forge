import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Menu, Plus, Wallet, X } from 'lucide-react'
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

const short = (address: string) => `${address.slice(0, 8)}...${address.slice(-6)}`

export default function Navbar() {
  const { pathname } = useLocation()
  const {
    wallets,
    activeWalletIndex,
    shortAddress,
    activeWalletType,
    activeWalletLabel,
    externalWallet,
    switchWallet,
    createWallet,
    selectExternalWallet,
    disconnectExternalWallet,
  } = useWallet()
  const [open, setOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)
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

  useEffect(() => {
    setMobileNavOpen(false)
    setOpen(false)
  }, [pathname])

  const handleSelectExternal = async () => {
    setWalletError(null)
    try {
      await selectExternalWallet()
      setOpen(false)
    } catch (err: any) {
      setWalletError(err?.message ?? 'Could not connect external wallet')
    }
  }

  const handleCreateWallet = () => {
    createWallet()
    setWalletError(null)
    setOpen(false)
  }

  const handleDisconnectExternal = () => {
    disconnectExternalWallet()
    setWalletError(null)
  }

  return (
    <nav className="border-b border-border bg-background/95 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-3">

        <Link to="/" className="flex items-center gap-2">
          <img src="/clause-forge-logo.png" alt="Clause Forge" className="h-11 sm:h-14 w-auto" />
          <span className="hidden sm:inline font-bold text-lg tracking-tight whitespace-nowrap text-primary">Clause Forge</span>
        </Link>

        <div className="hidden md:flex items-center gap-6">
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

        <div className="flex items-center gap-2" ref={dropdownRef}>
          <div className="relative">
            <button
              onClick={() => setOpen((p) => !p)}
              className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono bg-muted px-2.5 sm:px-3 py-1.5 rounded-full hover:bg-muted/80 transition max-w-[44vw] sm:max-w-none"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
              <span className="font-sans text-muted-foreground hidden sm:inline">
                {activeWalletType === 'external'
                  ? 'External'
                  : wallets.length > 1
                    ? `#${activeWalletIndex + 1}`
                    : 'Wallet'}
              </span>
              <span className="truncate">{shortAddress ?? 'Loading...'}</span>
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-80 sm:w-80 bg-background border border-border rounded-lg shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-semibold">{activeWalletLabel}</p>
                  <p className="text-[11px] text-muted-foreground">One active deployer at a time</p>
                </div>

                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-2">
                  Browser Accounts
                </p>

                {wallets.map((w, i) => {
                  const isActive = activeWalletType === 'browser' && i === activeWalletIndex

                  return (
                    <div
                      key={w.address}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 hover:bg-muted transition',
                        isActive && 'bg-primary/5 text-primary'
                      )}
                    >
                      <button
                        onClick={() => { switchWallet(i); setWalletError(null); setOpen(false) }}
                        className="min-w-0 flex-1 text-left text-xs font-mono flex items-center gap-2"
                      >
                        <span className={cn(
                          'w-1.5 h-1.5 rounded-full shrink-0',
                          isActive ? 'bg-green-500' : 'bg-muted-foreground/30'
                        )} />
                        <span className="truncate">#{i + 1} - {short(w.address)}</span>
                      </button>
                      {isActive && (
                        <span className="text-[10px] text-green-600 font-sans font-medium">active</span>
                      )}
                      <CopyButton text={w.address} />
                    </div>
                  )
                })}

                <button
                  onClick={handleCreateWallet}
                  className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 text-primary hover:bg-muted transition border-t border-border"
                >
                  <Plus className="w-4 h-4" />
                  New account
                </button>

                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 py-2 border-t border-border">
                  External Wallet
                </p>

                {externalWallet ? (
                  <div
                    className={cn(
                      'flex items-center gap-2 px-3 py-2 hover:bg-muted transition',
                      activeWalletType === 'external' && 'bg-primary/5 text-primary'
                    )}
                  >
                    <button
                      onClick={handleSelectExternal}
                      className="min-w-0 flex-1 text-left text-xs font-mono flex items-center gap-2"
                    >
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full shrink-0',
                        activeWalletType === 'external' ? 'bg-green-500' : 'bg-muted-foreground/30'
                      )} />
                      <span className="truncate">{short(externalWallet.address)}</span>
                    </button>
                    {activeWalletType === 'external' && (
                      <span className="text-[10px] text-green-600 font-sans font-medium">active</span>
                    )}
                    <CopyButton text={externalWallet.address} />
                    <button
                      onClick={handleDisconnectExternal}
                      className="text-[10px] font-sans text-muted-foreground hover:text-destructive"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleSelectExternal}
                    className="w-full text-left px-3 py-2 text-xs flex items-center gap-2 hover:bg-muted transition"
                  >
                    <Wallet className="w-4 h-4 text-muted-foreground" />
                    Connect Wallet
                  </button>
                )}

                {walletError && (
                  <p className="mx-3 my-2 text-xs text-destructive bg-destructive/10 border border-destructive/20 rounded px-2 py-1.5">
                    {walletError}
                  </p>
                )}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => setMobileNavOpen((p) => !p)}
            className="md:hidden inline-flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-accent transition"
            aria-label="Toggle navigation"
          >
            {mobileNavOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

      </div>

      {mobileNavOpen && (
        <div className="md:hidden border-t border-border bg-background px-3 py-2">
          <div className="grid grid-cols-2 gap-2">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={cn(
                  'rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  pathname === link.to
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>
      )}
    </nav>
  )
}
