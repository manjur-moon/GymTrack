import type { Metadata } from "next";
import "./globals.css";
import { currentUser } from "@/server/auth";
import { AppShell } from "@/components/layout/app-shell";
import { PwaRegister } from "@/components/pwa-register";

export const metadata: Metadata = {
  title: { default: "GymTrack Pro — Coaching workspace", template: "%s | GymTrack Pro" },
  description: "Create programs, log training, and review client progress in one connected coaching workspace.",
  manifest: "/manifest.webmanifest",
  applicationName: "GymTrack Pro",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en">
      <body>
        <PwaRegister />
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
