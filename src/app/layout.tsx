import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Emailyzer",
  description: "Securely sync and browse your Outlook inbox.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
