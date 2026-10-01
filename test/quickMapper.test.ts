import { expect } from 'chai'
import { QuickMapper, QuickMessage } from '../src/quickMapper'

const QUICK_MESSAGE: QuickMessage = {
  pgn: 0x6c0,
  src: 12,
  dst: 255,
  prio: 0,
  timestamp: '2026-01-01T00:00:00.000Z',
  protocol: 'quick',
  fields: { sourceAddress: 12, flags: '01 02 03 04 05 06' }
}

describe('QuickMapper', () => {
  it('produces a delta with QuickPCS source metadata', () => {
    const mapper = new QuickMapper()
    const delta = mapper.toDelta(QUICK_MESSAGE)

    expect(delta.updates).to.have.length(1)
    const update = delta.updates[0]!
    expect(update.source.type).to.equal('QuickPCS')
    expect(update.source.pgn).to.equal(0x6c0)
    expect(update.source.src).to.equal('12')
    expect(update.timestamp).to.equal('2026-01-01T00:00:00.000Z')
  })

  it('emits no values for messages without a path mapping', () => {
    const mapper = new QuickMapper()
    const delta = mapper.toDelta(QUICK_MESSAGE)

    expect(delta.updates[0]!.values).to.be.an('array').that.is.empty
  })

  it('coerces a numeric-string src to a string ref', () => {
    const mapper = new QuickMapper()
    const delta = mapper.toDelta({ ...QUICK_MESSAGE, src: '12' })

    expect(delta.updates[0]!.source.src).to.equal('12')
  })
})

describe('QuickMapper chain count (0x6c1)', () => {
  const chainMessage = (overrides: Partial<QuickMessage>): QuickMessage => ({
    pgn: 0x6c1,
    src: 0x18c1,
    dst: 255,
    prio: 0,
    timestamp: '2026-01-01T00:00:00.000Z',
    protocol: 'quick',
    fields: { chainDeployed: 107, units: 'feet' },
    ...overrides
  })

  it('maps deployed chain to navigation.anchor.rodeDeployed', () => {
    const mapper = new QuickMapper()
    const delta = mapper.toDelta(chainMessage({}))

    expect(delta.updates[0]!.values).to.have.length(1)
    expect(delta.updates[0]!.values[0]!.path).to.equal(
      'navigation.anchor.rodeDeployed'
    )
  })

  it('converts feet to metres', () => {
    const mapper = new QuickMapper()
    const delta = mapper.toDelta(
      chainMessage({ fields: { chainDeployed: 107, units: 'feet' } })
    )

    expect(delta.updates[0]!.values[0]!.value).to.be.closeTo(
      107 * 0.3048,
      1e-9
    )
  })

  it('passes metres through unchanged', () => {
    const mapper = new QuickMapper()
    const delta = mapper.toDelta(
      chainMessage({ fields: { chainDeployed: 107, units: 'metres' } })
    )

    expect(delta.updates[0]!.values[0]!.value).to.equal(107)
  })

  it('emits no values when chainDeployed is absent', () => {
    const mapper = new QuickMapper()
    const delta = mapper.toDelta(chainMessage({ fields: { units: 'feet' } }))

    expect(delta.updates[0]!.values).to.be.an('array').that.is.empty
  })
})
