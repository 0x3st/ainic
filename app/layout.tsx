import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AINIC Agent - AI-First Domain Management",
  description: "Conversational AI for domain registration and management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
