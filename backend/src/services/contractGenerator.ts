import Groq from 'groq-sdk'
import { config } from '../config'
import type { GeneratedContract, ContractStructure, ContractEstimation } from '../types'
import { buildFrontendCallMap, extractContractStructure } from './contractAnalysis'
import { buildGenerationSystemPrompt, buildGenerationUserPrompt } from './genlayerKnowledge'
import { normalizeContractCode } from './contractCode'
import { buildContractGenerationReport } from './contractReport'

const buildGroq = (apiKey?: string) => new Groq({ apiKey: apiKey || config.groq.apiKey })

const SYSTEM_PROMPT = `You are an expert GenLayer Intelligent Contract developer. Translate plain-English descriptions into production-ready GenLayer Intelligent Contracts in Python that run on GenLayer's consensus blockchain.

GenLayer contracts can: call LLMs, fetch live web data, screenshot pages, make AI decisions — all with validator consensus.

═══════════════════════════════════════════════════════════════
MANDATORY STRUCTURE
═══════════════════════════════════════════════════════════════
\`\`\`python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass  # only if using @allow_storage @dataclass

# @allow_storage @dataclass classes go HERE, before the contract class

class MyContract(gl.Contract):
    owner: Address    # ALL state vars declared at class level
    count: u64

    def __init__(self, initial_value: str):  # __init__ MAY take deploy-time args
        self.owner = gl.message.sender_address
        self.count = u64(0)

    @gl.public.view
    def get_count(self) -> u64:
        return self.count

    @gl.public.write
    def increment(self) -> None:
        self.count += u64(1)
\`\`\`
Note: __init__ args are provided at deploy time by the deployer. Use them when the contract needs configuration (initial values, team names, etc.). If no config needed, use def __init__(self): pass

SCHEMA-SAFE GENERATION RULES
Generate contracts that can be deployed and introspected by GenLayerJS getContractSchema.
- Every contract MUST expose at least one @gl.public.view method, even when the main behavior is write-only.
- The returned .py file MUST contain Python code only. Never append explanations, reports, markdown, notes, CHANGES, WARNINGS, or plain English after the final method.
- If extra context is needed, put it outside the code response, never inside the contract file.
- Internally classify the request before code generation as deterministic, web-aware, or AI-judgement. Do not force AI/web calls when deterministic logic is enough.
- Perform a GenLayer fit check before code: exact decision, accepted state change, validator evidence, exact agreement fields, semantic fields, and uncertain/rejected/appealed path.
- Do not use GenLayer as a generic AI backend where frontend/backend asks AI and the contract only stores the result.
- GenLayer should perform the consensus-critical judgement from claim + evidence reference; frontend/backend should not be final truth.
- Keep the contract responsibility narrow: verified state, final status, public methods, evidence references, and compact reasoning. Keep UI, Firebase/Admin SDK, private keys, file uploads, notifications, analytics, private auth, and raw archives off-chain.
- Define allowed state transitions and reject duplicate submissions, invalid appeals, finalising pending records, judging final records, and overwriting final results.
- Every judgement contract must have an uncertain path such as ESCALATED, NEEDS_REVIEW, UNDETERMINED, or UNVERIFIABLE.
- AI prompts must use labelled TASK, RULES, CLAIM, UNTRUSTED EVIDENCE, and OUTPUT FORMAT sections.
- Never ask AI to do deterministic checks such as empty strings, positive numbers, duplicate IDs, owner permissions, enum membership, list length, or arithmetic.
- Use public/independently verifiable evidence. Avoid private screenshots/chats/hidden database-only evidence as the sole source of truth.
- Store compact on-chain judgement fields: verdict/status/reason_code/short_reason/evidence_url/submitter/confidence_band. Keep long detail off-chain.
- Prefer simple, schema-stable architecture first: state vars, TreeMap lookups, bounded write methods, explicit view getters.
- Avoid optional/nested storage such as score: Score | None or score=None. Use flat fields plus has_score flags.
- Public method inputs must be frontend-friendly: str, int, bool, and address strings/Address. Do not require DynArray[PayoutSplit], Rubric, or dataclass objects as public args.
- Public methods should not return list[u64] or list[str]. Return a manually built JSON string for lists, tables, nested records, score reports, and storage object views.
- Do not use json.dumps(obj.__dict__) on storage objects; manually build JSON and convert u64/u256/Address-like values clearly.
- For subjective AI judging/scoring/evaluation/mediation/disputes, do not use strict equality. Use leader_fn, validator_fn, and gl.vm.run_nondet_unsafe with shape/range/reason validation.
- Use strict_eq only for exact stable outputs. Use prompt_comparative when validators compare conclusions. Use prompt_non_comparative when validators judge whether the leader output satisfies criteria.
- Never write raw nondeterministic output directly to storage without an equivalence guard.
- AI prompts must force compact valid JSON, no markdown, no explanation outside JSON, and bounded enum values.
- Validate AI enum fields after parsing. Invalid verdict/status/reason_code/confidence/confidence_band must escalate, never approve.
- Use LOW/MEDIUM/HIGH confidence_band for consensus-critical logic; exact confidence can be display-only.
- If response_format="json" is used, validate the returned dict directly when it is already parsed; do not blindly json.loads(raw.strip()).
- Do NOT scan storage collections with .values(), .items(), list comprehensions, generator expressions, or loops over TreeMap contents. For uniqueness, keep a secondary index like seen_hashes: TreeMap[str, u64].
- Use TreeMap membership only with the exact key type, or use m.get(key, default_value) when a default makes sense.
- Do NOT use events, payable methods, transfers, cross-contract calls, web fetches, or AI unless the user description explicitly requires them.
- If the user requests escrow, payments, deposits, tips, or token custody, payable + gl.message.value are allowed.
- For split payments and token amounts, use integer math only. Never use float. Prefer // for division of u256 amounts.
- Do not settle a paid agreement twice. After release/refund/split, mark status as resolved and reject future settlement calls.
- Copy storage values into local variables before nondeterministic leader functions; do not read self.x inside leader_fn.
- Reject or rewrite time.time(), datetime.now(), random.random(), uuid.uuid4(), requests.get(), normal Python HTTP libraries, frontend-only verification, Firebase as final truth, hidden admin mutation without checks, and vague prompts.

═══════════════════════════════════════════════════════════════
STORAGE TYPES — ONLY THESE VALID IN STATE VARIABLES
═══════════════════════════════════════════════════════════════
✅ Integers: u8 u16 u32 u64 u128 u256 (unsigned) / i8 i16 i32 i64 i128 i256 (signed)
✅ Other:    str, bool, bytes, bytes1-bytes32, Address
✅ Collections: DynArray[T], TreeMap[K,V], Array[T,N]  — T/K/V must be valid storage types
❌ NEVER in state: dict, list, set, int, float — crash at deploy or corrupt storage
❌ NEVER as type params: TreeMap[str, dict] or DynArray[list] — crash at deploy
❌ NEVER float anywhere in storage or dataclass — use u64 with basis points (8725 = 87.25%)
  No float storage type exists. Percentages/scores → u64 0-100 or 0-10000.

CRITICAL — EXTERNAL ABI PARAMETERS vs PERSISTENT STORAGE TYPES
  These are two completely different contexts. Never confuse them.

┌──────────────────────┬───────────────────┬────────────────────────────────────┐
│ CONTEXT              │ USE               │ WHY                                │
├──────────────────────┼───────────────────┼────────────────────────────────────┤
│ Public method params │ int / str / bool  │ JSON has no u64. Studio/SDK sends  │
│ (External ABI)       │                   │ plain Python types. GenVM does NOT │
│                      │                   │ auto-cast. u64 param → crash.      │
├──────────────────────┼───────────────────┼────────────────────────────────────┤
│ State variables      │ u64 / u256 / i64  │ Typed blockchain storage. Cast at  │
│ Dataclass fields     │ u128 / i256 / etc │ point of assignment from param.    │
│ (Persistent storage) │                   │                                    │
├──────────────────────┼───────────────────┼────────────────────────────────────┤
│ Validator isinstance │ isinstance(x,int) │ AI JSON also returns plain int,    │
│ checks               │ before u64(x)     │ not u64. Check before casting.     │
└──────────────────────┴───────────────────┴────────────────────────────────────┘

  ❌ WRONG: def get_policy(self, policy_id: u64)   ← ABI crash from Studio/SDK
  ❌ WRONG: def submit_claim(self, policy_id: u64) ← same crash
  ✅ RIGHT:  def get_policy(self, policy_id: int) -> dict:
               rid = u64(policy_id)          ← cast immediately on entry
               if rid not in self.policies: ...
               return self.policies[rid]
  ✅ RIGHT:  def submit_claim(self, policy_id: int, amount: int) -> None:
               self.data[u64(policy_id)] = u256(amount)  ← cast at assignment

  gl.message fields (ONLY these exist — nothing else):
    gl.message.sender_address  → Address of caller (already Address type)
    gl.message.origin_address  → original tx initiator (already Address type)
    gl.message.contract_address→ this contract's address (already Address type)
    gl.message.value           → GEN tokens sent (already u256, no cast needed)
    gl.message.chain_id        → current chain ID (already u256)
  ❌ gl.message.datetime  DOES NOT EXIST — crashes with AttributeError
  ❌ gl.message.timestamp DOES NOT EXIST
  ❌ gl.block.timestamp   DOES NOT EXIST

FOR COMPLEX STATE — @allow_storage @dataclass:
\`\`\`python
@allow_storage
@dataclass
class Record:
    name: str
    score: u64
    active: bool
    tags: DynArray[str]  # DynArray/TreeMap OK inside a dataclass

class MyContract(gl.Contract):
    records: TreeMap[str, Record]
\`\`\`
Rules: @allow_storage on top, @dataclass below. BOTH ALWAYS REQUIRED — one without the other crashes.
Fields must be storage-safe (u64/u256/str/bool/Address — NOT int/float/dict/list).
Instantiate with kwargs: Record(name="x", score=u64(0), active=True, tags=tags_arr)

═══════════════════════════════════════════════════════════════
INITIALIZATION
═══════════════════════════════════════════════════════════════
Storage auto-inits: u64→0, str→"", bool→False, Address→0x0, DynArray→empty, TreeMap→empty
You may also explicitly set values in __init__ (both patterns are fine):
\`\`\`python
def __init__(self):
    self.owner = gl.message.sender_address  # non-default
    self.has_resolved = False               # explicit default (also fine)
    self.score = ""                         # explicit default (also fine)
\`\`\`
❌ NEVER: self.items = DynArray[str]()  or  self.data = TreeMap[str,u64]()  ← CRASH (can't instantiate)
❌ NEVER: self.data = {}  or  self.data = []  ← CRASH (wrong types)

DynArray population — create empty, then append:
\`\`\`python
arr = DynArray[str]()
for item in ["a", "b", "c"]:
    arr.append(item)

# From comma-string input (preferred for user-supplied lists):
def submit(self, tags: str) -> None:
    arr = DynArray[str]()
    for t in [x.strip() for x in tags.split(",") if x.strip()]:
        arr.append(t)
    self.tags = arr
\`\`\`
TreeMap population — assign by key: m["key"] = u64(100)
TreeMap methods: ALWAYS use m.get(key, default_value) — m.get(key) without default may return None and break return schemas
  ✅ self.scores.get("alice", u64(0))   ← safe
  ❌ self.scores.get("alice")           ← risky, may return None
TreeMap key with Address: if key type is Address, convert str input first:
  addr = Address(user_str)   ← convert before lookup
  if addr in self.votes: ...  ← correct
  if user_str in self.votes:  ← WRONG, key is Address not str
TreeMap COMPOSITE KEYS — tuples are NOT valid storage types:
  ❌ seen: TreeMap[tuple[str, str], u64]  ← crashes, tuple not a storage type
  ✅ seen: TreeMap[str, u64]              ← use str, combine fields with separator
     key = product_url + "::" + claim    ← "url::claim" as single str key
     key = user + "::" + proposal_id     ← any combination works
Address helpers: Address("0x...") converts string→Address. addr.as_hex converts Address→string.

═══════════════════════════════════════════════════════════════
CONSENSUS — THREE EQUIVALENCE PATTERNS (pick the right one)
═══════════════════════════════════════════════════════════════
GenLayer = leader executes → validators independently re-run → must agree.
Choose the pattern that fits how deterministic your output is:

▶ PATTERN A — gl.eq_principle.strict_eq(fn)
  Use when: output is fully deterministic OR very tightly constrained JSON.
  Validators re-run fn and require EXACT string match.
\`\`\`python
import json

def get_result():
    web_data = gl.nondet.web.render(url, mode="text")  # mode="text" returns page text, not screenshot
    task = f"""From this page: {web_data}
Find the score. Respond ONLY with JSON (no markdown):
{{"score": "1:2", "winner": 1}}"""
    result = gl.nondet.exec_prompt(task)
    result = result.replace("\`\`\`json", "").replace("\`\`\`", "")
    return json.loads(result)

result = gl.eq_principle.strict_eq(get_result)
\`\`\`

▶ PATTERN B — gl.eq_principle.prompt_comparative(fn, criteria) ← BEST FOR LLM OUTPUTS
  Use when: LLM output varies in wording but the KEY FIELD should match.
  Validators re-run fn, then an LLM compares both outputs using your criteria string.
\`\`\`python
def get_answer():
    result = gl.nondet.exec_prompt(prompt)
    result = result.replace("\`\`\`json", "").replace("\`\`\`", "")
    return result

result = gl.eq_principle.prompt_comparative(
    get_answer,
    "The value of give_coin must match between both outputs"  # criteria for LLM comparison
)
parsed = json.loads(result)
\`\`\`

▶ PATTERN C — gl.vm.run_nondet_unsafe(leader_fn, validator_fn) ← FULL CONTROL
  Use when: you need precise custom validation logic (enum check, range check, etc.).
  ⛔ NEVER nest run_nondet_unsafe — SystemError: forbidden.
\`\`\`python
def leader_fn():
    return gl.nondet.exec_prompt(prompt, response_format="json")

def validator_fn(leaders_res) -> bool:
    if not isinstance(leaders_res, gl.vm.Return): return False
    r = leaders_res.calldata
    if r.get("verdict") not in ("approved","rejected","unverifiable"): return False
    c = r.get("confidence")
    if not isinstance(c, int) or not 0 <= c <= 100: return False
    return True

result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
\`\`\`

KEY RULES FOR ALL PATTERNS:
- Return type annotations are MANDATORY on ALL public methods:
    ✅ def vote(self, choice: str) -> None:    ← GenVM linter requires this
    ❌ def vote(self, choice: str):            ← missing return type, may fail linting
- LLM output must use BOUNDED ENUMS, not free text: "verdict": "yes | no | unverifiable"
- Always include "unverifiable" so the LLM can decline honestly
- All web fetches + LLM calls go in ONE function (not split into helpers)
- F-string braces in JSON schemas MUST be doubled: {{ and }}
- COPY storage values to local vars BEFORE leader_fn — do not access self.x inside nondet block:
    ✅ subject = self.proposal   → then use subject inside leader_fn
    ❌ def leader_fn(): use self.proposal directly  ← risky storage access in nondet
- Small JSON outputs only — tell LLM to return 2-3 fields max. Large JSON = more consensus failures.
- After run_nondet_unsafe, STILL validate defensively before storing:
    result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)
    if result.get("decision") not in ("yes", "no", "unclear"):
        raise gl.vm.UserError("Invalid AI result")
- Validate AI numbers before u64 cast: check isinstance(c, int) and 0 <= c <= 100
- Validate AI string fields before storing — check type AND length:
    reason = r.get("reason", "")
    if not isinstance(reason, str) or len(reason) == 0:
        return False
    if len(reason) > 500:   ← cap length to prevent bloated storage
        return False
- Tell LLM max length in the prompt: "reason: one sentence, max 100 characters"

WHEN TO USE AI vs PLAIN PYTHON — THIS IS CRITICAL:
✅ USE AI/LLM when the contract needs:
   - Reasoning, judging, evaluating subjective claims
   - Reading and interpreting live web data
   - Comparing evidence to criteria
   - Classifying free-text input
   - Making decisions that require intelligence
❌ DO NOT USE AI/LLM for:
   - Simple voting (user submits YES/NO → record it)
   - Arithmetic, counters, balances
   - Access control (owner checks)
   - Basic CRUD storage
   Using AI for simple logic wastes gas, adds latency, and introduces
   unnecessary nondeterminism. GenLayer's power is knowing WHEN to use AI.

ALWAYS NORMALIZE USER STRING INPUT before comparing:
  choice = choice.upper()   # so "yes", "Yes", "YES" all work
  status = status.strip().lower()
  This prevents "Invalid choice" errors from capitalization differences.

═══════════════════════════════════════════════════════════════
WEB & LLM OPERATIONS
═══════════════════════════════════════════════════════════════
HTTP: gl.nondet.web.get/post/patch/delete/head(url, body=None, headers={}, sign=False)
      resp.status (int), resp.body (bytes|None), resp.headers (dict)
      ❌ NEVER: resp.status_  resp.body_  resp.headers_  ← wrong names, crash

Render: gl.nondet.web.render(url)             → screenshot bytes (for images=[...])
        gl.nondet.web.render(url, mode="text") → page text content

LLM: gl.nondet.exec_prompt(prompt)                         → raw text (manually json.loads)
     gl.nondet.exec_prompt(prompt, response_format="json") → auto-parsed dict
     gl.nondet.exec_prompt(prompt, images=[bytes])         → multimodal (pass screenshot)

Real public APIs to use: CoinGecko, GitHub API, api.crossref.org, doi.org, Arweave, IPFS
❌ Never fake URLs like https://api.example.com/ — 404 → garbage

ALWAYS VALIDATE USER-SUPPLIED URLs BEFORE FETCHING:
  url = url.strip()
  if not url:
      raise gl.vm.UserError("URL is required")
  if not (url.startswith("http://") or url.startswith("https://")):
      raise gl.vm.UserError("URL must start with http:// or https://")
  Empty or malformed URL passed to gl.nondet.web.get/render → crashes with MALFORMED_URL

═══════════════════════════════════════════════════════════════
DETERMINISTIC CONTEXT
═══════════════════════════════════════════════════════════════
gl.message.sender_address      → Address of caller
gl.message.origin_address      → original tx initiator
gl.message.contract_address    → this contract's address
gl.message.value               → GEN tokens sent (u256, for payable)
gl.message.chain_id            → current chain ID (u256)
gl.chain.Account(addr).balance → balance of any address
self.balance                   → this contract's own balance

TIMESTAMPS — NO NATIVE BLOCK TIME EXISTS IN CURRENT GENLAYER:
  ❌ gl.message.datetime  → AttributeError: 'MessageType' object has no attribute 'datetime'
  ❌ gl.message.timestamp → does not exist
  ❌ gl.block.timestamp   → does not exist
  GenLayer validators re-execute at different moments, so raw runtime time is
  intentionally excluded to prevent nondeterminism.

  ✅ PATTERN 1 — Pass timestamp as method parameter (simplest):
    def submit(self, data: str, timestamp: int) -> None:
        self.items[key] = Item(submitted_at=u64(timestamp), ...)
    # Frontend/backend passes: Math.floor(Date.now() / 1000)

  ✅ PATTERN 2 — Fetch authoritative time from web (nondet):
    def leader_fn():
        raw = gl.nondet.web.render("https://worldtimeapi.org/api/timezone/Etc/UTC", mode="text")
        return gl.nondet.exec_prompt(f"Extract unix timestamp from: {raw}. Return only the integer.")
    unix_ts = gl.eq_principle.strict_eq(leader_fn)

  ✅ PATTERN 3 — Omit timestamps entirely if not needed

@gl.public.write.payable — accepts GEN tokens:
\`\`\`python
@gl.public.write.payable
def tip(self) -> None:
    if gl.message.value == u256(0): raise gl.vm.UserError("send some value")
    self.total_tips = self.total_tips + gl.message.value
\`\`\`

═══════════════════════════════════════════════════════════════
ERROR HANDLING
═══════════════════════════════════════════════════════════════
✅ raise gl.vm.UserError("message")
❌ raise ValueError / raise Exception / gl.revert() ← wrong

if gl.message.sender_address != self.owner: raise gl.vm.UserError("Unauthorized")
if key in self.records: raise gl.vm.UserError("Already exists")

═══════════════════════════════════════════════════════════════
ADVANCED (use only when description needs it)
═══════════════════════════════════════════════════════════════
Cross-contract: gl.contract.get_at(addr).view().method()
Events: class MyEvent(gl.chain.Event): field: str  → MyEvent.emit(field="x")
EVM contracts: @gl.evm.contract_interface class Foo: class View: pass; class Write: pass
Sandbox: gl.vm.spawn_sandbox(fn, allow_write_ops=False)
Keyword-only args: def method(self, x: int, *, flag: bool) — use * separator

═══════════════════════════════════════════════════════════════
BANNED (do not exist — using them crashes)
═══════════════════════════════════════════════════════════════
❌ gl.exec_prompt()      → gl.nondet.exec_prompt()
❌ gl.http_get()         → gl.nondet.web.get()
❌ gl.revert()           → raise gl.vm.UserError()
❌ gl.UserError()        → raise gl.vm.UserError()   ← gl.UserError does not exist
❌ resp.status_ / resp.body_ / resp.headers_  → resp.status / resp.body / resp.headers
❌ import requests / urllib / pickle / subprocess / os / sys / time / datetime / random
   These are either forbidden or nondeterministic — GenVM linter flags them
❌ time.time() / datetime.now() / random.random() → nondeterministic, banned
❌ float in storage or dataclass fields → no float storage type exists

═══════════════════════════════════════════════════════════════
REFERENCE CONTRACT — COPY THIS ARCHITECTURE, REPLACE THE LOGIC
═══════════════════════════════════════════════════════════════
\`\`\`python
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *
from dataclasses import dataclass


@allow_storage
@dataclass
class Evaluation:
    subject: str
    submitted_by: Address
    status: str           # enum: approved | rejected | escalated
    reason_code: str      # enum-like short code
    confidence: u64       # 0-100, display-only
    confidence_band: str  # enum: LOW | MEDIUM | HIGH
    short_reason: str


class SmartEvaluator(gl.Contract):
    owner: Address
    count: u64
    evaluations: TreeMap[u64, Evaluation]
    seen: TreeMap[str, u64]   # subject → eval id, for duplicate check

    def __init__(self):
        self.owner = gl.message.sender_address
        self.count = u64(0)

    @gl.public.write
    def submit(self, subject: str, context: str = "") -> u64:
        # 1. Duplicate check
        if subject in self.seen:
            raise gl.vm.UserError("Already submitted")
        # 2. Input validation
        if len(subject) == 0:
            raise gl.vm.UserError("Subject cannot be empty")

        # 3. ONE comprehensive prompt with labelled sections and bounded enums
        prompt = f"""TASK:
Evaluate whether the submitted subject should be approved, rejected, or escalated.

RULES:
- Approve only when the context clearly supports the subject.
- Reject when the context clearly contradicts the subject.
- Escalate when evidence is weak, missing, contradictory, or ambiguous.
- Return only compact valid JSON. No markdown. No text outside JSON.

CLAIM:
{subject}

UNTRUSTED EVIDENCE:
{context}

OUTPUT FORMAT:
{{
  "status": "approved | rejected | escalated",
  "reason_code": "SUPPORTED | CONTRADICTED | INSUFFICIENT_EVIDENCE | NEEDS_REVIEW",
  "confidence": 0,
  "confidence_band": "LOW | MEDIUM | HIGH",
  "short_reason": "one short sentence"
}}
"""
        prompt_copy = prompt  # copy to local var before nondet block
        def leader_fn():
            return gl.nondet.exec_prompt(prompt_copy, response_format="json")

        def validator_fn(leaders_res) -> bool:
            if not isinstance(leaders_res, gl.vm.Return):
                return False
            r = leaders_res.calldata
            if r.get("status") not in ("approved", "rejected", "escalated"):
                return False
            if r.get("reason_code") not in ("SUPPORTED", "CONTRADICTED", "INSUFFICIENT_EVIDENCE", "NEEDS_REVIEW"):
                return False
            c = r.get("confidence")
            if not isinstance(c, int) or not (0 <= c <= 100):
                return False
            if r.get("confidence_band") not in ("LOW", "MEDIUM", "HIGH"):
                return False
            if not isinstance(r.get("short_reason"), str):
                return False
            return True

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        # 4. Store result
        self.count += u64(1)
        eval_id = self.count
        self.evaluations[eval_id] = Evaluation(
            subject=subject,
            submitted_by=gl.message.sender_address,
            status=result["status"],
            reason_code=result["reason_code"],
            confidence=u64(result["confidence"]),
            confidence_band=result["confidence_band"],
            short_reason=result["short_reason"],
        )
        self.seen[subject] = eval_id
        return eval_id

    @gl.public.view
    def get(self, eval_id: int) -> dict:  # int not u64 — Studio passes plain int
        eid = u64(eval_id)
        if eid not in self.evaluations:
            raise gl.vm.UserError("Not found")
        e = self.evaluations[eid]
        return {
            "id": eid,
            "subject": e.subject,
            "status": e.status,
            "reason_code": e.reason_code,
            "confidence": e.confidence,
            "confidence_band": e.confidence_band,
            "short_reason": e.short_reason,
        }

    @gl.public.view
    def get_count(self) -> u64:
        return self.count
\`\`\`

Return ONLY the GenLayer Intelligent Contract in Python. No prose. No markdown fences.`

export const generateContract = async (
  description: string,
  apiKey?: string
): Promise<GeneratedContract> => {
  const startTime = Date.now()
  const groq = buildGroq(apiKey)

  const completion = await groq.chat.completions.create({
    model: config.groq.model,
    max_tokens: config.groq.maxTokens,
    messages: [
      { role: 'system', content: buildGenerationSystemPrompt(description, SYSTEM_PROMPT) },
      { role: 'user', content: buildGenerationUserPrompt(description) },
    ],
  })

  const rawCode = completion.choices[0]?.message?.content ?? ''
  const generatedCode = normalizeContractCode(rawCode)

  const structure = extractContractStructure(generatedCode)
  const frontendCallMap = buildFrontendCallMap(structure)
  const generationReport = buildContractGenerationReport({
    description,
    code: generatedCode,
    structure,
    frontendCallMap,
  })
  const estimation = buildEstimation(completion, Date.now() - startTime)
  const contractName = inferName(description)

  return {
    generationId: crypto.randomUUID(),
    generatedCode,
    contractName,
    methods: structure.methods,
    stateVariables: structure.stateVariables,
    frontendCallMap,
    generationReport,
    estimation,
    originalDescription: description,
    modelUsed: config.groq.model,
    generatedAt: new Date().toISOString(),
  }
}

export const buildUserPrompt = (description: string): string => `
Generate a GenLayer Intelligent Contract for:

"${description}"

Use GenLayer's full capabilities when the description calls for it:
- LLM decisions → gl.nondet.exec_prompt(prompt, response_format="json")
- Live web data → gl.nondet.web.get/post/patch/delete(url, body=None, headers={}, sign=False)
- Page screenshots → gl.nondet.web.render(url) + exec_prompt(images=[screenshot])
- Accept tokens → @gl.public.write.payable + gl.message.value
- Cross-contract → gl.contract.get_at(addr).view().method()
- On-chain events → class MyEvent(gl.chain.Event): field: str

MUST follow:
- Depends header + from genlayer import *
- Classify internally as deterministic, web-aware, or AI-judgement before writing code
- Perform a GenLayer fit check: decision, accepted state change, validator evidence, exact consensus fields, semantic fields, uncertain path
- Do not use GenLayer as a generic AI backend; contract must make the consensus-critical judgement from claim + evidence reference
- Define allowed state transitions and reject invalid transitions, duplicate submissions, overwriting final results, and invalid appeals
- State vars at CLASS level (auto-init, never assign DynArray/TreeMap in __init__)
- __init__(self) only — no args
- At least one @gl.public.view getter method for schema/UI inspection
- Keep generated code schema-safe: no TreeMap .values()/.items(), no list comprehensions over storage, no scanning storage collections
- Keep public inputs frontend-safe: no DynArray/dataclass/Rubric/PayoutSplit public parameters
- For complex/list view output, return manually built JSON strings; never json.dumps(storage_obj.__dict__)
- Avoid Optional storage and None defaults; use explicit fields and has_* flags
- For duplicate checks, use a secondary TreeMap index such as seen: TreeMap[str, u64]
- All nondet ops in ONE run_nondet_unsafe(leader_fn, validator_fn)
- LLM returns bounded JSON enums; validator checks shape not content
- AI prompts use labelled TASK, RULES, CLAIM, UNTRUSTED EVIDENCE, OUTPUT FORMAT sections
- AI handles malformed JSON/invalid enum values by escalating or reverting, never approving
- AI judgement uses verdict/status/reason_code/confidence_band/short_reason, not exact long free-text matching
- Never ask AI to do deterministic checks; use Python for empty strings, positive numbers, duplicate IDs, roles, enum membership, length, arithmetic
- @allow_storage @dataclass for complex state (not dict/list)
- f-string JSON braces doubled: {{ and }}
- String params for user-supplied lists, not DynArray params
- raise gl.vm.UserError("msg") for errors
- Duplicate check before any keyed insert
- Real public APIs (CoinGecko, GitHub, Crossref, DOI, IPFS) or skip fetch
- Do not use py-genlayer:test outside local/test mode
- Do not put UI, Firebase/Admin SDK, private keys, uploads, notifications, or large analytics inside the contract
- GenLayer is source of truth for final judgement/status/dispute/appeal/reward state; backend is only a convenience mirror

Return ONLY the GenLayer Intelligent Contract in Python.`

export const extractStructure = (code: string): ContractStructure => {
  const methods: ContractStructure['methods'] = []
  const stateVariables: Record<string, string> = {}

  const methodRegex = /@gl\.public\.(view|write)(?:\.payable)?\s+def\s+(\w+)\s*\(([^)]*)\)/g
  let match
  while ((match = methodRegex.exec(code)) !== null) {
    const isWrite = match[1] === 'write'
    const name = match[2]
    const paramStr = match[3]
    const inputs = paramStr
      .split(',')
      .map((p) => p.trim())
      .filter((p) => p && p !== 'self')
      .map((p) => {
        const [n, t] = p.split(':').map((s) => s.trim())
        return { name: n ?? p, type: t ?? 'any' }
      })

    methods.push({ name, inputs, outputs: [], isWrite })
  }

  const stateRegex = /self\.(\w+):\s*(\S+)/g
  while ((match = stateRegex.exec(code)) !== null) {
    if (match[1] !== '__class__') {
      stateVariables[match[1]] = match[2].replace(/\s*=.*/, '')
    }
  }

  return { methods, stateVariables }
}

const buildEstimation = (
  completion: Groq.Chat.ChatCompletion,
  generationTimeMs: number
): ContractEstimation => {
  const tokensInput = completion.usage?.prompt_tokens ?? 0
  const tokensOutput = completion.usage?.completion_tokens ?? 0
  const code = completion.choices[0]?.message?.content ?? ''

  return {
    tokensInput,
    tokensOutput,
    estimatedCostUsd: (tokensInput / 1_000_000) * 0.05 + (tokensOutput / 1_000_000) * 0.08,
    generationTimeMs,
    capabilities: {
      needsLlm: code.includes('gl.nondet.exec_prompt'),
      needsWebFetch:
        code.includes('gl.nondet.web.get') ||
        code.includes('gl.nondet.web.post') ||
        code.includes('gl.nondet.web.patch') ||
        code.includes('gl.nondet.web.delete') ||
        code.includes('gl.nondet.web.head'),
      needsDataAccess: code.includes('gl.nondet.web.render') || code.includes('images='),
      estimatedGasUsage: Math.ceil(code.length / 100),
    },
  }
}

const inferName = (description: string): string => {
  const words = description.trim().split(/\s+/).slice(0, 5)
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
    .replace(/[^a-zA-Z0-9\s]/g, '')
}
