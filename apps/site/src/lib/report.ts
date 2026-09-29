export type ReportType = 'coverage-gap' | 'detection-issue'

export function cleanWebsite(value: string): string {
  const url = new URL(value.trim())
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || value.length > 2048) {
    throw new Error('Enter a website address starting with https:// or http://, without login credentials.')
  }
  url.search = url.hash = ''
  if (url.href.length > 2048) throw new Error('The website address is too long.')
  return url.href
}

export interface Report {
  id: string
  website: string
  type: ReportType
  extensionVersion: string
  details: string
  email: string
}

export function parseReport(input: unknown): Report {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid report.')
  const data = input as Record<string, unknown>
  const keys = ['id', 'website', 'type', 'extensionVersion', 'details', 'email']
  if (Object.keys(data).some((key) => !keys.includes(key)) || keys.some((key) => typeof data[key] !== 'string')) {
    throw new Error('Invalid report fields.')
  }
  const report = data as unknown as Report
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(report.id)) throw new Error('Invalid report ID.')
  if (!['coverage-gap', 'detection-issue'].includes(report.type)) throw new Error('Invalid report type.')
  if (report.extensionVersion && !/^\d+(?:\.\d+){0,3}$/.test(report.extensionVersion)) throw new Error('Invalid extension version.')
  if (report.extensionVersion.length > 32 || report.details.length > 3000) throw new Error('Report is too long.')
  const email = report.email.trim()
  if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Enter a valid email address or leave it blank.')
  let website: string
  try { website = cleanWebsite(report.website) } catch { throw new Error('Enter a valid http:// or https:// website address without login credentials.') }
  return { ...report, website, email, details: report.details.trim() }
}
