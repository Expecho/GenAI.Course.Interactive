# Microsoft Entra ID Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lock the GenAI Workshop app behind Microsoft Entra ID single-org sign-in using Auth.js v5, with a PowerShell script to provision the app registration.

**Architecture:** Auth.js v5 wraps the Microsoft Entra ID OAuth2/OIDC flow. A `middleware.ts` at the project root intercepts all page requests and redirects unauthenticated users directly to Microsoft login. API routes (`/api/run`, `/api/grade`) call `auth()` directly and return 401 to unauthenticated callers. The layout renders a server-side user badge once signed in.

**Tech Stack:** Next.js 15 App Router, Auth.js v5 (`next-auth@beta`), Microsoft Entra ID provider (built-in), Tailwind CSS, Azure CLI (PowerShell provisioning script only).

## Global Constraints

- Node.js runtime required (`export const runtime = "nodejs"` already set on API routes — do not remove it)
- `@/` path alias resolves to `./src/` per `tsconfig.json` — use it for all cross-file imports
- Auth config lives at `src/auth.ts` (importable as `@/auth`)
- `middleware.ts` must be at the project root (Next.js requirement)
- No test framework is installed — verification steps use `npm run typecheck`, `npm run build`, and manual browser testing
- Do not commit secrets — `.env.local` is gitignored

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/auth.ts` | Auth.js config: provider, exports |
| Create | `src/app/api/auth/[...nextauth]/route.ts` | Mounts Auth.js HTTP handlers |
| Create | `middleware.ts` | Protects page routes, redirects to Microsoft |
| Modify | `src/app/api/run/route.ts` | Add 401 guard at top of POST |
| Modify | `src/app/api/grade/route.ts` | Add 401 guard at top of POST |
| Modify | `src/app/layout.tsx` | Make async, add user badge + sign-out |
| Modify | `.env.local.example` | Add auth env var placeholders |
| Create | `setup-entra-auth.ps1` | Provisions app registration via Azure CLI |

---

## Task 1: Install dependency and create Auth.js config

**Files:**
- Create: `src/auth.ts`

**Interfaces:**
- Produces: `auth`, `handlers`, `signIn`, `signOut` — all used by Tasks 2, 3, 5, 6

- [ ] **Step 1: Install next-auth**

```bash
npm install next-auth@beta
```

Expected: package added to `node_modules`, `package.json` updated with `"next-auth": "^5.x.x"`.

- [ ] **Step 2: Create `src/auth.ts`**

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

- [ ] **Step 3: Type-check**

```bash
npm run typecheck
```

Expected: no errors. (Auth.js types are covered by `skipLibCheck: true`.)

- [ ] **Step 4: Commit**

```bash
git add src/auth.ts package.json package-lock.json
git commit -m "feat: add Auth.js v5 with Microsoft Entra ID provider"
```

---

## Task 2: Mount Auth.js HTTP handler

**Files:**
- Create: `src/app/api/auth/[...nextauth]/route.ts`

**Interfaces:**
- Consumes: `handlers` from `@/auth` → `{ GET, POST }`

- [ ] **Step 1: Create the directory and route file**

Create `src/app/api/auth/[...nextauth]/route.ts`:

```ts
import { handlers } from "@/auth"

export const { GET, POST } = handlers
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add "src/app/api/auth/[...nextauth]/route.ts"
git commit -m "feat: mount Auth.js HTTP handler at /api/auth"
```

---

## Task 3: Add middleware for route protection

**Files:**
- Create: `middleware.ts` (project root)

**Interfaces:**
- Consumes: `auth` from `@/auth`

The middleware runs only on page routes. All `/api/*` routes are excluded from the matcher — they handle auth themselves (Task 5). Unauthenticated page visitors are redirected directly to the Microsoft sign-in URL, bypassing the Auth.js sign-in page.

- [ ] **Step 1: Create `middleware.ts` at the project root**

```ts
import { auth } from "@/auth"
import { NextResponse } from "next/server"

export default auth((req) => {
  if (!req.auth) {
    const signinUrl = new URL(
      "/api/auth/signin/microsoft-entra-id",
      req.nextUrl.origin
    )
    signinUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(signinUrl)
  }
})

export const config = {
  // Exclude: all /api/* routes, Next.js internals, favicon
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add middleware to protect page routes with Entra ID auth"
```

---

## Task 4: Update environment variable files

**Files:**
- Modify: `.env.local.example`
- Modify: `.env.local` (add placeholder lines only — no real values committed)

- [ ] **Step 1: Append auth vars to `.env.local.example`**

Open `.env.local.example` and append the following block at the end:

```
# Microsoft Entra ID authentication (Auth.js v5)
# Run setup-entra-auth.ps1 to create the app registration and get these values.
# Generate AUTH_SECRET with: npx auth secret
AUTH_SECRET=your-auth-secret-here
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=your-tenant-id
AUTH_MICROSOFT_ENTRA_ID_ID=your-client-id
AUTH_MICROSOFT_ENTRA_ID_SECRET=your-client-secret
```

- [ ] **Step 2: Add placeholder lines to your local `.env.local`**

Open `.env.local` (not committed) and add these lines (fill in real values after running `setup-entra-auth.ps1`):

```
AUTH_SECRET=
AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=
AUTH_MICROSOFT_ENTRA_ID_ID=
AUTH_MICROSOFT_ENTRA_ID_SECRET=
```

- [ ] **Step 3: Commit the example file only**

```bash
git add .env.local.example
git commit -m "chore: add Entra ID auth env var placeholders to example file"
```

---

## Task 5: Guard API routes with auth checks

**Files:**
- Modify: `src/app/api/run/route.ts` — add 401 guard at top of `POST`
- Modify: `src/app/api/grade/route.ts` — add 401 guard at top of `POST`

**Interfaces:**
- Consumes: `auth` from `@/auth` → `() => Promise<Session | null>`

- [ ] **Step 1: Guard `/api/run`**

In `src/app/api/run/route.ts`, add the import and guard at the top of the `POST` function. The existing function signature changes from `POST(req: NextRequest)` to include the session check before any other logic:

```ts
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import {
  createClient,
  getDeployment,
  getEmbeddingDeployment,
  getImageDeployment,
  getReasoningDeployment,
  toV1BaseURL,
} from "@/lib/azureClient";
import { runSandbox, type FoundryCreds, type SandboxEvent } from "@/lib/sandbox";

// The sandbox uses node:worker_threads + esbuild, so this must run on Node.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function readCreds(): FoundryCreds {
  createClient();
  return {
    baseURL: toV1BaseURL(process.env.AZURE_AI_FOUNDRY_ENDPOINT!),
    apiKey: process.env.AZURE_OPENAI_API_KEY!,
    deployment: getDeployment(),
    embeddingDeployment: getEmbeddingDeployment(),
    imageDeployment: getImageDeployment(),
    reasoningDeployment: getReasoningDeployment(),
  };
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  let code: string;
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
  } catch {
    return new Response("Invalid JSON body", { status: 400 });
  }

  if (!code.trim()) {
    return new Response("No code provided", { status: 400 });
  }

  let creds: FoundryCreds;
  try {
    creds = readCreds();
  } catch (err) {
    const message = (err as Error).message;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(sse({ type: "error", message }));
        controller.close();
      },
    });
    return sseResponse(stream);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (event: SandboxEvent) => {
        controller.enqueue(encoder.encode(toSse(event)));
      };
      try {
        await runSandbox(code, creds, enqueue);
      } catch (err) {
        enqueue({ type: "error", message: (err as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return sseResponse(stream);
}

function toSse(event: SandboxEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function sse(event: SandboxEvent): Uint8Array {
  return new TextEncoder().encode(toSse(event));
}

function sseResponse(stream: ReadableStream): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Guard `/api/grade`**

In `src/app/api/grade/route.ts`, add the import and guard at the top of `POST`:

```ts
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { createClient, getDeployment } from "@/lib/azureClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return new Response("Unauthorized", { status: 401 });

  let question = "";
  let rubric = "";
  let answer = "";
  try {
    const body = await req.json();
    question = String(body?.question ?? "");
    rubric = String(body?.rubric ?? "");
    answer = String(body?.answer ?? "");
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!answer.trim()) {
    return Response.json({ correct: false, feedback: "No answer provided." });
  }

  let client;
  try {
    client = createClient();
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }

  try {
    const res = await client.responses.create({
      model: getDeployment(),
      temperature: 0,
      input: [
        {
          role: "system",
          content:
            "You grade a learner's short answer to a concept question. " +
            "Decide whether the answer satisfies the grading criteria. Be lenient about " +
            "wording and synonyms; judge the meaning, not the exact phrasing. " +
            'Respond with ONLY compact JSON, no prose: {"correct": boolean, "feedback": string}. ' +
            "`feedback` is one short, friendly sentence explaining the verdict.",
        },
        {
          role: "user",
          content: `QUESTION:\n${question}\n\nGRADING CRITERIA:\n${rubric}\n\nLEARNER ANSWER:\n${answer}`,
        },
      ],
    });

    const text = res.output_text ?? "";
    const verdict = parseVerdict(text);
    return Response.json(verdict);
  } catch (err) {
    return Response.json({ error: (err as Error).message }, { status: 502 });
  }
}

function parseVerdict(text: string): { correct: boolean; feedback: string } {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end > start) {
    try {
      const obj = JSON.parse(text.slice(start, end + 1));
      return {
        correct: !!obj.correct,
        feedback: typeof obj.feedback === "string" ? obj.feedback : "",
      };
    } catch {
      /* fall through */
    }
  }
  return { correct: false, feedback: "Could not grade the answer — please try again." };
}
```

- [ ] **Step 3: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/run/route.ts src/app/api/grade/route.ts
git commit -m "feat: guard /api/run and /api/grade with 401 when unauthenticated"
```

---

## Task 6: Add user badge to layout

**Files:**
- Modify: `src/app/layout.tsx`

**Interfaces:**
- Consumes: `auth` → `Session | null`, `signOut` → server action — both from `@/auth`
- `session.user.name` — string | null | undefined
- `session.user.email` — string | null | undefined

The layout becomes async so it can call `auth()` server-side. A thin header bar shows the signed-in user's display name (falling back to email) and a sign-out button. Sign-out is a plain HTML form with an inline server action — no client component needed.

- [ ] **Step 1: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import { auth, signOut } from "@/auth";

export const metadata: Metadata = {
  title: "GenAI Workshop",
  description: "Hands-on, web-based GenAI workshop — edit code and watch it run live.",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className="h-full antialiased">
        <ThemeProvider>
          {session?.user && (
            <div className="flex items-center justify-end gap-4 px-4 py-2 text-sm border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <span className="text-gray-600 dark:text-gray-400">
                {session.user.name ?? session.user.email}
              </span>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button
                  type="submit"
                  className="text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-100 transition-colors"
                >
                  Sign out
                </button>
              </form>
            </div>
          )}
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Build check**

```bash
npm run build
```

Expected: successful build. (This catches issues `typecheck` alone misses, like missing server action directives.)

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: add server-side user badge and sign-out to layout"
```

---

## Task 7: Create PowerShell provisioning script

**Files:**
- Create: `setup-entra-auth.ps1` (project root)

This script is run once by the deployer before starting the app. It logs into the target tenant (which may differ from the Azure subscription tenant) and creates everything the app needs.

- [ ] **Step 1: Create `setup-entra-auth.ps1`**

```powershell
#Requires -Version 7.0
<#
.SYNOPSIS
    Creates a Microsoft Entra ID app registration for the GenAI Workshop.
.DESCRIPTION
    Logs in to the specified tenant, creates an app registration with the correct
    redirect URIs and optional claims, and outputs the .env.local block to copy.
    Does not require an Azure subscription — only Entra ID tenant access.
.EXAMPLE
    .\setup-entra-auth.ps1 -TenantId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" -AppName "GenAI Workshop"
.EXAMPLE
    .\setup-entra-auth.ps1 -TenantId "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" -AppName "GenAI Workshop" `
        -ProductionUrl "https://myapp.azurewebsites.net" -SecretExpiryYears 2
#>
param(
    [Parameter(Mandatory = $true)]
    [string]$TenantId,

    [Parameter(Mandatory = $true)]
    [string]$AppName,

    [string]$ProductionUrl = "",

    [int]$SecretExpiryYears = 1
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Login ──────────────────────────────────────────────────────────────────────
Write-Host "Logging in to tenant $TenantId..." -ForegroundColor Cyan
az login --tenant $TenantId --allow-no-subscriptions
if ($LASTEXITCODE -ne 0) { throw "az login failed" }

# ── Create app registration ────────────────────────────────────────────────────
Write-Host "Creating app registration '$AppName'..." -ForegroundColor Cyan
$app = az ad app create `
    --display-name $AppName `
    --sign-in-audience AzureADMyOrg `
    | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Failed to create app registration" }

$clientId = $app.appId
Write-Host "  App ID: $clientId" -ForegroundColor Green

# ── Redirect URIs ──────────────────────────────────────────────────────────────
$callbackPath = "/api/auth/callback/microsoft-entra-id"
$redirectUris = @("http://localhost:3000$callbackPath")
if ($ProductionUrl) {
    $productionUri = $ProductionUrl.TrimEnd("/") + $callbackPath
    $redirectUris += $productionUri
    Write-Host "  Adding production redirect: $productionUri" -ForegroundColor Cyan
}

Write-Host "Setting redirect URIs..." -ForegroundColor Cyan
az ad app update --id $clientId --web-redirect-uris @redirectUris
if ($LASTEXITCODE -ne 0) { throw "Failed to set redirect URIs" }

# ── Optional claims (email + name on ID token) ─────────────────────────────────
Write-Host "Adding optional claims (email, given_name, family_name)..." -ForegroundColor Cyan
$claimsFile = [System.IO.Path]::GetTempFileName()
@{
    accessToken = @()
    saml2Token  = @()
    idToken     = @(
        @{ name = "email";       essential = $false }
        @{ name = "given_name";  essential = $false }
        @{ name = "family_name"; essential = $false }
    )
} | ConvertTo-Json -Depth 5 | Set-Content -Path $claimsFile -Encoding UTF8

az ad app update --id $clientId --optional-claims "@$claimsFile"
if ($LASTEXITCODE -ne 0) {
    Remove-Item $claimsFile -Force
    throw "Failed to set optional claims"
}
Remove-Item $claimsFile -Force

# ── Service principal ──────────────────────────────────────────────────────────
Write-Host "Creating service principal..." -ForegroundColor Cyan
az ad sp create --id $clientId | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Failed to create service principal" }

# ── Client secret ──────────────────────────────────────────────────────────────
$endDate = (Get-Date).AddYears($SecretExpiryYears).ToString("yyyy-MM-dd")
Write-Host "Creating client secret (expires $endDate)..." -ForegroundColor Cyan
$secretResult = az ad app credential reset `
    --id $clientId `
    --append `
    --end-date $endDate `
    | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Failed to create client secret" }

$clientSecret = $secretResult.password

# ── Output ─────────────────────────────────────────────────────────────────────
Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host " App registration complete. Copy this into your .env.local:" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "AUTH_MICROSOFT_ENTRA_ID_TENANT_ID=$TenantId"
Write-Host "AUTH_MICROSOFT_ENTRA_ID_ID=$clientId"
Write-Host "AUTH_MICROSOFT_ENTRA_ID_SECRET=$clientSecret"
Write-Host "AUTH_SECRET=  # generate with: npx auth secret"
Write-Host ""
Write-Host "WARNING: The client secret above will not be shown again. Copy it now." -ForegroundColor Yellow
```

- [ ] **Step 2: Verify the script has no syntax errors**

```powershell
pwsh -NoProfile -Command "& { . .\setup-entra-auth.ps1 -? }"
```

Expected: shows the synopsis/help text without errors.

- [ ] **Step 3: Commit**

```bash
git add setup-entra-auth.ps1
git commit -m "feat: add PowerShell script to provision Entra ID app registration"
```

---

## Task 8: End-to-end verification

This task wires up real credentials and verifies the full auth flow in a browser.

- [ ] **Step 1: Run the provisioning script**

```powershell
.\setup-entra-auth.ps1 `
    -TenantId "<your-tenant-id>" `
    -AppName "GenAI Workshop" `
    -ProductionUrl "https://your-production-url.com"   # omit if not yet known
```

Copy the four output lines into `.env.local`.

- [ ] **Step 2: Generate AUTH_SECRET**

```bash
npx auth secret
```

Copy the output value into the `AUTH_SECRET=` line in `.env.local`.

- [ ] **Step 3: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 4: Verify the auth flow**

Open `http://localhost:3000` in a browser.

Expected sequence:
1. Browser immediately redirects to `login.microsoftonline.com/<tenant-id>` — no intermediate page shown
2. Sign in with an account from the target org
3. Browser redirects back to `http://localhost:3000`
4. The page loads with a thin header bar showing the signed-in user's name and a "Sign out" button

- [ ] **Step 5: Verify sign-out**

Click "Sign out". Expected: session clears and browser redirects back to Microsoft login (because the app is fully protected and any unauthenticated visit is redirected).

- [ ] **Step 6: Verify API route guard**

While signed out (or in a new incognito window before signing in), run in the browser console or with curl:

```bash
curl -X POST http://localhost:3000/api/run -H "Content-Type: application/json" -d '{"code":"console.log(1)"}'
```

Expected: `401 Unauthorized` response.

- [ ] **Step 7: Verify wrong-tenant rejection**

Attempt to sign in with a personal Microsoft account or an account from a different org.

Expected: Microsoft shows an error ("You can't access this application") — the `AzureADMyOrg` sign-in audience enforces this on the Microsoft side.
