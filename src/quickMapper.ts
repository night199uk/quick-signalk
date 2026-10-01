import { EventEmitter } from 'events'

export interface QuickMessage {
  pgn: number
  src: number | string
  dst?: number
  prio?: number
  timestamp: string
  protocol: 'quick'
  fields?: Record<string, unknown>
}

export interface QuickSource {
  label: string
  type: string
  pgn: number
  src: string
}

export interface QuickDeltaValue {
  path: string
  value: unknown
}

export interface QuickDelta {
  context?: string
  updates: Array<{
    source: QuickSource
    timestamp?: string
    values: QuickDeltaValue[]
  }>
}

export type QuickMapperOptions = Record<string, unknown>

/** Quick CAN ID for the chain count packet (deployed anchor chain length). */
const CHAIN_COUNT_CAN_ID = 0x6c1

/** International feet to metres. Signal K stores all lengths in metres. */
const FEET_TO_METRES = 0.3048

/**
 * Maps Quick Proportional Control Systems (PCS) CAN messages to Signal K
 * deltas.
 *
 * The Quick protocol uses standard 11-bit CAN IDs with direct mapping and
 * little-endian payloads; the source address is carried in the first uint16
 * of the payload rather than in the CAN ID. canboatjs parses these frames
 * into a `QuickMessage` (the CAN ID as `pgn`, with `protocol: 'quick'`), and
 * this mapper turns each message into a Signal K delta.
 */
export class QuickMapper extends EventEmitter {
  private readonly options: QuickMapperOptions

  constructor(options: QuickMapperOptions = {}) {
    super()
    this.options = options
  }

  /**
   * Convert a parsed Quick message into a Signal K delta.
   *
   * The timestamp format from canboatjs is ISO 8601 with a `T` separator
   * (e.g. `2026-01-01T00:00:00.000Z`), matching the Signal K convention
   * directly, so no reformatting is required.
   */
  toDelta(quick: QuickMessage): QuickDelta {
    const values = this.toValues(quick)

    return {
      updates: [
        {
          source: {
            label: '',
            type: 'QuickPCS',
            pgn: Number(quick.pgn),
            src: quick.src.toString()
          },
          timestamp: quick.timestamp,
          values
        }
      ]
    }
  }

  private toValues(quick: QuickMessage): QuickDeltaValue[] {
    if (Number(quick.pgn) !== CHAIN_COUNT_CAN_ID || !quick.fields) {
      return []
    }

    const chainDeployed = quick.fields.chainDeployed
    if (typeof chainDeployed !== 'number') {
      return []
    }

    // The wire value is in the units indicated by the sibling field. Signal K
    // always stores lengths in metres, so convert feet before emitting.
    const metres =
      quick.fields.units === 'feet'
        ? chainDeployed * FEET_TO_METRES
        : chainDeployed

    return [{ path: 'navigation.anchor.rodeDeployed', value: metres }]
  }
}
