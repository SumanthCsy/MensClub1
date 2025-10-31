
// @/app/layout.tsx
"use client"; // Mark as a Client Component module

import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';
import { Toaster } from "@/components/ui/toaster";
import { cn } from '@/lib/utils';
import { CartProvider } from '@/context/cart-context';
import { WishlistProvider } from '@/context/wishlist-context';
import { FloatingContactButtons } from '@/components/layout/FloatingContactButtons';
import { GlobalAdminNotifications } from '@/components/layout/GlobalAdminNotifications';
import { SiteCouponPopup } from '@/components/layout/SiteCouponPopup';
import { PageTransitionLoader } from '@/components/layout/PageTransitionLoader';
import { FirebaseErrorListener } from '@/components/layout/FirebaseErrorListener'; // Import the new listener

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { ThemeSettings } from '@/types';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// Theme color definitions - must match those in admin/settings/theme/page.tsx
// This ensures RootLayout applies the correct HSL values.
const themeColorMap: Record<string, { primaryHsl: string; accentHsl: string; [key: string]: string }> = {
  default: { name: 'Default (Teal)', value: 'default', primaryHsl: '180 100% 25.1%', accentHsl: '180 100% 25.1%' },
  'sky-blue': { name: 'Sky Blue', value: 'sky-blue', primaryHsl: '200 100% 50%', accentHsl: '200 100% 50%' },
  yellow: { name: 'Sunny Yellow', value: 'yellow', primaryHsl: '45 100% 50%', accentHsl: '45 100% 50%' },
  blue: { name: 'Classic Blue', value: 'blue', primaryHsl: '220 100% 50%', accentHsl: '220 100% 50%' },
  lilac: { name: 'Lilac Purple', value: 'lilac', primaryHsl: '270 70% 60%', accentHsl: '270 70% 60%' },
  lemon: { name: 'Lemon Green', value: 'lemon', primaryHsl: '80 60% 50%', accentHsl: '80 60% 50%' },
  green: { name: 'Forest Green', value: 'green', primaryHsl: '120 60% 35%', accentHsl: '120 60% 35%' },
};

const defaultThemeSettings: ThemeSettings = {
  selectedColor: 'default',
  displayMode: 'light',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  useEffect(() => {
    document.title = 'Mens Club Keshavapatnam'; // Moved from ProductDetailsPage

    const settingsRef = doc(db, "settings", "themeConfiguration");
    const unsubscribe = onSnapshot(settingsRef, (docSnap) => {
      let activeTheme = defaultThemeSettings;
      if (docSnap.exists()) {
        const fetchedSettings = docSnap.data() as ThemeSettings;
        if (fetchedSettings.selectedColor && fetchedSettings.displayMode) {
            activeTheme = fetchedSettings;
        } else {
            console.warn("Fetched theme settings are incomplete, using defaults.");
        }
      } else {
        console.log("No theme settings found in Firestore, using defaults.");
      }
      
      const root = document.documentElement;
      if (activeTheme.displayMode === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }

      const colorConfig = themeColorMap[activeTheme.selectedColor] || themeColorMap.default;
      root.style.setProperty('--primary', colorConfig.primaryHsl);
      root.style.setProperty('--accent', colorConfig.accentHsl);
    }, (error) => {
      console.error("Error fetching theme settings from Firestore:", error);
      const root = document.documentElement;
      root.classList.remove('dark'); 
      const colorConfig = themeColorMap.default;
      root.style.setProperty('--primary', colorConfig.primaryHsl);
      root.style.setProperty('--accent', colorConfig.accentHsl);
    });

    return () => unsubscribe();
  }, []);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="description" content="Premium fashion for gentlemen in Keshavapatnam." />
        {/* Ensure mclogo.png is in the /public directory for this link to work */}
        <link rel="icon" href="/mclogo.png" type="image/png" sizes="any"/>
      </head>
      <body
        className={cn(
          `${geistSans.variable} ${geistMono.variable} antialiased font-sans`,
          "min-h-screen bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 text-foreground flex flex-col"
        )}
      >
        <CartProvider>
          <WishlistProvider>
            <FirebaseErrorListener />
            <PageTransitionLoader />
            <Navbar />
            <main className="flex-grow">{children}</main>
            <Footer />
            <Toaster />
            <FloatingContactButtons />
            <GlobalAdminNotifications />
            <SiteCouponPopup />
          </WishlistProvider>
        </CartProvider>
      </body>
    </html>
  );
}
