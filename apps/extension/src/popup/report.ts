export function reportUrl(website: string, type: 'coverage-gap' | 'detection-issue', version: string): string {
  const url = new URL(website)
  url.username = url.password = url.search = url.hash = ''
  const prefill = new URLSearchParams({ website: url.href, type, version })
  return `https://opentechcheck.com/report#${prefill}`
}
