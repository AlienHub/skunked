/**
 * Known phishing domains
 * This list will be updated dynamically via crowdsourced defense
 */
export const INITIAL_BLACKLIST: string[] = []

/**
 * Add a domain to the blacklist
 */
export function addToBlacklist(domain: string): void {
  if (!INITIAL_BLACKLIST.includes(domain)) {
    INITIAL_BLACKLIST.push(domain)
  }
}

/**
 * Check if a domain is in the blacklist
 */
export function isBlacklisted(domain: string): boolean {
  return INITIAL_BLACKLIST.some((blocked) => domain.includes(blocked))
}

/**
 * Get all blacklisted domains
 */
export function getBlacklist(): string[] {
  return [...INITIAL_BLACKLIST]
}
