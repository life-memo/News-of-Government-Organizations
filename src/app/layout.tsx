import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "省庁新着ダッシュボード",
  description:
    "日本の10省庁の新着情報をカレンダーで俯瞰し、検索・要約が読めるダッシュボード",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className="antialiased font-sans">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between">
            <Link
              href="/"
              className="flex items-center gap-2 font-bold text-lg"
            >
              <span className="text-blue-600 text-xl">&#x1F3DB;</span>
              <span>省庁新着ダッシュボード</span>
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                トップ
              </Link>
              <Link
                href="/search"
                className="text-gray-600 hover:text-gray-900 transition-colors"
              >
                検索
              </Link>
            </nav>
          </div>
        </header>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
