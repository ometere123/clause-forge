-- Clause Forge — Seed Data
-- Sample marketplace listings for development/testing

INSERT INTO contract_marketplace (
  contract_address, network, name, description, category, tags,
  creator_wallet, rating, review_count, forked_count, is_featured
) VALUES
(
  '0xabc1230000000000000000000000000000000001',
  'studionet',
  'KYC Verifier',
  'Verifies a person''s identity by checking their name and ID against public records using AI.',
  'verification',
  ARRAY['kyc', 'identity', 'ai', 'verification'],
  '0xdemo0000000000000000000000000000000001',
  4.5, 12, 8, TRUE
),
(
  '0xabc1230000000000000000000000000000000002',
  'studionet',
  'Candidate Scorer',
  'Evaluates job candidates based on resume text and scores them 1-10 using AI.',
  'scoring',
  ARRAY['hr', 'scoring', 'ai', 'candidates'],
  '0xdemo0000000000000000000000000000000002',
  4.2, 7, 3, FALSE
),
(
  '0xabc1230000000000000000000000000000000003',
  'studionet',
  'Proposal Voting',
  'Simple YES/NO voting on proposals. Prevents double voting and returns aggregated results.',
  'voting',
  ARRAY['governance', 'voting', 'dao'],
  '0xdemo0000000000000000000000000000000003',
  4.8, 20, 15, TRUE
);
