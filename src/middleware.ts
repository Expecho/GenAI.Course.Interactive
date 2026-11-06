import { auth } from "@/auth"
import { NextResponse } from "next/server"

const TITLE = "Generative AI Workshop"
const DESCRIPTION = "Hands-on, web-based Generative AI workshop — edit code and watch it run live."

// Link-preview crawlers (Slack, Teams, LinkedIn, ...) can't sign in, so the
// login redirect leaves them with nothing to show. Give them a tiny public
// page with only the Open Graph tags — no course content.
const PREVIEW_BOT = /Slackbot|facebookexternalhit|LinkedInBot|Twitterbot|SkypeUriPreview|Discordbot|WhatsApp|TelegramBot|redditbot|Applebot|Embedly|vkShare|Pinterest/i

function previewPage(url: URL): NextResponse {
  const origin = url.origin
  const pageUrl = `${origin}${url.pathname}`
  const image = `${origin}/opengraph-image`
  const html = `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<title>${TITLE}</title>
<meta name="description" content="${DESCRIPTION}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="${TITLE}">
<meta property="og:title" content="${TITLE}">
<meta property="og:description" content="${DESCRIPTION}">
<meta property="og:url" content="${pageUrl}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${TITLE}">
<meta name="twitter:description" content="${DESCRIPTION}">
<meta name="twitter:image" content="${image}">
</head><body><h1>${TITLE}</h1><p>${DESCRIPTION}</p></body></html>`
  return new NextResponse(html, {
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}

export default auth((req) => {
  if (!req.auth) {
    if (PREVIEW_BOT.test(req.headers.get("user-agent") ?? "")) {
      return previewPage(req.nextUrl)
    }
    const loginUrl = new URL("/api/login", req.nextUrl.origin)
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname)
    return NextResponse.redirect(loginUrl)
  }
})

export const config = {
  // Exclude: all /api/* routes, Next.js internals, favicon, and the public
  // link-preview image
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|opengraph-image).*)"],
}
