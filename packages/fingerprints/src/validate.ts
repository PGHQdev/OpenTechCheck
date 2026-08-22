import { Ajv2020 } from 'ajv/dist/2020'
import schema from '../../../schemas/fingerprint.schema.json'
import categories from '../../../schemas/categories.json'

const ajv = new Ajv2020({ allErrors: true })
const validateSchema = ajv.compile(schema)

export function validateFingerprint(doc: unknown): string[] {
  const errors: string[] = []
  if (!validateSchema(doc)) {
    for (const e of validateSchema.errors ?? []) errors.push(`${e.instancePath} ${e.message}`)
    return errors
  }
  const fp = doc as { category: string; detect: Record<string, unknown> }
  if (!categories.includes(fp.category)) {
    errors.push(`unknown category "${fp.category}" (see schemas/categories.json)`)
  }
  for (const source of ['headers', 'meta'] as const) {
    const table = fp.detect[source] as Record<string, unknown> | undefined
    for (const key of Object.keys(table ?? {})) {
      if (key !== key.toLowerCase()) errors.push(`${source} key "${key}" must be lowercase`)
    }
  }
  return errors
}
