<p align="center">
  <img src="clause-forge-logo.png" alt="Clause Forge" width="180" />
</p>

# CLAUSE FORGE - No-Code GenLayer Intelligent Contract Builder

**Describe a contract in plain English. Get a deployable GenLayer Intelligent Contract in Python.**
A non-developer types what they want in ordinary language. Clause Forge designs the missing technical detail, generates schema-safe GenVM code, validates it, auto-repairs it if the first draft is broken, and lets the user deploy it themselves with their own wallet.

[Live app - clause-forge-iota.vercel.app](https://clause-forge-iota.vercel.app)

---

## What it is

Clause Forge turns a casual, non-technical description into a real GenLayer Intelligent Contract - the actors, the full lifecycle, storage fields, access control, and the "unsure/escalate" path are all inferred by the generator, not left for the user to specify. The user never touches Python unless they want to.

- **Casual-input generation** - the generator treats every description as incomplete and designs the rest: statuses, duplicate protection, transitions, escalation paths, and the getters a frontend needs
- **Self-healing pipeline** - every generated contract is statically validated immediately; if it has critical errors, one automatic repair pass runs before the user ever sees the code
- **Plain-English summary** - a deterministic, non-AI explainer translates the generated contract back into plain language so a non-developer can verify it matches their intent without reading Python
- **External-wallet-only deployment** - deploys and writes are signed entirely in the user's own wallet (MetaMask, Rabby); Clause Forge never generates, stores, or transmits private keys
- **Debug workspace** - paste a broken GenLayer contract and its error/traceback; get a diagnosis, issue category, and a complete corrected contract, with a refix loop for follow-up errors
- **Templates from the official GenLayer ideas catalogue** - prediction markets, arbitration, escrow, bounty review, moderation, and more, pre-written to generate well
- **Marketplace** - browse, search, and submit deployed contracts by category

---

## How it works

**For a non-developer building a contract**

1. Describe the contract idea in plain English, or pick a template
2. Clause Forge designs the full specification and generates the Python contract
3. If static validation finds critical issues, Clause Forge auto-repairs the contract before showing it
4. Read the plain-English summary to confirm it does what you meant
5. Preview, edit, copy, or download the generated code
6. Connect your wallet and deploy to Studionet, Asimov, or Bradbury
7. Interact with the deployed contract's view/write methods directly
8. Optionally submit the contract to the marketplace

**For fixing a broken contract**

1. Paste the existing contract code
2. Paste the GenVM error, traceback, or schema error
3. Optionally add the intended behavior
4. Get a diagnosis, issue category, and a complete fixed contract
5. Refix again if the fix reveals a new error

---

## Why we built it

GenLayer Intelligent Contracts are Python, but writing one correctly requires knowing:

- GenVM storage rules (`TreeMap`/`DynArray`, no bare `dict`/`list`, no float storage)
- The exact ABI boundary - `int`/`str`/`bool` in public methods, typed integers only after casting
- Non-deterministic blocks - what must run inside `gl.nondet.*` / `run_nondet_unsafe` vs. outside
- The Equivalence Principle - `strict_eq`, `prompt_comparative`, `prompt_non_comparative`, or a custom `validator_fn`
- Deterministic transaction time, deployment headers, schema-safe return types

Clause Forge encodes all of this into the generator, the validator, and the debugger, so a non-developer's plain-English intent turns into a contract that actually deploys - not one that looks right and crashes on GenVM.

---

## Generation quality safeguards

The generator and validator are tuned against real GenVM failure modes, not just "looks like Python":

| Check | Why it matters |
| --- | --- |
| No `self.x = TreeMap[K, V]` or `TreeMap[K, V]()` in `__init__` | Storage collections must only be declared in the class body; GenVM auto-initializes them - both forms crash at deploy |
| No typed integers (`u64`, `u256`, ...) in public method parameters | JSON has no `u64`; the SDK/Studio send plain values and GenVM does not auto-cast |
| `gl.nondet.*` calls must sit behind an equivalence guard | A bare `gl.nondet.exec_prompt`/`web.get` outside `strict_eq`/`prompt_comparative`/`run_nondet_unsafe` cannot reach validator consensus |
| No raw `gl.vm.Return(...)` construction | `gl.vm.Return` is a received type only; `validator_fn` must check `isinstance(leaders_res, gl.vm.Return)`, validate `.calldata`, and return `True`/`False` |
| `exec_prompt` never called with a dict | The prompt argument must be a single string, not a Python object |
| `import json` present whenever `json.dumps`/`json.loads` is used | Missing import crashes at execution, not at generation time |
| Deterministic transaction time is allowed | `datetime.now(timezone.utc)` and `time.time()` are pinned to the transaction timestamp on GenVM and are safe to use - the validator does not flag them |

Every critical finding from the validator feeds directly into the self-heal pass: generate -> validate -> repair -> re-validate, before the result ever reaches the UI.

---

## Networks

| Network | Status | Notes |
| --- | --- | --- |
| Studionet | Live | Hosted dev network, built-in faucet |
| Asimov | Live | Testnet for infrastructure/stress testing |
| Bradbury | Live | Production-like testnet, real AI/LLM workloads |
| Clarke | Coming soon | Shown as disabled in the deploy panel |

---

## Wallets

Clause Forge holds no private keys, ever.

- **Deploys and write calls** are signed entirely in the user's own browser wallet (MetaMask, Rabby, or any injected EIP-1193 provider)
- **Reads** use a keyless client - no signing required
- The backend has a record-only endpoint (`/api/v1/contracts/deployments`) that indexes a completed deployment's address, transaction hash, and network **after** it succeeds on-chain - it never receives or requests a key

---

## Tech stack

| Layer | Tech |
| --- | --- |
| Frontend | React 18 - Vite - TypeScript - Tailwind CSS - Zustand - React Query - React Router - Monaco Editor |
| Web3 | GenLayerJS SDK (`genlayer-js`) - injected wallet signing |
| Backend | Cloudflare Workers - Hono - TypeScript - Zod |
| AI | OpenAI (system default) - Groq (bring-your-own-key / fallback) |
| Storage | Supabase - contract generations, deployed contract index, marketplace listings, AI usage quota |

---

## Repository

```
clause-forge/
  frontend/
    src/
      components/     DescriptionInput, CodePreview, DeployPanel, ContractSimulator,
                       PlainSummaryPanel, ContractGenerationReportPanel, Navbar, ...
      config/          networks.ts, templates.ts
      hooks/           useWallet, useTheme, useContractGeneration, useContractDeployment
      pages/           Home, Editor, DebugWorkspace, ContractDetail, Marketplace
      services/        api.ts, genLayerClient.ts (wallet + read client)
      store/           Zustand store
  backend/
    src/
      api/            contracts.ts, marketplace.ts, middleware.ts (Hono routes)
      services/       contractGenerator, contractValidator, contractDebugger,
                       contractSummary, contractReport, genlayerKnowledge (prompt engine),
                       aiProvider (OpenAI/Groq switch)
      config/         env access (Workers + local dev)
      db/             Supabase client
      worker.ts       Hono app entry point
  wrangler.jsonc      Cloudflare Worker config
  vercel.json         Vercel frontend deploy config
  database/
    migrations/
    seed.sql
```

---

## API overview

Backend API base: `/api/v1`

```
GET  /api/v1/health
POST /api/v1/contracts/generate
POST /api/v1/contracts/debug
POST /api/v1/contracts/validate
POST /api/v1/contracts/deployments      (record-only, post-deploy indexing)
GET  /api/v1/contracts/source/:address
GET  /api/v1/contracts/address/:address
GET  /api/v1/marketplace
GET  /api/v1/marketplace/:address
POST /api/v1/marketplace/submit
```

---

## Deployment

| Piece | Platform |
| --- | --- |
| Frontend | Vercel |
| Backend API | Cloudflare Workers (Hono) |
| Database | Supabase |

Frontend and backend are deployed separately and talk to each other over CORS - the frontend's `VITE_API_URL` points at the Worker's URL.

### Deploy the backend (Cloudflare Worker)

```bash
npx wrangler login
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_SERVICE_KEY
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put GROQ_API_KEY   # optional - BYOK / fallback path
npx wrangler deploy
```

### Deploy the frontend (Vercel)

```bash
npx vercel deploy --prod
```

Set `VITE_API_URL` in the Vercel project to the deployed Worker's URL (e.g. `https://clause-forge-api.<subdomain>.workers.dev/api`).

---

## Local development

Install dependencies from the repo root:

```bash
npm install
```

Run frontend and Worker together:

```bash
npm run dev
```

Run just the frontend (proxies `/api` to `localhost:8787`):

```bash
npm run dev:frontend
```

Run just the Worker locally:

```bash
npm run dev:worker
```

Typecheck backend + build frontend:

```bash
npm run typecheck
```

## Environment variables

### Backend (Cloudflare Worker secrets/vars)

```
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1        # optional, this is the default
GROQ_API_KEY=                # optional - BYOK / fallback path
FRONTEND_URL=                # optional - your Vercel origin, for CORS
ALLOWED_ORIGINS=             # optional - comma-separated extra CORS origins
STUDIONET_RPC=https://studio.genlayer.com/api
```

For local development, put the same values in a `.dev.vars` file at the repo root (gitignored).

### Frontend

```
VITE_API_URL=http://localhost:8787/api   # local dev
```

In production, `VITE_API_URL` points at the deployed Worker.

---

## Database

Supabase stores:

- Contract generations
- Deployed contract index (address, tx hash, network, deployer - written after a successful wallet-signed deploy)
- Marketplace listings
- AI usage quota (3 free calls/day per client, bypassed with a bring-your-own Groq key)

Migration files live in `database/migrations/`.

---

## Known limitations

- Static validation catches structural GenVM bugs but cannot fully replace deploying to a live network - some contracts may still need manual review, especially complex escrow, payment, or multi-actor consensus contracts
- Bradbury and Asimov deployment should be tested with funded wallets before being treated as the primary path
- Marketplace fork/compose workflows are not yet built

## Roadmap

- GenVM linter integration for deeper preflight checks before deployment
- More production testing across wallet providers and network-switch edge cases
- Fork and compose workflows for marketplace contracts
- Contract versioning

---

## Disclaimer

Clause Forge generates Intelligent Contract code from natural-language descriptions. Review generated code before deploying it with real value, especially contracts involving payments, escrow, or token custody.
