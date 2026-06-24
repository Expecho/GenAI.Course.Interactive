import NextAuth from "next-auth"
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id"

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID!,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET!,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER!,
    }),
  ],
  events: {
    async signIn({ user }) {
      // Dynamic import keeps @azure/data-tables out of the middleware bundle.
      // The middleware runs in the Edge Runtime and would crash on the static import.
      import("@/lib/tableStorage")
        .then(({ logLoginEvent }) => logLoginEvent(user))
        .catch((err) => console.error("[activity-log] login event failed:", err))
    },
  },
})
