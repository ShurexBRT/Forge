# Forge Supabase Auth: production URL and password recovery

This GitHub Pages application is hosted at:

- Site URL: `https://shurexbrt.github.io/Forge/`
- Password recovery callback: `https://shurexbrt.github.io/Forge/?auth=recovery`

## Required one-time Supabase Dashboard configuration

In the **Forge** Supabase project `yljhffprkprbgjdaarqi`, open
[Authentication → URL Configuration](https://supabase.com/dashboard/project/yljhffprkprbgjdaarqi/auth/url-configuration).

1. Set **Site URL** to `https://shurexbrt.github.io/Forge/`.
2. Add these **Redirect URLs**:
   - `https://shurexbrt.github.io/Forge/`
   - `https://shurexbrt.github.io/Forge/?auth=recovery`
3. Save the configuration. Remove the production dependency on `localhost:3000`.
4. In **Authentication → Email Templates → Reset Password**, keep the default
   `{{ .ConfirmationURL }}` link for standard Supabase-hosted email verification.
   If the template uses a custom URL, verify that it respects `{{ .RedirectTo }}`
   instead of hardcoding `{{ .SiteURL }}` or localhost.

Note: These settings cannot be changed by modifying `supabase/schema.sql` or
front-end Vite environment variables. They are managed by Supabase Auth.

## End-to-end flow

1. Log out; visit `https://shurexbrt.github.io/Forge/`.
2. Select **Forgot password?**, enter an existing account email, then select **Send reset link**.
3. Open the **newest** recovery email. Older links generated before the URL configuration
   change may still contain `localhost:3000`; do not use them.
4. After verification, the browser returns to the Forge page with `?auth=recovery`.
5. Forge displays **Choose a new password**, with New password and Confirm password inputs.
6. Save a valid matching password. Forge signs out the temporary recovery session and
   prompts you to sign in with the new password.
7. Confirm that login works. Confirm invalid/expired recovery links show a clear error
   and allow another reset request.

## Troubleshooting

- Redirect still lands on localhost: check Site URL, Redirect URL allowlist, and the
  Recovery email template; request a *new* link after fixing settings.
- `Failed to fetch`: check whether the Forge Supabase project is
  `ACTIVE_HEALTHY` and whether the browser can reach Supabase.
- `Auth session missing` or token expired: request a fresh link; do not paste
  tokens or full password-reset URLs into tickets/screenshots.
- GitHub Pages must remain at the `/Forge/` path; the hostname root is not the app.
