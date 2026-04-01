export const STATUS = {
  PENDING:    'PENDING',
  PROCESSING: 'PROCESSING',
  READY:      'READY',
  FAILED:     'FAILED',
  COMPLETED:  'COMPLETED',
}

export const EFFECTS = [
  { value: 'NORMALIZE',       label: 'Normalize' },
  { value: 'REVERB',          label: 'Reverb' },
  { value: 'ECHO',            label: 'Echo' },
  { value: 'PITCH_SHIFT',     label: 'Pitch Shift' },
  { value: 'NOISE_REDUCTION', label: 'Noise Reduction' },
]

export const POLL_INTERVAL_MS = 1000
