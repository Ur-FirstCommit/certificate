# FirstCommit Certificate Portal

A lightweight certificate claim page for participants in the 2026 Beginner’s Paradise Hackathon. Participants verify an email address, enter the name they want printed, and download a participation or award certificate as a PDF.

The interface is a static HTML, CSS, and JavaScript app. Supabase Auth handles email-link verification; a Supabase Edge Function checks private award records and saves the claim. Winner records are never sent to the browser.

## Features

- Email-link verification through Supabase Auth.
- Private, server-side award lookup with a participation certificate fallback.
- PDF certificate generation in the browser.
- Responsive layout, keyboard-accessible controls, reduced-motion support, and live status announcements.
- Apache License 2.0.

## Requirements

- A Supabase project with email authentication enabled.
- The Supabase CLI for applying the database migration and deploying the Edge Function.
- Python 3 or another static HTTP server for local preview.

## Configuration

1. Copy the Supabase project URL and publishable key (or legacy anon key) into `public/config.js`. These are browser-visible values. **Never put a service-role key or Supabase secret key in this file.**
   `.env.example` lists the values and origins used by this project as a reference; the static frontend does not load `.env` files directly.
2. In Supabase Auth settings, enable email sign-in and add the deployed page URL and local preview URL to the allowed redirect URLs. The page redirects back to its current URL after email verification.
3. Set the function’s `ALLOWED_ORIGINS` secret to the exact origins serving the page, separated by commas. For local preview, include `http://localhost:4173`; for production, include the HTTPS origin that hosts this page.
4. Apply the migration and deploy the function:

   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase db push
   supabase secrets set ALLOWED_ORIGINS="https://certificates.example.org,http://localhost:4173"
   supabase functions deploy claim-certificate
   ```

   Supabase injects the default publishable and secret API keys into Edge Functions (and exposes legacy anon/service-role variables when using legacy keys). The function uses those injected values; do not copy privileged keys into frontend configuration.
5. Add winners to `public.certificate_winners` using lowercase email addresses and the award title to print:

   ```sql
   insert into public.certificate_winners (email, award_name)
   values ('participant@example.org', 'Most Creative Project');
   ```

   Keep this table private. The migration enables row-level security and grants no direct access to browser roles. The Edge Function uses its service credential to perform the lookup.

## Local preview

From the repository root, run:

```sh
python3 -m http.server 4173 --directory public
```

Open `http://localhost:4173`. Configure the Supabase project and local redirect/origin values before exercising email claims. Without Supabase configuration, the page displays a setup notice and keeps the claim action disabled.

## Claim flow

1. A participant submits an email address and receives a one-time sign-in link.
2. Supabase verifies the link and returns the participant to the portal.
3. The participant enters the certificate name. The browser invokes `claim-certificate` with the authenticated session.
4. The function validates the user’s verified email, looks up the matching award, and upserts one current claim for that email.
5. The function returns only the claim ID and certificate type (plus the award name when applicable). The browser generates the downloadable PDF.

Each email address has one current claim record. Reclaiming updates the name and certificate details from the current winner list. Winner emails and claim records remain server-side. The static app loads pinned versions of Supabase JS and jsPDF from esm.sh and uses Google Fonts for typography; these services must be reachable by the participant’s browser.

## Project layout

```text
public/                         Static claim page and public Supabase config
public/404.html                 Static-host not-found page
public/not-found.css            404 illustration and responsive layout
public/logo-mark.png            Cropped FirstCommit mascot mark used in the header
supabase/config.toml            Edge Function JWT configuration
supabase/functions/             Authenticated claim endpoint
supabase/migrations/            Private winner and claim tables
```

## License

This project is licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE).

Configure your static host to serve `public/404.html` for unknown paths. Hosts that publish the `public/` directory as the site root generally detect this filename automatically; other hosts may need an explicit not-found document setting.
