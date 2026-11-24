import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/session";
export const metadata: Metadata = {
  title: "Merveille Designs | Project workspace",
  description: "Merveille Designs architectural project and client portal",
  icons: { icon: "/favicon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F6F7F9",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
