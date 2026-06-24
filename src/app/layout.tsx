import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider, themeInitScript } from "@/components/ThemeProvider";
import { auth, signOut } from "@/auth";

export const metadata: Metadata = {
  title: "Generative AI Workshop",
  description: "Hands-on, web-based Generative AI workshop — edit code and watch it run live.",
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
