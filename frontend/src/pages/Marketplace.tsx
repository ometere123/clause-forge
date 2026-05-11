import { useQuery } from '@tanstack/react-query'
import { getMarketplaceListings } from '@/services/api'
import { Link, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import type { ContractCategory } from '@/types'

const CATEGORIES: { id: ContractCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'verification', label: 'Verification' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'voting', label: 'Voting' },
  { id: 'data-enrichment', label: 'Data Enrichment' },
  { id: 'custom', label: 'Custom' },
]

export default function Marketplace() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<ContractCategory | 'all'>('all')
  const [lookupAddress, setLookupAddress] = useState('')
  const navigate = useNavigate()

  const handleLookup = () => {
    const addr = lookupAddress.trim()
    if (addr) navigate(`/contract/${addr}`)
  }

  const { data: listings, isLoading, isError } = useQuery({
    queryKey: ['marketplace', search, category],
    queryFn: () =>
      getMarketplaceListings({
        search: search || undefined,
        category: category === 'all' ? undefined : category,
      }),
  })

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Contract Marketplace</h1>
        <p className="text-muted-foreground">
          Browse, fork, and compose Intelligent Contracts built by the community.
        </p>
      </div>

      {/* Address lookup */}
      <div className="bg-muted/40 border border-border rounded-lg px-4 py-3 mb-8">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Inspect any contract
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="0x..."
            value={lookupAddress}
            onChange={(e) => setLookupAddress(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
            className="flex-1 px-3 py-1.5 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-ring font-mono text-sm bg-background"
          />
          <button
            onClick={handleLookup}
            disabled={!lookupAddress.trim()}
            className="px-4 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition disabled:opacity-40"
          >
            Inspect →
          </button>
        </div>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search marketplace..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {/* Categories */}
      <div className="flex gap-2 flex-wrap mb-8">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium border transition ${
              category === cat.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'border-border hover:border-primary/50'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Listings */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : isError ? (
        <div className="text-center py-20 text-muted-foreground">
          <p className="mb-1 font-medium text-destructive">Could not load marketplace listings.</p>
          <p className="text-sm">Make sure the backend is running.</p>
        </div>
      ) : !listings?.length ? (
        <div className="text-center py-20 text-muted-foreground">
          No contracts found. Be the first to submit one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings?.map((listing) => (
            <Link
              key={listing.id}
              to={`/contract/${listing.contractAddress}`}
              className="border border-border rounded-lg p-5 hover:shadow-md hover:border-primary/40 transition block"
            >
              <div className="flex justify-between items-start mb-3">
                <h3 className="font-semibold">{listing.name}</h3>
                <span className="text-xs px-2 py-0.5 bg-accent rounded-full text-accent-foreground">
                  {listing.category}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {listing.description}
              </p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex gap-4">
                  <span>⭐ {listing.rating.toFixed(1)}</span>
                  <span>🔄 {listing.forkedCount} forks</span>
                </div>
                <span className="text-primary font-medium">Interact →</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
