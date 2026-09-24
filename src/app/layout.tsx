import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { SUPABASE_KEY, SUPABASE_URL } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin", "latin-ext", "vietnamese"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Brand Manager · Heads on Pillows",
  description: "SEO/GEO content brand manager for hospitality projects",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = SUPABASE_URL && SUPABASE_KEY ? (await (await createClient()).auth.getUser()).data.user : null;

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        {user && (
          <header className="sticky top-0 z-20 border-b border-ink-200 bg-white/90 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
              <Link href="/" className="flex items-center gap-2 font-semibold text-ink-900">
                <span className="grid h-7 w-7 place-items-center rounded-md bg-brand-700 text-xs font-bold text-white">HP</span>
                <span>Brand Manager</span>
                <span className="hidden text-sm font-normal text-ink-500 sm:inline">SEO / GEO</span>
              </Link>
              <div className="flex items-center gap-3 text-sm text-ink-600">
                <span className="hidden sm:inline">{user.email}</span>
                <form action="/auth/signout" method="post">
                  <button className="rounded-md px-2 py-1 hover:bg-ink-100">Sign out</button>
                </form>
              </div>
            </div>
          </header>
        )}
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
