import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'

import { PoolHero } from '../components/PoolHero'
import { Navbar } from '../components/Navbar'
import { WalletConnect } from '../components/WalletConnect'
import { BalanceCard } from '../components/BalanceCard'
import { DonateForm } from '../components/DonateForm'
import { EventStream } from '../components/EventStream'
import { DonorList } from '../components/DonorList'
import { WithdrawPanel } from '../components/WithdrawPanel'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TxStatusBanner } from '../components/TxStatusBanner'
import { Toast } from '../components/Toast'

const ADDR = 'GA5MY3FFEPCYIXKQBW7WGG6SV7G6MMDOQST3OG7AWPQUIJSVJ2QB6RS3'
const PROVIDER = 'GCYTJWL4I5WQPE3ID7VUHEF4WHVIOAGXF6DPW75BI2EPMDARNT4K43FY'
const GOAL = 1_000_000_000n

const recipients = [
  { address: ADDR, bps: 7000 },
  { address: PROVIDER, bps: 3000 },
]

const noop = () => {}

describe('component SSR smoke — every component renders without throwing', () => {
  it('Navbar (disconnected + connected)', () => {
    renderToString(<Navbar address={null} onConnect={noop} onDisconnect={noop} />)
    renderToString(<Navbar address={ADDR} onConnect={noop} onDisconnect={noop} />)
  })

  it('WalletConnect (both states)', () => {
    expect(renderToString(<WalletConnect address={null} onConnect={noop} onDisconnect={noop} />)).toContain('Connect')
    renderToString(<WalletConnect address={ADDR} onConnect={noop} onDisconnect={noop} />)
  })

  it('BalanceCard (no wallet, wallet, loading balance)', () => {
    renderToString(<BalanceCard address={null} balance={null} onRefresh={noop} />)
    renderToString(<BalanceCard address={ADDR} balance={null} onRefresh={noop} />)
    renderToString(<BalanceCard address={ADDR} balance={42.5} onRefresh={noop} />)
  })

  it('DonateForm (idle, donating, withdrawn)', () => {
    renderToString(<DonateForm address={ADDR} withdrawn={false} isDonating={false} onDonate={noop} />)
    renderToString(<DonateForm address={ADDR} withdrawn={false} isDonating={true} onDonate={noop} />)
    renderToString(<DonateForm address={null} withdrawn={true} isDonating={false} onDonate={noop} />)
  })

  it('EventStream (empty + populated)', () => {
    renderToString(<EventStream events={[]} />)
    const html = renderToString(
      <EventStream
        events={[
          {
            id: 'a:1',
            txHash: 'a'.repeat(64),
            symbols: ['DONATION'],
            amountStroops: 500_000_000n,
            type: 'DONATION',
          },
        ]}
      />
    )
    expect(html).toContain('DONATION_RECEIVED')
  })

  it('DonorList (loading, empty, populated)', () => {
    renderToString(<DonorList donors={[]} address={null} loading={true} />)
    renderToString(<DonorList donors={[]} address={ADDR} loading={false} />)
    const html = renderToString(
      <DonorList donors={[{ address: ADDR, amount: 600_000_000n }]} address={ADDR} loading={false} />
    )
    expect(html).toContain('You')
  })

  it('PoolHero (loading, funded, settled)', () => {
    renderToString(<PoolHero progressPercent={0} total={0n} goal={0n} loading={true} withdrawn={false} />)
    renderToString(<PoolHero progressPercent={72.5} total={725_000_000n} goal={GOAL} loading={false} withdrawn={false} />)
    renderToString(<PoolHero progressPercent={100} total={GOAL} goal={GOAL} loading={false} withdrawn={true} />)
  })

  it('WithdrawPanel (funding, ready, settled, non-admin)', () => {
    const base = { recipients, splitterLocked: null, isWithdrawing: false, onWithdraw: noop }
    renderToString(
      <WithdrawPanel {...base} isAdmin={false} progress={{ total: 100_000_000n, goal: GOAL }} withdrawn={false} />
    )
    // goal met but not admin -> locked message
    renderToString(
      <WithdrawPanel {...base} isAdmin={false} progress={{ total: GOAL, goal: GOAL }} withdrawn={false} />
    )
    // admin + goal met -> withdraw button
    const html = renderToString(
      <WithdrawPanel {...base} isAdmin={true} progress={{ total: GOAL, goal: GOAL }} withdrawn={false} />
    )
    expect(html).toContain('Withdraw')
    // settled state
    renderToString(
      <WithdrawPanel {...base} isAdmin={true} progress={{ total: GOAL, goal: GOAL }} withdrawn={true} />
    )
  })

  it('ConfirmDialog (open with computed shares)', () => {
    const html = renderToString(
      <ConfirmDialog
        open={true}
        totalStroops={GOAL}
        shares={[
          { address: ADDR, amount: 700_000_000n, bpsLabel: '7000 BPS' },
          { address: PROVIDER, amount: 300_000_000n, bpsLabel: '3000 BPS' },
        ]}
        onCancel={noop}
        onConfirm={noop}
      />
    )
    expect(html).toContain('Settle')
    expect(html.replace(/<!-- -->/g, '')).toContain('Settle 100 XLM now?')
  })

  it('TxStatusBanner (all four states)', () => {
    for (const status of ['pending', 'success', 'error', 'info']) {
      renderToString(
        <TxStatusBanner status={status} txHash={'b'.repeat(64)} error="boom" onClose={noop} />
      )
    }
  })

  it('Toast', () => {
    renderToString(<Toast toast={null} />)
    renderToString(<Toast toast={{ type: 'success', message: 'Confirmed' }} />)
  })
})
