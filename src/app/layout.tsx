import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ExperienceProvider } from "@/components/experience/provider";
import { SessionProvider } from "@/components/session";
export const metadata: Metadata = {
  title: "Merveille Designs | Project workspace",
  description: "Merveille Designs architectural project and client portal",
  icons: { icon: "/favicon.png" },
};
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#101216",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{__html:`try{var p=JSON.parse(localStorage.getItem("merveille-appearance")||"null");var t=p&&p.theme;if(t==="light"||t==="dark"||t==="system")document.documentElement.dataset.theme=t==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):t;}catch(e){}`}} /></head>
      <body>
        <SessionProvider><ExperienceProvider>{children}</ExperienceProvider></SessionProvider>
      </body>
    </html>
  );
}
