export function sanitizeRedirectTo(value?: string | null): string {
  if (!value?.trim()) {
    return '/groups'
  }

  const redirectTo = value.trim()
  if (!redirectTo.startsWith('/') || redirectTo.startsWith('//')) {
    return '/groups'
  }

  return redirectTo
}
