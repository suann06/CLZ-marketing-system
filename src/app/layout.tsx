import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

// Plus Jakarta Sans — the sole typeface used throughout the approved
// Stitch "Dark Olive Luxury" design system (its own tailwind.config
// declares every text style, headings through body, in this one family).
// Replaces Geist Sans; Geist Mono is kept for tabular/numeric figures —
// Stitch's canonical screen doesn't specify a distinct mono face, so
// there's nothing to migrate it to.
const plusJakartaSans = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CLZ Marketing OS",
  description: "AI-assisted campaign, lead, and sales operations platform for CLZ Resources.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${plusJakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
