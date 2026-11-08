# Repository guidance

## Project

This repository contains the FirstCommit certificate claim page for the 2026 Beginner’s Paradise Hackathon. The frontend is a small static HTML, CSS, and JavaScript app in `public/`; Supabase Auth and the `claim-certificate` Edge Function handle verification and certificate eligibility.

## Implementation

- Preserve the dependency-light static deployment model unless a feature requires a build step.
- Keep claim UI states accessible: use semantic forms and labels, visible keyboard focus, `aria-live` status feedback, and respect `prefers-reduced-motion`.
- Do not put winner records, service-role credentials, or other privileged data in `public/`. The browser may contain only the Supabase project URL and publishable/anon key.
- Authenticate claim requests and resolve award eligibility in the Edge Function. Keep the winner table and claim records unavailable to `anon` and `authenticated` database roles.
- Validate all data on the server even when equivalent browser-side checks exist. Avoid logging email addresses, names, access tokens, or other personal claim data.
- Keep winner emails normalized to lowercase and trim surrounding whitespace. Keep one claim record per verified email address.
- Do not add new runtime dependencies without documenting their purpose, versioning, and deployment impact.

## Visual direction

Follow [DESIGN.md](DESIGN.md). The page should feel clear, celebratory, and credible for young builders, with restrained cool ambient light in the background. Use the supplied image as a mood reference only; do not reproduce its composition, typography, wording, or exact gradients.

## Documentation and license

Keep setup, configuration, deployment, data handling, and contribution instructions current in `README.md` and `CONTRIBUTING`. This project is licensed under Apache-2.0; preserve the license and required notices.
