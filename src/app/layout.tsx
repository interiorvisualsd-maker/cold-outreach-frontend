import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Dispatcher",
  description: "Cold email automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
