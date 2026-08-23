import React from 'react'
import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { PoolHero } from '../components/PoolHero'

describe('PoolHero renders without throwing', () => {
  it('initial loading state', () => {
    const html = renderToString(
      <PoolHero progressPercent={0} total={0n} goal={0n} loading={true} withdrawn={false} />
    )
    expect(html).toContain('Group settlement')
  })

  it('loaded state', () => {
    const html = renderToString(
      <PoolHero progressPercent={100} total={1_000_000_000n} goal={1_000_000_000n} loading={false} withdrawn={true} />
    )
    expect(html).toContain('100.00')
  })
})
