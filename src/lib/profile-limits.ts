// Profile field limits, shared by the form (live counters) and the server (which rejects, never silently cuts).
export const PROFILE_LIMITS = { name: 80, headline: 120, location: 80, bio: 500, url: 200, interests: 450 } as const;
