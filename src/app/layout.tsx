import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tripwise",
  description: "Najdi nejlepší výlet, ne jen nejlevnější letenku.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
