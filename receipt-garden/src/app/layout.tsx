import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Receipt Garden — evidence before earnings",
  description: "A synthetic demo of offers, delivery evidence, independent review, and verified receipts modeled with Sanity.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
