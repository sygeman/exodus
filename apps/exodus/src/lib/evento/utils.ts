/**
 * Check if a string contains wildcard characters
 */
export function isWildcard(pattern: string): boolean {
  return pattern.includes("*")
}

/**
 * Split event name or pattern into segments
 */
export function splitSegments(name: string): string[] {
  return name.split(":")
}

/**
 * Match event segments against pattern segments
 * Supports: * (single segment) and ** (any segments)
 */
export function matchPattern(eventSegments: string[], patternSegments: string[]): boolean {
  let eventIdx = 0
  let patternIdx = 0

  while (patternIdx < patternSegments.length) {
    const patternSeg = patternSegments[patternIdx]

    if (patternSeg === "**") {
      // ** matches any remaining segments
      if (patternIdx === patternSegments.length - 1) {
        // ** at the end matches everything
        return true
      }

      // Look ahead to find where to continue matching
      const nextPatternSeg = patternSegments[patternIdx + 1]
      while (eventIdx < eventSegments.length) {
        if (
          nextPatternSeg === "*" ||
          nextPatternSeg === "**" ||
          eventSegments[eventIdx] === nextPatternSeg
        ) {
          break
        }
        eventIdx++
      }

      patternIdx++
    } else if (patternSeg === "*") {
      // * matches exactly one segment
      if (eventIdx >= eventSegments.length) {
        return false
      }
      eventIdx++
      patternIdx++
    } else {
      // Exact match required
      if (eventIdx >= eventSegments.length || eventSegments[eventIdx] !== patternSeg) {
        return false
      }
      eventIdx++
      patternIdx++
    }
  }

  // All pattern segments consumed, check if all event segments consumed too
  return eventIdx === eventSegments.length
}
