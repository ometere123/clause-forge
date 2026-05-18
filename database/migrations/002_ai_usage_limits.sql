-- Clause Forge AI usage limits
-- Tracks free-tier AI calls. User-provided API keys bypass this quota.

CREATE TABLE IF NOT EXISTS ai_usage_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_key VARCHAR(64) NOT NULL,
  usage_date DATE NOT NULL,
  call_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE (client_key, usage_date)
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_limits_client_date
  ON ai_usage_limits(client_key, usage_date);
