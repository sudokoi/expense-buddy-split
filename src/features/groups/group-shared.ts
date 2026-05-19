export type GroupRole = 'owner' | 'member'
export type SplitMode = 'equal' | 'fixed' | 'percentage'

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const maxSlugLength = 48

function slugifyGroupInput(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

function trimSlugLength(slug: string, maxLength = maxSlugLength) {
  return slug.slice(0, maxLength).replace(/-+$/g, '')
}

export function normalizeGroupSlug(input: string) {
  const slug = trimSlugLength(slugifyGroupInput(input))

  if (!slug) {
    throw new Error('Enter a group slug.')
  }

  if (slug.length < 3 || slug.length > 48 || !slugPattern.test(slug)) {
    throw new Error(
      'Use a slug between 3 and 48 characters with lowercase letters, numbers, and hyphens.',
    )
  }

  return slug
}

export function buildSuggestedGroupSlug(input: string, sequence = 1) {
  let slug = trimSlugLength(slugifyGroupInput(input))

  if (!slug) {
    slug = 'group'
  }

  if (slug.length < 3) {
    slug = trimSlugLength(`${slug}-group`)
  }

  if (sequence > 1) {
    const suffix = `-${sequence}`
    const base = trimSlugLength(slug, maxSlugLength - suffix.length) || 'group'
    slug = `${base}${suffix}`
  }

  return normalizeGroupSlug(slug)
}

export function parseAmountInputToMinorUnits(input: string) {
  const value = input.trim()

  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error('Enter a valid amount with up to 2 decimal places.')
  }

  const [wholePart, fractionPart = ''] = value.split('.')
  const minorUnits =
    Number.parseInt(wholePart, 10) * 100 +
    Number.parseInt(fractionPart.padEnd(2, '0'), 10)

  if (!Number.isSafeInteger(minorUnits) || minorUnits <= 0) {
    throw new Error('Amount must be greater than zero.')
  }

  return minorUnits
}

export function parsePercentageInputToBasisPoints(input: string) {
  const value = input.trim()

  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    throw new Error('Enter percentages with up to 2 decimal places.')
  }

  const [wholePart, fractionPart = ''] = value.split('.')
  const basisPoints =
    Number.parseInt(wholePart, 10) * 100 +
    Number.parseInt(fractionPart.padEnd(2, '0'), 10)

  if (!Number.isSafeInteger(basisPoints) || basisPoints <= 0) {
    throw new Error('Percentages must be greater than zero.')
  }

  return basisPoints
}

export function formatMinorAmount(amountMinor: number, currencyCode = 'INR') {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 2,
  }).format(amountMinor / 100)
}

export function formatDateTime(date: string | number | Date) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(date))
}

export function formatDateOnly(date: string | number | Date) {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
  }).format(new Date(date))
}

export function distributeEqualShares(
  amountMinor: number,
  participantIds: string[],
) {
  if (!participantIds.length) {
    throw new Error('Select at least one participant.')
  }

  const baseShare = Math.floor(amountMinor / participantIds.length)
  let remainder = amountMinor - baseShare * participantIds.length

  return participantIds.map((userId) => {
    const share = baseShare + (remainder > 0 ? 1 : 0)
    remainder = Math.max(0, remainder - 1)

    return {
      userId,
      amountMinor: share,
      percentageBasisPoints: null,
    }
  })
}

export function ensureUniqueValues(values: string[], errorMessage: string) {
  const uniqueValues = Array.from(new Set(values))

  if (uniqueValues.length !== values.length) {
    throw new Error(errorMessage)
  }

  return uniqueValues
}

export function buildFixedShares(
  amountMinor: number,
  valuesByUserId: Record<string, string>,
) {
  const entries = Object.entries(valuesByUserId).filter(([, value]) =>
    value.trim(),
  )
  if (!entries.length) {
    throw new Error('Add at least one participant share.')
  }

  const shares = entries.map(([userId, value]) => ({
    userId,
    amountMinor: parseAmountInputToMinorUnits(value),
    percentageBasisPoints: null,
  }))

  const total = shares.reduce((sum, share) => sum + share.amountMinor, 0)
  if (total !== amountMinor) {
    throw new Error(
      'Fixed participant amounts must match the total expense amount.',
    )
  }

  return shares
}

export function buildExpensePayers(
  amountMinor: number,
  valuesByUserId?: Record<string, string>,
  fallbackUserId?: string,
) {
  const entries = Object.entries(valuesByUserId || {}).filter(([, value]) =>
    value.trim(),
  )

  if (!entries.length) {
    if (!fallbackUserId) {
      throw new Error('Add at least one payer.')
    }

    return [
      {
        userId: fallbackUserId,
        amountMinor,
      },
    ]
  }

  const payers = entries.map(([userId, value]) => ({
    userId,
    amountMinor: parseAmountInputToMinorUnits(value),
  }))

  const total = payers.reduce((sum, payer) => sum + payer.amountMinor, 0)
  if (total !== amountMinor) {
    throw new Error('Payer amounts must add up to the total expense amount.')
  }

  return payers
}

export function buildPercentageShares(
  amountMinor: number,
  valuesByUserId: Record<string, string>,
) {
  const entries = Object.entries(valuesByUserId).filter(([, value]) =>
    value.trim(),
  )
  if (!entries.length) {
    throw new Error('Add at least one participant percentage.')
  }

  const basisPointEntries = entries.map(([userId, value]) => ({
    userId,
    basisPoints: parsePercentageInputToBasisPoints(value),
  }))

  const totalBasisPoints = basisPointEntries.reduce(
    (sum, entry) => sum + entry.basisPoints,
    0,
  )
  if (totalBasisPoints !== 10_000) {
    throw new Error('Participant percentages must add up to 100%.')
  }

  let allocated = 0

  return basisPointEntries.map((entry, index) => {
    const isLastParticipant = index === basisPointEntries.length - 1
    const amountForParticipant = isLastParticipant
      ? amountMinor - allocated
      : Math.floor((amountMinor * entry.basisPoints) / 10_000)

    allocated += amountForParticipant

    return {
      userId: entry.userId,
      amountMinor: amountForParticipant,
      percentageBasisPoints: entry.basisPoints,
    }
  })
}

export function ensureIsoDate(input: string | undefined) {
  if (!input) {
    return new Date()
  }

  const parsed = new Date(`${input}T12:00:00.000Z`)
  if (Number.isNaN(parsed.valueOf())) {
    throw new Error('Choose a valid date.')
  }

  return parsed
}
