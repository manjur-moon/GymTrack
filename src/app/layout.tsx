import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/server/auth";
import { LogoutButton } from "@/components/auth-buttons";
import { PwaRegister } from "@/components/pwa-register";
export const metadata: Metadata = { title: "GymTrack — Train with clarity", description: "Plan, log and analyze your training.", manifest: "/manifest.webmanifest", applicationName: "GymTrack" };
export default async function RootLayout({children}:{children:React.ReactNode}) {
 const user = await currentUser();
 return <html lang="en"><body><a className="skip" href="#main-content">Skip to content</a><PwaRegister/><header className="topbar"><div className="topinner"><Link href="/" className="logo">✦ GymTrack</Link><nav aria-label="Main navigation" className="nav"><Link href="/exercises">Exercises</Link>{user ? <><Link href="/dashboard">Dashboard</Link><Link href="/plans">Plans</Link><Link href="/workouts/history">History</Link><Link href="/dashboard/progress">Insights</Link><Link href="/dashboard/heatmaps">Heatmaps</Link>{user.role==="COACH"||user.role==="ADMIN"?<Link href="/coach">Coach</Link>:null}<LogoutButton/></> : <><Link href="/login">Log in</Link><Link href="/register">Sign up</Link></>}</nav></div></header><main id="main-content">{children}</main><footer className="footer">GymTrack · Training insights are informational, not medical advice.</footer></body></html>;
}
