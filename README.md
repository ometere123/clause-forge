# Clause Forge

Clause Forge is a no-code builder for GenLayer Intelligent Contracts.

Describe what you want your contract to do, and Clause Forge generates, validates, previews, deploys, and lets you interact with a GenLayer Python contract.

V1 focuses on the complete Studionet workflow:

- Plain-English contract generation
- GenLayer Python code preview and editing
- Static validation
- Studionet deployment
- Contract method simulation/interactions
- Marketplace submission and discovery

V2 will expand the product with full external wallet support and Bradbury testnet deployment.

## What Clause Forge Does

Clause Forge helps users create GenLayer Intelligent Contracts without writing code manually.

The core workflow is:

1. Describe the contract in plain English.
2. Generate a GenLayer Python contract using AI.
3. Preview, inspect, edit, copy, or download the generated code.
4. Validate the contract structure.
5. Deploy to GenLayer Studionet.
6. Interact with deployed contract methods.
7. Optionally submit the contract to the marketplace.

## Why We Built It

GenLayer contracts are powerful, but they require knowledge of:

- GenLayer Python syntax
- GenVM storage rules
- Public view/write methods
- AI and web nondeterminism
- Validator consensus
- Deployment receipts
- Contract schema loading

Clause Forge turns user intent into deployable GenLayer contract code and hides much of the complexity behind a guided UI.

## Tech Stack

### Frontend

- React
- Vite
- TypeScript
- Tailwind CSS
- Zustand
- React Query
- React Router
- Monaco Editor
- GenLayerJS

### Backend

- Node.js
- Express
- TypeScript
- Zod
- Groq SDK
- GenLayerJS
- Supabase

### Deployment

- Netlify for frontend
- Railway for backend
- Supabase for database
- GenLayer Studionet for V1 contract deployment

## Project Structure

```txt
clause-forge/
  frontend/
    src/
      components/
      hooks/
      pages/
      services/
      store/
      types/
      utils/
  backend/
    src/
      config/
      db/
      middleware/
      routes/
      services/
      types/
  database/
    migrations/
    seed.sql
```

## Main Features

### Plain-English Contract Generation

Users describe a contract idea, such as an escrow, KYC verifier, voting system, scoring contract, or data-enrichment contract.

The backend sends the description to Groq with a GenLayer-specific system prompt. The generator returns Python contract code with the required GenLayer structure.

### Contract Preview

Generated contracts are shown in a Monaco editor. Users can:

- View generated Python code
- Inspect extracted methods
- Inspect state variables
- Edit the generated code
- Copy the code
- Download the contract as a `.py` file

### Validation

Clause Forge runs static checks before deployment.

The validator checks for:

- Missing Depends header
- Missing `from genlayer import *`
- Missing `gl.Contract`
- Missing public methods
- Missing `@gl.public.view`
- Forbidden unsafe code
- Risky storage scanning patterns

### Deployment

V1 deploys to GenLayer Studionet.

The app supports:

- Backend/system wallet deployment
- Browser-generated GenLayer wallets
- Deployment receipt handling
- Real contract address extraction from GenLayer transaction data

### Contract Interaction

After deployment, Clause Forge lets users interact with generated contract methods.

It separates:

- View methods
- Write methods

Users can pass inputs and see outputs, errors, or transaction hashes.

### Marketplace

The marketplace lets users:

- Browse submitted contracts
- Search listings
- Filter by category
- Inspect contracts by address
- Submit deployed contracts with name, description, category, tags, wallet address, and optional source code

Marketplace categories include:

- Verification
- Scoring
- Voting
- Data enrichment
- Custom

## Contract Generator Improvements

The generator has been tuned to produce safer GenLayer contracts.

It now instructs the AI to:

- Always include at least one `@gl.public.view` method
- Avoid scanning storage collections with `.values()` or `.items()`
- Avoid list comprehensions over `TreeMap` storage
- Use secondary indexes like `seen: TreeMap[str, u64]` for duplicate checks
- Avoid advanced features unless explicitly requested
- Use integer math for token amounts
- Mark paid agreements as resolved after settlement
- Copy storage values into local variables before nondeterministic execution

This helps prevent contracts that generate successfully but fail deployment, schema loading, or GenLayerJS introspection.

## API Overview

Backend API base:

```txt
/api/v1
```

Important endpoints:

```txt
GET  /api/v1/health
POST /api/v1/contracts/generate
POST /api/v1/contracts/validate
POST /api/v1/contracts/simulate
POST /api/v1/contracts/deploy
GET  /api/v1/contracts/source/:address
GET  /api/v1/contracts/address/:address
GET  /api/v1/marketplace
GET  /api/v1/marketplace/:address
POST /api/v1/marketplace/submit
```

## Local Development

Install dependencies from the repo root:

```bash
npm install
```

Run frontend and backend together:

```bash
npm run dev
```

Run frontend only:

```bash
npm run dev:frontend
```

Run backend only:

```bash
npm run dev:backend
```

Build frontend:

```bash
npm run build:frontend
```

Build backend:

```bash
npm run build:backend
```

On Windows PowerShell, if `npm run build` is blocked by execution policy, use:

```bash
npm.cmd run build
```

## Environment Variables

### Backend

Create backend environment variables for:

```txt
PORT=3000
NODE_ENV=development
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
GROQ_API_KEY=
SYSTEM_PRIVATE_KEY=
STUDIONET_RPC=https://studio.genlayer.com/api
FRONTEND_URL=http://localhost:5173
```

Required backend variables:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`
- `GROQ_API_KEY`

Required for backend deployment:

- `SYSTEM_PRIVATE_KEY`

### Frontend

For local development:

```txt
VITE_API_URL=http://localhost:3000/api
```

For Netlify production:

```txt
VITE_API_URL=https://your-railway-backend-url.up.railway.app/api
```

The `/api` suffix matters because the frontend calls paths like:

```txt
/v1/contracts/generate
```

So the final production request becomes:

```txt
https://your-railway-backend-url.up.railway.app/api/v1/contracts/generate
```

## Deployment Notes

### Railway Backend

Deploy the backend to Railway and make sure the health check works:

```txt
https://your-railway-backend-url.up.railway.app/api/v1/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "..."
}
```

### Netlify Frontend

Recommended Netlify settings:

```txt
Base directory: frontend
Build command: npm run build
Publish directory: dist
```

Netlify environment variable:

```txt
VITE_API_URL=https://your-railway-backend-url.up.railway.app/api
```

After changing environment variables, redeploy the Netlify site.

## Database

Supabase stores:

- Contract generations
- Deployed contracts
- Marketplace listings
- Contract interactions
- Usage logs

Migration files live in:

```txt
database/migrations/
```

## V1 Limitations

Clause Forge V1 is functional but early.

Known limitations:

- Contract validation is static and should become deeper.
- Contract simulation is mocked and does not fully reproduce GenLayer runtime behavior.
- External wallet support is partial.
- Bradbury deployment is planned but not active in V1.
- Some generated contracts may still need manual review, especially complex escrow, payment, AI arbitration, and token custody contracts.
- Marketplace, fork, and compose workflows need more production polish.

## V2 Roadmap

Planned V2 improvements:

- Full external wallet integration with MetaMask, Rabby, and similar wallets
- Bradbury testnet deployment
- Better transaction status tracking
- Stronger contract generator reliability
- Automatic repair/regeneration when validation fails
- GenLayer schema preflight before deployment where possible
- Better post-deploy schema checks
- More robust marketplace listings
- Fork and compose workflows
- Contract versioning
- Better user-facing deployment and schema error messages

## Product Summary

Clause Forge V1 is a no-code GenLayer contract factory.

It turns plain English into GenLayer Intelligent Contracts, gives users a code preview, validates the result, deploys to Studionet, and lets users interact with the deployed contract.

V1 proves the core workflow. V2 will focus on external wallets, Bradbury deployment, generator reliability, and a stronger marketplace experience.
