export const SITE_ORIGIN = 'https://automataframework.com'
// The framework's repository. While it is private no page may link into it (a visitor would hit GitHub's 404);
// the Owner flips REPOSITORY_PUBLIC when it opens, and `pnpm check:site` then lets those links through.
export const REPOSITORY_URL = 'https://github.com/mcthaydt/automata-framework'
export const REPOSITORY_PUBLIC = false
// One address for questions and one for security reports, no postal address. Both are the project's own address, hello@ on the site's domain.
export const CONTACT_EMAIL = 'hello@automataframework.com'
export const SECURITY_EMAIL = 'hello@automataframework.com'
