// Ruken serves games under CSP with no 'unsafe-eval'. Zod must run in jitless mode
// to avoid probing for `new Function`, which triggers a securitypolicyviolation event.
import { config } from 'zod'

config({ jitless: true })
