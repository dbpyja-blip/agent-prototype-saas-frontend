import React from "react";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import Link from "next/link";
import Image from "next/image";

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

export const metadata: Metadata = {
    title: "AI-Powered Healthcare",
    description: "AI-powered medical consultation and treatment planning",
    icons: {
        icon: "/favicon.svg",
    },
};

import {
    ClerkProvider,
    SignInButton,
    SignUpButton,
    SignedIn,
    SignedOut,
    UserButton
} from '@clerk/nextjs'

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <ClerkProvider>
            <html lang="en">
                <body className={`${geist.className} font-sans antialiased min-h-screen bg-background text-foreground relative`}>
                    <header className="w-full px-6 py-4 flex items-center justify-between z-50 border-b border-border/40">
                        <Link href="/">
                            <Image
                                src="/dimensionleap-logo.png"
                                alt="DimensionLeap Logo"
                                width={180}
                                height={60}
                                priority
                                className="w-32 md:w-40 h-auto cursor-pointer"
                            />
                        </Link>
                        <div className="flex items-center gap-3">
                            <SignedOut>
                                <SignInButton mode="modal">
                                    <button className="text-sm font-medium px-4 py-2 rounded-full border border-border hover:border-primary/50 hover:text-primary transition-all duration-200">
                                        Sign In
                                    </button>
                                </SignInButton>
                                <SignUpButton mode="modal">
                                    <button className="text-sm font-semibold px-4 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200 shadow-sm shadow-primary/20">
                                        Sign Up
                                    </button>
                                </SignUpButton>
                            </SignedOut>
                            <SignedIn>
                                <UserButton
                                    appearance={{
                                        elements: {
                                            avatarBox: "h-9 w-9 rounded-full ring-2 ring-border hover:ring-primary/50 transition-all"
                                        }
                                    }}
                                />
                            </SignedIn>
                        </div>
                    </header>
                    {children}
                    <Analytics />
                </body>
            </html>
        </ClerkProvider>
    );
}
