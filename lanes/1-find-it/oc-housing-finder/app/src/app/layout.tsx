import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OC Housing Finder",
  description: "Prototype: screen Santa Ana parcels against California's land-opening housing laws, with sources and unknowns shown.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
