type Json = Record<string, unknown>

export function mergeManifest(base: Json, overlay: Json): Json {
  const out: Json = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    const prev = out[key]
    if (
      value !== null && typeof value === 'object' && !Array.isArray(value) &&
      prev !== null && typeof prev === 'object' && !Array.isArray(prev)
    ) {
      out[key] = mergeManifest(prev as Json, value as Json)
    } else {
      out[key] = value
    }
  }
  return out
}
