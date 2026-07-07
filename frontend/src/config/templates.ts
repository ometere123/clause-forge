// Curated contract templates based on the official GenLayer ideas catalogue:
// https://docs.genlayer.com/developers/intelligent-contracts/ideas
// Each prompt is written to generate well: clear inputs/outputs, who can call
// what, what is stored on-chain, and an explicit uncertain/escalation path.

export type TemplateKind = 'ai-judgement' | 'web-aware' | 'deterministic'

export interface ContractTemplate {
  id: string
  name: string
  tagline: string
  kind: TemplateKind
  prompt: string
}

export const CONTRACT_TEMPLATES: ContractTemplate[] = [
  {
    id: 'prediction-market',
    name: 'Prediction Market',
    tagline: 'Bets on real-world outcomes, resolved from web evidence',
    kind: 'web-aware',
    prompt:
      'Create a prediction market contract. The owner creates a market with a question, a resolution source URL, and clear resolution criteria. Anyone can commit a YES or NO position on an open market. After the event, anyone can trigger resolution: the contract fetches the source URL and uses AI to decide YES, NO, or UNDETERMINED strictly from the fetched evidence and criteria. Store the outcome, a short reason, and the evidence URL. Prevent double resolution and positions after close. If evidence is unclear or the source is unavailable, the market becomes UNDETERMINED instead of guessing.',
  },
  {
    id: 'parametric-insurance',
    name: 'Parametric Insurance',
    tagline: 'Payouts triggered by verified real-world events',
    kind: 'web-aware',
    prompt:
      'Create a parametric insurance contract. The owner defines a policy with a trigger condition described in plain text (for example: an earthquake above magnitude 6 in a named region), a data source URL, and a payout amount. A policyholder can register with their wallet address. Anyone can request a payout check: the contract fetches the data source and uses AI to decide TRIGGERED, NOT_TRIGGERED, or UNVERIFIABLE based only on the fetched data and the trigger condition. Store the decision, a short reason, and the check timestamp. A policy can pay out at most once, and UNVERIFIABLE never pays out.',
  },
  {
    id: 'bounty-review',
    name: 'Bounty Review & Payout',
    tagline: 'AI-judged submissions with escrowed rewards',
    kind: 'ai-judgement',
    prompt:
      'Create a bounty contract. The owner creates a bounty with a task description and acceptance criteria, funding it with GEN tokens at creation. Anyone can submit work as a URL plus a short summary, one submission per wallet. The owner triggers judging: AI scores each submission from 0 to 100 against the acceptance criteria with a short reason, marking submissions APPROVED, REJECTED, or NEEDS_REVIEW. The highest approved score wins and can claim the escrowed reward once. Store all submissions, scores, reasons, and the winner. Reject new submissions after judging and prevent double payout.',
  },
  {
    id: 'ai-arbitration',
    name: 'AI Arbitration',
    tagline: 'Two-party dispute resolution with evidence',
    kind: 'ai-judgement',
    prompt:
      'Create a dispute arbitration contract. Two parties open a case by both registering: each submits their claim text and an evidence URL. Once both sides have submitted, either party can request a ruling. AI evaluates both claims and evidence against the agreement description stored at case creation, ruling FOR_PARTY_A, FOR_PARTY_B, SPLIT, or ESCALATED when the evidence is insufficient or contradictory. Store the ruling, a short reason, and confidence band LOW, MEDIUM, or HIGH. Cases are final after ruling; only ESCALATED cases can be re-run once with new evidence.',
  },
  {
    id: 'content-moderation',
    name: 'Fair Moderation',
    tagline: 'Transparent AI rule enforcement for communities',
    kind: 'ai-judgement',
    prompt:
      'Create a content moderation contract. The owner sets the community rules as plain text at deployment. Anyone can submit a piece of content (text) for review. AI checks the content against the rules and marks it ALLOWED, REMOVED, or NEEDS_HUMAN_REVIEW, with a short reason referencing the specific rule involved. Store each verdict with the submitter address and timestamp so all moderation decisions are public and auditable. The owner can update the rules, and rule updates never change past verdicts.',
  },
  {
    id: 'ai-notary',
    name: 'AI Notary',
    tagline: 'Verifiable records of online events',
    kind: 'web-aware',
    prompt:
      'Create a notary contract that confirms online events. Anyone can submit a claim about a public web page (for example: "this article was published with this headline") along with the URL. The contract fetches the page and uses AI to decide whether the page content CONFIRMS, CONTRADICTS, or is UNVERIFIABLE for the claim. Store the claim, URL, verdict, a short quote as evidence, and the transaction timestamp as a permanent notarized record. Records are immutable once created and anyone can look them up by ID.',
  },
  {
    id: 'identity-verification',
    name: 'Social Identity Verification',
    tagline: 'Link social profiles to wallet addresses',
    kind: 'web-aware',
    prompt:
      'Create an identity verification contract. A user registers their social profile URL and the contract gives them a unique verification code to post publicly on that profile. The user then requests verification: the contract fetches the profile URL and uses AI to check that the code appears there and the profile is not obviously fake. Store VERIFIED, FAILED, or UNVERIFIABLE per wallet with the profile URL and check timestamp. A wallet can retry a failed verification, but a VERIFIED link is permanent and one profile can only verify one wallet.',
  },
  {
    id: 'knowledge-base',
    name: 'Crowd-sourced Knowledge',
    tagline: 'Reward verified contributions of information',
    kind: 'ai-judgement',
    prompt:
      'Create a crowd-sourced knowledge contract. Anyone can submit a fact with a title, a summary, and a public source URL. AI validates whether the summary is supported by fetching the source, marking it VALIDATED, REJECTED, or NEEDS_REVIEW with a short reason and a confidence band. Duplicate titles are rejected. Store each entry with its submitter, status, and validation reason. Track a per-wallet score: +10 for each validated entry. Provide views for a single entry, the total entry count, and a wallet score.',
  },
  {
    id: 'escrow',
    name: 'Escrow with AI Disputes',
    tagline: 'Funds released on completion, disputes judged fairly',
    kind: 'ai-judgement',
    prompt:
      'Create an escrow contract for freelance work. A client creates an agreement with a worker address and the job requirements as text, funding it with GEN at creation. The worker submits completed work as a URL with a summary. The client can approve, releasing funds to the worker. If the client disputes instead, AI compares the submitted work against the job requirements and rules RELEASE, REFUND, or SPLIT, with a short reason. Track statuses CREATED, FUNDED, SUBMITTED, DISPUTED, and RESOLVED. Funds can only ever be settled once per agreement.',
  },
  {
    id: 'game-master',
    name: 'Decentralized Game Master',
    tagline: 'Text adventure where AI narrates outcomes',
    kind: 'ai-judgement',
    prompt:
      'Create a text adventure game contract. The owner sets the world description at deployment. Players join with a character name. On their turn a player submits an action in plain text, and AI narrates the outcome in two sentences and updates the player state: health 0-100 and a one-line status. AI must be consistent with the world description and previous state, never granting impossible outcomes. Store each player state plus a short adventure log per player. A player at 0 health is out and their actions are rejected.',
  },
  {
    id: 'dao-treasury',
    name: 'Proposal Voting',
    tagline: 'Simple on-chain voting, no AI needed',
    kind: 'deterministic',
    prompt:
      'Create a proposal voting contract. The owner creates proposals with a title and description. Anyone can vote YES or NO on an open proposal, one vote per wallet per proposal, tracked to prevent double voting. The owner can close a proposal, freezing the tally. Provide views for a proposal with its vote counts, the total number of proposals, and whether a given wallet has voted. This is deterministic — no AI or web access needed.',
  },
  {
    id: 'retro-funding',
    name: 'Retroactive Funding',
    tagline: 'Reward past contributions after AI evaluation',
    kind: 'ai-judgement',
    prompt:
      'Create a retroactive public goods funding contract. The owner funds a reward round with GEN and sets the contribution criteria as text. Anyone can nominate a contribution with a description and a public evidence URL (repo, article, or deployment), one nomination per wallet per round. When the owner closes the round, AI scores each nomination 0-100 against the criteria using the evidence, with a short reason; nominations scoring under 50 or with unreachable evidence get 0. The round budget is split proportionally to scores and each nominee can claim their share once.',
  },
]
