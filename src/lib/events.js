import { CROWDFUND_ID, SPLITTER_ID } from './config'
import { server } from './rpc'
import * as StellarSdk from '@stellar/stellar-sdk'

/**
 * Adaptive getEvents polling across both contracts.
 *
 * Soroban RPC has no stable WebSocket/push subscription today, so polling
 * `getEvents` is the documented mechanism. A fixed tight interval either
 * hammers the public endpoint (HTTP 429) or feels sluggish — so this loop
 * polls again almost immediately after a batch that contained new events,
 * and backs off when idle.
 */
export function createEventPoller({ onBatch, activeDelayMs = 300, idleDelayMs = 1500 }) {
  let cursor = null
  let stopped = true
  let timer = null
  let consecutiveFailures = 0

  async function fetchLatestLedger() {
    if (cursor !== null) return
    const latest = await server.getLatestLedger()
    cursor = latest.sequence
  }

  async function tick() {
    if (stopped) return
    try {
      await fetchLatestLedger()
      const response = await server.getEvents({
        startLedger: cursor,
        filters: [
          {
            type: 'contract',
            contractIds: [CROWDFUND_ID, SPLITTER_ID].filter(Boolean),
          },
        ],
        limit: 100,
      })
      cursor = response.latestLedger
      consecutiveFailures = 0
      const events = normalize(response.events)
      onBatch(events)
      timer = setTimeout(tick, events.length > 0 ? activeDelayMs : idleDelayMs)
    } catch {
      // Transient RPC failure — back off. If failures persist, the stored
      // cursor has likely fallen outside the RPC's event retention window;
      // drop it so the next tick re-syncs to the latest ledger (resuming the
      // stream beats staying dead, at the cost of skipping the missed window).
      consecutiveFailures += 1
      if (consecutiveFailures >= 3) {
        cursor = null
        consecutiveFailures = 0
      }
      timer = setTimeout(tick, idleDelayMs * 2)
    }
  }

  function normalize(events) {
    return events.map(event => {
      const topicSymbols = event.topic
        ?.map(t => {
          try {
            return t._arm === 'sym' ? t.sym().toString() : String(t._value ?? '')
          } catch {
            return ''
          }
        })
        .filter(Boolean)
      return {
        id: `${event.txHash}:${event.id ?? ''}`,
        txHash: event.txHash,
        ledger: event.ledger ?? event.ledgerClosedAt,
        symbols: topicSymbols,
        amountStroops: extractAmount(event),
        type:
          topicSymbols?.includes('DONATION') ? 'DONATION'
          : topicSymbols?.includes('WITHDRAWN') ? 'WITHDRAWN'
          : topicSymbols?.includes('PAYDIST') ? 'PAYDIST'
          : 'OTHER',
      }
    })
  }

  /** Pull the i128 value out of an event payload when present. */
  function extractAmount(event) {
    try {
      const native = StellarSdk.scValToNative(event.data)
      if (typeof native === 'bigint' || typeof native === 'number') {
        return BigInt(native)
      }
    } catch {
      /* non-numeric payloads are fine */
    }
    return null
  }

  return {
    start() {
      if (!stopped) return
      stopped = false
      tick()
    },
    stop() {
      stopped = true
      if (timer) clearTimeout(timer)
    },
  }
}
