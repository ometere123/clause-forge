-- Track which GenLayer network a marketplace contract belongs to.

ALTER TABLE IF EXISTS marketplace_listings
  ADD COLUMN IF NOT EXISTS network VARCHAR(50) NOT NULL DEFAULT 'studionet';

CREATE INDEX IF NOT EXISTS idx_marketplace_listings_network
  ON marketplace_listings(network);

ALTER TABLE IF EXISTS contract_marketplace
  ADD COLUMN IF NOT EXISTS network VARCHAR(50) NOT NULL DEFAULT 'studionet';
