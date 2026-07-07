import { Link, useLocation } from 'react-router-dom'
import { ChevronDown, Menu, Wallet, X } from 'lucide-react'
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
  const {
    wallet,
    shortAddress,
    isConnected,
    hasInjectedProvider,
    connectWallet,
    disconnectWallet,
  } = useWallet()
  const [open, setOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [walletError, setWalletError] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
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

  const handleConnect = async () => {
    setWalletError(null)
    setIsConnecting(true)
    try {
      await connectWallet()
      setOpen(false)
    } catch (err: any) {
      setWalletError(err?.message ?? 'Could not connect wallet')
    } finally {
      setIsConnecting(false)
    }
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
            {isConnected ? (
              <button
                onClick={() => setOpen((p) => !p)}
                className="flex items-center gap-1.5 sm:gap-2 text-xs font-mono bg-muted px-2.5 sm:px-3 py-1.5 rounded-full hover:bg-muted/80 transition max-w-[44vw] sm:max-w-none"
              >
                <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                <span className="truncate">{shortAddress}</span>
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              </button>
            ) : (
              <button
                onClick={handleConnect}
                disabled={isConnecting}
                className="flex items-center gap-1.5 sm:gap-2 text-xs font-medium bg-primary text-primary-foreground px-3 py-1.5 rounded-full hover:bg-primary/90 transition disabled:opacity-60"
              >
                <Wallet className="w-3.5 h-3.5" />
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}

            {open && isConnected && wallet && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] max-w-72 sm:w-72 bg-background border border-border rounded-lg shadow-lg py-1 z-50">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-xs font-semibold">Connected Wallet</p>
                  <p className="text-[11px] text-muted-foreground">
                    Your wallet signs every deploy and write — Clause Forge never sees your keys.
                  </p>
                </div>
                <div className="flex items-center gap-2 px-3 py-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                  <span className="min-w-0 flex-1 text-xs font-mono truncate">{wallet.address}</span>
                  <CopyButton text={wallet.address} />
                </div>
                <button
                  onClick={() => { disconnectWallet(); setOpen(false) }}
                  className="w-full text-left px-3 py-2 text-xs text-muted-foreground hover:text-destructive hover:bg-muted transition border-t border-border"
                >
                  Disconnect
                </button>
              </div>
            )}

            {walletError && !open && (
              <p className="absolute right-0 mt-2 w-64 text-xs text-destructive bg-background border border-destructive/30 rounded px-2 py-1.5 shadow-lg z-50">
                {walletError}
                {!hasInjectedProvider && (
                  <span className="block mt-1 text-muted-foreground">
                    Install MetaMask or Rabby, then reload this page.
                  </span>
                )}
              </p>
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
