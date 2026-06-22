# Microsoft Entra ID Authentication — Design Spec

**Date:** 2026-06-22
**Status:** Approved

## Goal

Restrict access to the GenAI Workshop Next.js 15 app to members of a single, specific Microsoft Entra ID tenant. The tenant hosting the app and the authenticating tenant are different. Hosting target is TBD (Azure), so the implementation must be hosting-agnostic.

---

## Approach

Auth.js v5 (NextAuth beta) with the built-in `MicrosoftEntraID` provider. Configured to target a single tenant. Middleware redirects unauthenticated users directly to Microsoft's login page — no custom sign-in UI. API routes guard themselves by calling `auth()` and returning 401 if no session exists.

---

## Components

### 1. PowerShell Setup Script — `setup-entra-auth.ps1`

A one-shot provisioning script. Run once by the deployer. Does not touch the hosting subscription.

**Parameters:**
- `-TenantId` (required) — the target Entra tenant ID
- `-AppName` (required) — display name for the app registration (e.g. `"GenAI Workshop"`)
- `-ProductionUrl` (optional) — production base URL (e.g. `https://myapp.azurewebsites.net`)
- `-SecretExpiry` (optional, default `P1Y`) — client secret lifetime in ISO 8601 duration

**Steps performed:**
1. `az login --tenant <TenantId> --allow-no-subscriptions` — logs in to the target tenant (no subscription needed for app registrations)
2. Creates an app registration with `signInAudience: AzureADMyOrg` (single tenant)
3. Adds redirect URIs:
   - `http://localhost:3000/api/auth/callback/microsoft-entra-id` (always)
   - `<ProductionUrl>/api/auth/callback/microsoft-entra-id` (if `-ProductionUrl` provided)
4. Adds optional claims: `email`, `family_name`, `given_name`
5. Creates a client secret with the specified expiry
6. Outputs a ready-to-paste `.env.local` block:
   ```
   AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=<tenant-id>
   AUTH_MICROSOFT_ENTRA_ID_ID=<client-id>
   AUTH_MICROSOFT_ENTRA_ID_SECRET=<client-secret>
   AUTH_SECRET=<generate separately>
   ```

**Note:** The script does not store or commit the secret. The user copies it manually.

---

### 2. Auth.js Configuration — `auth.ts` (project root)

```ts
import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      tenantId: process.env.AUTH_MICROSOFT_ENTRA_ID_TENANT_ID!,
    }),
  ],
})
```

Route protection is handled entirely by the middleware (section 4) — no `authorized` callback needed here.

---

### 3. Auth.js HTTP Handler — `src/app/api/auth/[...nextauth]/route.ts`

```ts
import { handlers } from "@/auth"
export const { GET, POST } = handlers
```

Mounts Auth.js's built-in sign-in, callback, sign-out, and session endpoints.

---

### 4. Middleware — `middleware.ts` (project root)

Protects every route. Unauthenticated users are redirected directly to Microsoft's login page (bypasses any Auth.js sign-in page).

```ts
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  if (!req.auth) {
    const signinUrl = new URL(
      `/api/auth/signin/microsoft-entra-id`,
      req.nextUrl.origin
    )
    signinUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(signinUrl)
  }
})

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
}
```

The matcher excludes:
- `/api/auth/*` — the Auth.js endpoints themselves (must be reachable unauthenticated)
- `/_next/*` — Next.js static assets
- `favicon.ico`

---

### 5. API Route Guards — `/api/run` and `/api/grade`

Both existing API routes get a session check at the top of their handler:

```ts
import { auth } from "@/auth"

export async function POST(req: Request) {
  const session = await auth()
  if (!session) return new Response("Unauthorized", { status: 401 })
  // existing handler code ...
}
```

---

### 6. Layout — User Badge

`src/app/layout.tsx` gets a server-side user badge in the header. The `auth()` call runs on the server (no client bundle impact):

```tsx
import { auth, signOut } from "@/auth"

// Inside the layout:
const session = await auth()
// Render: user's name/email + sign-out form button
```

Sign-out uses a `<form action={...}>` with Auth.js's server action — no client component needed.

---

## Environment Variables

| Variable | Description |
|---|---|
| `AUTH_SECRET` | Random secret for signing JWTs/cookies. Generate with `npx auth secret`. |
| `AUTH_MICROSOFT_ENTRA_ID_TENANT_ID` | Target Entra tenant ID |
| `AUTH_MICROSOFT_ENTRA_ID_ID` | App registration client ID |
| `AUTH_MICROSOFT_ENTRA_ID_SECRET` | App registration client secret |

Added to both `.env.local` (with real values, gitignored) and `.env.local.example` (with placeholder values).

---

## Dependencies

One new production dependency:

```
next-auth@beta
```

No other dependencies needed — Auth.js v5 ships the Microsoft Entra ID provider built-in.

---

## Data Flow

```
User visits any page
  → middleware: no session?
    → redirect to /api/auth/signin/microsoft-entra-id?callbackUrl=<page>
      → redirect to Microsoft login (login.microsoftonline.com/<tenantId>)
        → user authenticates with org credentials
          → Microsoft redirects to /api/auth/callback/microsoft-entra-id
            → Auth.js creates encrypted session cookie
              → redirect to original callbackUrl
                → middleware: session exists → allow
```

---

## Out of Scope

- Role or group-based access control (all org members have access)
- Microsoft Graph API calls
- Multi-tenant support
- Token refresh beyond Auth.js defaults
- Azure infrastructure-level auth (Easy Auth) — can be layered on later independently
