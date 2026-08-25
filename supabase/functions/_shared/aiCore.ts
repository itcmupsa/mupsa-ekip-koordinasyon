export type AiOperation =
  | 'home_summary'
  | 'page_analysis'
  | 'chat'
  | 'draft'
  | 'calendar_classification'
  | 'awareness_suggestion'
  | 'embedding'

export type AiClaimType = 'fact' | 'inference' | 'recommendation' | 'draft'

export interface AiModelSettings {
  flashModel: string
  flashLiteModel: string
  embeddingModel: string
}

export interface AiSourceDescriptor {
  alias: string
  entityType: string
  entityId: string
  title: string
}

export interface AiClaim {
  text: string
  type: AiClaimType
  sourceRefs: string[]
}

export interface AiResponseEnvelope {
  answer: string
  claims: AiClaim[]
}

export interface AiValidationResult {
  envelope: AiResponseEnvelope | null
  errors: string[]
}

const FLASH_OPERATIONS: ReadonlySet<AiOperation> = new Set([
  'home_summary',
  'page_analysis',
  'chat',
  'draft',
])

const FLASH_LITE_OPERATIONS: ReadonlySet<AiOperation> = new Set([
  'calendar_classification',
  'awareness_suggestion',
])

export function modelForOperation(settings: AiModelSettings, operation: AiOperation): string {
  if (operation === 'embedding') return settings.embeddingModel
  if (FLASH_OPERATIONS.has(operation)) return settings.flashModel
  if (FLASH_LITE_OPERATIONS.has(operation)) return settings.flashLiteModel
  throw new Error('Desteklenmeyen AI işlemi.')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isClaimType(value: unknown): value is AiClaimType {
  return value === 'fact' || value === 'inference' || value === 'recommendation' || value === 'draft'
}

function parseSourceRefs(value: unknown): string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) return null
  return value
}

export function validateAiResponse(
  value: unknown,
  allowedSources: AiSourceDescriptor[],
): AiValidationResult {
  const errors: string[] = []
  if (!isRecord(value)) return { envelope: null, errors: ['AI cevabı nesne biçiminde değil.'] }

  const answer = value.answer
  const rawClaims = value.claims
  if (typeof answer !== 'string' || answer.trim().length === 0) {
    errors.push('AI cevabında geçerli answer alanı yok.')
  }
  if (!Array.isArray(rawClaims)) errors.push('AI cevabında claims dizisi yok.')
  if (errors.length > 0) return { envelope: null, errors }

  const allowedAliases = new Set(allowedSources.map((source) => source.alias))
  const claims: AiClaim[] = []

  for (const [index, rawClaim] of (rawClaims as unknown[]).entries()) {
    if (!isRecord(rawClaim)) {
      errors.push(`İddia ${index + 1} nesne biçiminde değil.`)
      continue
    }

    const text = rawClaim.text
    const type = rawClaim.type
    const sourceRefs = parseSourceRefs(rawClaim.source_refs)
    if (typeof text !== 'string' || text.trim().length === 0 || !isClaimType(type) || !sourceRefs) {
      errors.push(`İddia ${index + 1} gerekli alanları taşımıyor.`)
      continue
    }

    const unknownSources = sourceRefs.filter((sourceRef) => !allowedAliases.has(sourceRef))
    if (unknownSources.length > 0) {
      errors.push(`İddia ${index + 1} izin verilmeyen kaynak kullanıyor.`)
      continue
    }

    if (type !== 'draft' && sourceRefs.length === 0) {
      errors.push(`İddia ${index + 1} kaynak göstermiyor.`)
      continue
    }

    claims.push({ text: text.trim(), type, sourceRefs })
  }

  return {
    envelope: {
      answer: (answer as string).trim(),
      claims,
    },
    errors,
  }
}

export function sourceAliasesAreSafe(sources: AiSourceDescriptor[]): boolean {
  const aliases = sources.map((source) => source.alias)
  return aliases.length === new Set(aliases).size
    && aliases.every((alias) => /^S[1-9][0-9]*$/.test(alias))
}

