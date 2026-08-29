# Stellar Remit — Cross-Border Group Settlement

**Orange Belt (Level 3) · Stellar Journey to Mastery**

A non-custodial dApp where a family or community group pools XLM toward a
shared cross-border expense. When the goal is met, withdrawal doesn't pay one
wallet — it **atomically settles multiple obligations in a single
transaction**: 70% to the primary beneficiary, 30% to a service provider,
enforced by two Soroban contracts rather than a promise from whoever holds
the funds.

> Live demo: https://stellar-remit-settlement.vercel.app/

> Demo video: [Walkthrough](https://youtu.be/u0aMwEfrpek)

---

## The demo scenario

A family pools money for a shared expense — a medical bill, travel costs, a
remittance that must reach more than one party. Contributors donate from any
Stellar wallet. When the pool reaches its 100 XLM goal, the admin triggers a
withdrawal and the contract chain settles both recipients atomically:

```
                    ┌───────────────────────────────┐
   Donors ────────▶ │   Crowdfund contract          │
   (any wallet)     │   goal · donors · escrow      │
                    └──────────────┬────────────────┘
                                   │ withdraw() [admin]
                                   │ 1. checks: goal met? once only?
                                   │ 2. effects: withdrawn = true FIRST
                                   │ 3. interactions:
                                   │    approve(splitter, total)
                    ┌──────────────▼────────────────┐
                    │   Splitter contract           │
                    │   locked recipients table     │
                    │   70/30 basis points          │
                    └───────┬───────────────┬───────┘
                            ▼               ▼
                   Beneficiary (70%)   Provider (30%)
```

If either transfer fails, the whole settlement reverts and the pool stays
intact.

## Belt progression

| Level | What it added |
|---|---|
| White Belt | Freighter connect, balance display, single-recipient XLM send |
| Yellow Belt | Multi-wallet kit, first Soroban crowdfund contract, event polling |
| **Orange Belt** | **Second contract + real inter-contract calls, token escrow, CI/CD, mobile polish, tests on both layers** |

## Contract addresses (Stellar Testnet)

| Contract | Address |
|---|---|
| Crowdfund (`CB5CF5…6UBS`) | `CB5CF5BT3ESNV66G355YONADPYOIT666R7MFUIITGGPLPD5SEZBR6UBS` |
| Splitter (`CCYDQ…EU2PD`) | `CCYDQILCNR4DASP5L2DDN475NTWBXJZLBX466DTMFUVL3MEBI73EU2PD` |
| Native XLM (SAC) | `CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC` |

The Splitter's address is **locked into Crowdfund state at `initialize()`**
— never accepted as a runtime argument later — so settlement destinations
cannot be substituted after the fact. Donors can verify this on-chain before
contributing.

## Transaction hashes

| Step | Tx hash |
|---|---|
| Crowdfund `initialize()` (goal 100 XLM, empty pool) | recorded in demo video |
| Donations → goal reached | recorded in demo video |
| **`withdraw()` — cross-contract settlement (70/30 split)** | recorded in demo video |

Previous deployment v2 hashes preserved for reference:
- Donations: [`e1702c0a…`](https://stellar.expert/explorer/testnet/tx/e1702c0a42708371cc7d69d7fbc2f5d084e0d3e5189c0d587f5267aaa69a2f65) / [`3209aba2…`](https://stellar.expert/explorer/testnet/tx/3209aba29dc1cc51de472f8ebe1fa11431541a275a23a8fdf92c620f4ebeff88)
- Settlement: [`5172fdd6…`](https://stellar.expert/explorer/testnet/tx/5172fdd679355c2bdd262c8498cfc9f1b3ec67924241e8b89275fcbccc3087c7)

## Deployment workflow (reproduce it)

Deployment and initialization are separate steps in Soroban, which is what
breaks the chicken-and-egg dependency between the two contracts:

```bash
stellar keys generate admin && stellar keys fund admin --network testnet

# 1. build WASM
stellar contract build --manifest-path contracts/crowdfund/Cargo.toml
stellar contract build --manifest-path contracts/splitter/Cargo.toml

# 2. deploy BOTH (addresses exist, uninitialized)
SPLITTER_ID=$(stellar contract deploy --wasm target/wasm32v1-none/release/splitter.wasm \
  --source admin --network testnet)
CROWDFUND_ID=$(stellar contract deploy --wasm target/wasm32v1-none/release/crowdfund.wasm \
  --source admin --network testnet)

# 3. initialize Splitter with the Crowdfund's address
stellar contract invoke --id $SPLITTER_ID --source admin --network testnet -- \
  initialize --crowdfund $CROWDFUND_ID \
  --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --recipients-file-path scripts/recipients.json

# 4. initialize Crowdfund with the Splitter's address (locked forever)
stellar contract invoke --id $CROWDFUND_ID --source admin --network testnet -- \
  initialize --admin "$(stellar keys address admin)" \
  --goal 1000000000 \
  --token CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC \
  --splitter $SPLITTER_ID
```

`scripts/deploy.sh` automates all of the above.

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | Vite · React 19 · Tailwind CSS 4 · Geist Sans/Mono (Fontsource) |
| Wallets | `@creit.tech/stellar-wallets-kit` (Freighter, Lobstr, Albedo, Hana) |
| Stellar SDK | `@stellar/stellar-sdk` v16 · Soroban RPC (`soroban-testnet.stellar.org`) |
| Contracts | Rust · `soroban-sdk` v27 · `wasm32v1-none` target |
| Tests | `soroban_sdk::testutils` (19) · Vitest (15) |
| CI/CD | GitHub Actions (verify) · Vercel (ship) |

## Testing

```bash
# contracts — 19 unit/integration tests
cargo test --workspace

# frontend — split math + validation logic
npm install --ignore-scripts
npm test

# production build
npm run build
```

Contract coverage highlights: exact 70/30 proportions through a real SAC
token; **remainder-to-last dust handling** (10,005 stroops at 50/50 →
5,002/5,003); double-withdraw rejection; late-donation rejection; goal gating;
unauthorized admin and unauthorized `distribute()` caller rejection; invalid
basis-point configuration rejection.

## Event streaming — polling by design

Soroban RPC does not currently offer a stable WebSocket/push subscription for
contract events, so the app streams via `getEvents` polling with an adaptive
loop: immediate re-poll when a batch returns events, ~1.5 s idle backoff
otherwise (avoids public-endpoint rate limits), paused while the tab is
hidden. This is a documented platform limitation, not a shortcut.

## Error handling (8 types)

1. Wallet not found / not installed
2. User rejected signing
3. Insufficient balance
4. Withdrawal before goal is met
5. Unauthorized withdrawal attempt (non-admin)
6. Invalid split configuration (shares ≠ 10,000 bps)
7. Unauthorized `distribute()` caller (≠ locked Crowdfund address)
8. Donation after withdrawal ("late funds are refused, never trapped")

Plus simulate-before-sign: contract-level failures surface *before* the wallet
prompt ever appears.

## Security practices

- **Checks-Effects-Interactions ordering** — `withdrawn = true` is set before
  any external call in `withdraw()`
- **Locked splitter** — settlement destination immutable at init, verifiable
  on-chain
- **Allowance-scoped transfers** — Splitter pulls exactly the approved amount
  via SEP-41 `transfer_from`; nothing transits the Splitter's own balance
- **Security headers** — CSP, `nosniff`, `X-Frame-Options`, referrer policy
  via `vercel.json`
- React error boundary; RPC retries with exponential backoff; no secrets ever
  touch the client (non-custodial by design); `npm audit` clean of
  high/critical issues (remaining 23 low-severity findings are upstream
  `elliptic` advisories in wallet-kit dependencies)

## CI/CD

GitHub Actions runs two jobs on every push/PR:

1. **frontend** — lint (oxlint) → Vitest → production build
2. **contracts** — `cargo test --workspace` → WASM build via `stellar contract build`

The frontend build inside Actions is a deliberate pre-merge verification gate,
separate from Vercel's deployment build. **Actions verifies; Vercel ships.**

## Project structure

```
├── .github/workflows/ci.yml   # two-job pipeline
├── contracts/
│   ├── crowdfund/             # extended: escrow + locked splitter + CEI withdraw
│   └── splitter/              # new: bps recipients, atomic distribute
├── scripts/deploy.sh          # end-to-end deployment workflow
├── src/
│   ├── components/            # console UI (numbered panels, corner brackets)
│   ├── hooks/usePool.js       # orchestration: wallet, state, tx flows
│   ├── lib/                   # config, wallet kit, rpc retry, events, split math
│   └── tests/                 # Vitest suites
└── vercel.json                # security headers
```

## Screenshots

### Mobile Responsive UI
![Mobile Responsive UI](docs/screenshots/Mobile%20Screenshot%201.png)

### Mobile Responsive UI (Donate Form)
![Mobile Responsive UI](docs/screenshots/Mobile%20Screenshot%202.png)

### CI/CD Pipeline
![CI/CD Pipeline](docs/screenshots/CI-CD%20Pipeline%20Running.png)

### Test Output
![Test Output](docs/screenshots/Cargo%20Test%20--workspace.png)

### Test Output
![Test Output](docs/screenshots/NPM%20Test.png)

---

## License

MIT