-- Clause Forge — Initial Schema
-- Run via: supabase db push

-- ─── Contract Generations ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contract_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  generation_id VARCHAR(255) UNIQUE NOT NULL,

  description TEXT NOT NULL,
  description_hash VARCHAR(64),
  generated_code TEXT NOT NULL,
  contract_name VARCHAR(255),

  -- Extracted structure (JSONB = document-like storage)
  methods JSONB DEFAULT '[]',
  state_variables JSONB DEFAULT '{}',
  estimation JSONB DEFAULT '{}',

  -- Meta
  model_used VARCHAR(100) DEFAULT 'llama-3.3-70b-versatile',
  status VARCHAR(50) DEFAULT 'generated',
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generations_hash ON contract_generations(description_hash);
CREATE INDEX IF NOT EXISTS idx_generations_created ON contract_generations(created_at DESC);

-- ─── Deployed Contracts ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS deployed_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  transaction_hash VARCHAR(255) UNIQUE NOT NULL,
  contract_address VARCHAR(255) NOT NULL,
  generation_id VARCHAR(255) REFERENCES contract_generations(generation_id),

  network VARCHAR(50) NOT NULL DEFAULT 'studionet',
  mode VARCHAR(50) NOT NULL DEFAULT 'system',
  deployed_by VARCHAR(255),
  status VARCHAR(50) DEFAULT 'finalized',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_deployed_address ON deployed_contracts(contract_address);
CREATE INDEX IF NOT EXISTS idx_deployed_network ON deployed_contracts(network);

-- ─── Contract Marketplace (Phase 4) ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contract_marketplace (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  contract_address VARCHAR(255) NOT NULL,
  network VARCHAR(50) NOT NULL DEFAULT 'studionet',

  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) DEFAULT 'custom',
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],

  creator_wallet VARCHAR(255),

  rating DECIMAL(3,2) DEFAULT 0,
  review_count INT DEFAULT 0,
  forked_count INT DEFAULT 0,
  usage_count INT DEFAULT 0,

  is_public BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_marketplace_category ON contract_marketplace(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_rating ON contract_marketplace(rating DESC);
CREATE INDEX IF NOT EXISTS idx_marketplace_tags ON contract_marketplace USING GIN(tags);

-- ─── Contract Forks (Phase 4) ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contract_forks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  original_address VARCHAR(255) NOT NULL,
  fork_address VARCHAR(255),

  creator_wallet VARCHAR(255),
  modifications TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Contract Interactions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS contract_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  contract_address VARCHAR(255) NOT NULL,
  method_name VARCHAR(255),
  inputs JSONB DEFAULT '{}',
  output JSONB,

  transaction_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'success',
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interactions_address ON contract_interactions(contract_address);

-- ─── Usage Logs ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  action VARCHAR(100) NOT NULL,
  model_used VARCHAR(100),
  tokens_used INT DEFAULT 0,
  cost_usd DECIMAL(10, 8) DEFAULT 0,

  created_at TIMESTAMPTZ DEFAULT NOW()
);
