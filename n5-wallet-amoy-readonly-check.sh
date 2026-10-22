#!/usr/bin/env bash
# N5 Wallet Amoy read-only check. No key storage and NO on-chain transactions.
set -euo pipefail
umask 077
URL="${N5_WALLET_URL:-https://n5-wallet-service-amoy.zed-ai.workers.dev}"
URL="${URL%/}"
command -v curl >/dev/null || { echo 'curl is required' >&2; exit 1; }
command -v node >/dev/null || { echo 'Node.js is required' >&2; exit 1; }
printf '%s\n' '[1/3] Public health check'
HEALTH="$(curl --max-time 20 --silent --show-error --fail-with-body "$URL/health")"
printf '%s\n' "$HEALTH" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 const r=JSON.parse(s);
 if(r.service!=="n5-wallet-service"||r.chainId!==80002) process.exitCode=2;
 console.log(JSON.stringify(r,null,2));
 if(r.transfersEnabled) console.error("WARNING: transfers are already ENABLED");
 if(r.autoRewardsEnabled) console.error("WARNING: auto rewards are already ENABLED");
});'
printf '\n%s\n' '[2/3] Admin preflight (read-only)'
read -r -s -p 'Enter ADMIN_API_TOKEN locally (input hidden): ' ADMIN_API_TOKEN
printf '\n'
[ -n "$ADMIN_API_TOKEN" ] || { echo 'Admin token is missing' >&2; exit 1; }
PREFLIGHT="$(curl --max-time 40 --silent --show-error --fail-with-body --config <(printf 'header = "Authorization: Bearer %s"\n' "$ADMIN_API_TOKEN") "$URL/admin/preflight")"
printf '%s\n' "$PREFLIGHT" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 const r=JSON.parse(s);
 const expected="0xb0762e4eb2a1c4e4c3d65b93048972abb60dfaa7";
 if(r.chainId!==80002 || String(r.contract||"").toLowerCase()!==expected) process.exitCode=3;
 console.log(JSON.stringify(r,null,2));
 if(!r.distributor?.address){console.error("BLOCKER: operational Distributor is not configured");process.exitCode=4;}
 if(r.distributor?.address && r.admin?.address && r.distributor.address.toLowerCase()===r.admin.address.toLowerCase()) {console.error("BLOCKER: distributor must not be treasury");process.exitCode=4;}
});'
printf '\n%s\n' '[3/3] Batch overview (read-only)'
OVERVIEW="$(curl --max-time 25 --silent --show-error --fail-with-body --config <(printf 'header = "Authorization: Bearer %s"\n' "$ADMIN_API_TOKEN") "$URL/admin/overview")"
printf '%s\n' "$OVERVIEW" | node -e '
let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{
 const r=JSON.parse(s);
 console.log(JSON.stringify(r,null,2));
 if((r.batches||[]).some(x=>x.state==="APPROVED")) console.error("WARNING: approved batch exists! Do not enable transfers until reviewed.");
});'
unset ADMIN_API_TOKEN PREFLIGHT OVERVIEW HEALTH
printf '\n%s\n' 'Read-only checks complete. No transaction was sent.'
