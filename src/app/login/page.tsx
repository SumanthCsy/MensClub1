
// @/app/login/page.tsx
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { LogIn, Mail, KeyRound, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, Suspense } from 'react';
import { auth, db } from '@/lib/firebase';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import type { UserData } from '@/types';
import { CustomLoader } from '@/components/layout/CustomLoader';


function LoginPageContent() {
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);


  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        // Check user role from Firestore
        try {
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userData = userDocSnap.data() as UserData;
            if (userData.role === 'admin') {
              router.replace('/admin/dashboard');
            } else {
              const redirectUrl = searchParams.get('redirect') || '/';
              router.replace(redirectUrl);
            }
          } else {
             // Fallback if no user doc, e.g., admin only in Auth
             if (user.email === 'admin@mensclub') { // Hardcoded admin email
               router.replace('/admin/dashboard');
             } else {
              const redirectUrl = searchParams.get('redirect') || '/';
              router.replace(redirectUrl);
             }
          }
        } catch (error) {
            console.error("Error checking user role during auth state change:", error);
            const redirectUrl = searchParams.get('redirect') || '/';
            router.replace(redirectUrl); // Default redirect on error
        }
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router, searchParams]);


  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userName = "User";
      let userRole = "user"; 

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data() as UserData;
        userName = userData.fullName || user.email?.split('@')[0] || "User";
        userRole = userData.role || "user";
      } else {
        if (user.email === 'admin@mensclub') { 
          userRole = 'admin';
          userName = 'Admin Mens Club'; 
          toast({
            title: "Admin Alert",
            description: "Admin Firestore document not found. Assigned admin role based on email. Ensure Firestore 'users' collection is correctly set up.",
            variant: "destructive",
            duration: 10000, 
          });
        } else {
          userRole = 'user'; 
          userName = user.email?.split('@')[0] || "User"; 
           toast({
            title: "Profile Data Missing",
            description: "Your user profile details could not be fully loaded.",
            variant: "default",
            duration: 7000,
          });
        }
      }
      
      const redirectUrl = searchParams.get('redirect');

      if (userRole === 'admin' && email === 'admin@mensclub') { 
        toast({
          title: "Admin Login Successful!",
          description: "Redirecting to the Admin Dashboard...",
        });
        router.push('/admin/dashboard'); 
      } else if (userRole === 'user') { 
        toast({
          title: "Login Successful!",
          description: `Welcome back, ${userName}!`,
        });
        router.push(redirectUrl || '/'); 
      } else {
        toast({
          title: "Login Successful (Role Undetermined)",
          description: `Welcome, ${userName}! Please check your account setup if full features are not available.`,
           variant: "default",
           duration: 7000,
        });
        router.push(redirectUrl || '/');
      }
    } catch (error: any) {
      console.error("Login error: ", error);
      let friendlyMessage = "Invalid details or user not found.";
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        friendlyMessage = "Invalid email or password. Please try again.";
      } else if (error.code === 'auth/too-many-requests') {
        friendlyMessage = "Too many login attempts. Please try again later."
      }
      toast({
        title: "Login Failed",
        description: friendlyMessage,
        variant: "destructive",
        duration: 7000,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="container mx-auto flex justify-center items-center min-h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-md px-4 sm:px-6 lg:px-8 py-12 md:py-24 flex items-center justify-center min-h-[calc(100vh-10rem)]">
      <Card className="w-full shadow-xl border border-border/60">
        <CardHeader className="text-center">
          <LogIn className="mx-auto h-12 w-12 text-primary mb-4" />
          <CardTitle className="text-3xl font-bold">Welcome Back!</CardTitle>
          <CardDescription>Sign in to continue to Mens Club.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="you@example.com" 
                  required 
                  className="pl-10 h-11 text-base"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  suppressHydrationWarning={true}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
               <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="••••••••" 
                  required 
                  className="pl-10 h-11 text-base"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  suppressHydrationWarning={true}
                />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Button type="submit" className="w-full text-lg py-3 h-auto" disabled={isLoading} suppressHydrationWarning={true}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Signing In...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-5 w-5" /> Sign In
                </>
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center space-y-2 pt-6">
          <p className="text-sm text-muted-foreground">
            Don't have an account?{' '}
            <Link href="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}


export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><CustomLoader /></div>}>
      <LoginPageContent />
    </Suspense>
  );
}