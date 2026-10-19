import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCTS } from "@/config/products";
import "./globals.css";

export const metadata: Metadata = {
  title: "Product Research",
  description:
    "Answers and community pulse for Microsoft products, combining Microsoft Learn, Tech Community and Reddit.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-line bg-background/80 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold tracking-tight">
              Product Research
            </Link>
            <div className="flex flex-wrap gap-4 text-muted">
              {PRODUCTS.map((p) => (
                <Link key={p.id} href={`/products/${p.id}`} className="hover:text-foreground">
                  {p.name}
                </Link>
              ))}
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line py-6 text-center text-xs text-muted">
          Community posts are opinions, not official guidance. Verify against Microsoft Learn.
        </footer>
      </body>
    </html>
  );
}
