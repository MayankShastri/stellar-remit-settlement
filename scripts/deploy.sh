#!/usr/bin/env bash
# Stellar Remit — full deployment workflow (testnet).
#
# Deploys Splitter + Crowdfund and runs the 4-step initialization that
# resolves their mutual address dependency. See README.md for context.
set -euo pipefail

NETWORK=testnet
GOAL_STROOPS=1000000000   # 100 XLM

echo "==> 1/7 identities (generate + friendbot-fund if missing)"
stellar keys show admin >/dev/null 2>&1 || stellar keys generate admin --network $NETWORK || stellar keys generate admin
stellar keys fund admin --network $NETWORK || true

echo "==> 2/7 build both contracts"
stellar contract build --manifest-path contracts/crowdfund/Cargo.toml
stellar contract build --manifest-path contracts/splitter/Cargo.toml

echo "==> 3/7 deploy Splitter"
SPLITTER_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/splitter.wasm \
  --source admin --network $NETWORK --alias splitter-settlement)
echo "Splitter: $SPLITTER_ID"

echo "==> 4/7 deploy Crowdfund"
CROWDFUND_ID=$(stellar contract deploy \
  --wasm target/wasm32v1-none/release/crowdfund.wasm \
  --source admin --network $NETWORK --alias crowdfund-settlement)
echo "Crowdfund: $CROWDFUND_ID"

XLM_SAC=$(stellar contract id asset --asset native --network $NETWORK)
BENEFICIARY=$(stellar keys address beneficiary 2>/dev/null || stellar keys address admin)
PROVIDER=$(stellar keys address provider 2>/dev/null || stellar keys address admin)

echo "==> 5/7 initialize Splitter (locks Crowdfund caller + recipients)"
stellar contract invoke --id "$SPLITTER_ID" --source admin --network $NETWORK -- \
  initialize \
  --crowdfund "$CROWDFUND_ID" \
  --token "$XLM_SAC" \
  --recipients-file-path scripts/recipients.json

echo "==> 6/7 initialize Crowdfund (locks goal, token, Splitter)"
stellar contract invoke --id "$CROWDFUND_ID" --source admin --network $NETWORK -- \
  initialize \
  --admin "$(stellar keys address admin)" \
  --goal "$GOAL_STROOPS" \
  --token "$XLM_SAC" \
  --splitter "$SPLITTER_ID"

cat <<EOF

==> 7/7 done. Set in .env.local:

VITE_CROWDFUND_ID=$CROWDFUND_ID
VITE_SPLITTER_ID=$SPLITTER_ID
EOF
