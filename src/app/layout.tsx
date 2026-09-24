import type { Metadata } from "next";
import { Geist_Mono, Poppins } from "next/font/google";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { PREVIEW } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import "./globals.css";

const poppins = Poppins({ variable: "--font-poppins", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Content OS · Heads on Pillows",
  description: "SEO/GEO content brand manager for hospitality projects",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const supabase = await createClient();
  const user = (await supabase.auth.getUser()).data.user;
  const projects = user ? ((await supabase.from("projects").select("id, name").order("name")).data ?? []) : [];

  return (
    <html lang="en" className={`${poppins.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">
        {user ? (
          <div className="flex min-h-screen flex-col md:flex-row">
            <Sidebar projects={projects as { id: string; name: string }[]} email={user.email ?? ""} preview={PREVIEW} />
            <main className="min-w-0 flex-1">
              {PREVIEW && (
                <div className="border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-center text-xs text-amber-300 sm:px-8">
                  Preview mode: you&apos;re viewing a sample workspace. Saving, uploads and AI runs are turned off until Supabase is connected.{" "}
                  <Link href="/setup" className="underline underline-offset-2">
                    How to connect
                  </Link>
                </div>
              )}
              {children}
            </main>
          </div>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
