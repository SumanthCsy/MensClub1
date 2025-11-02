
// @/components/layout/GlobalAdminNotifications.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from '@/components/ui/button';
import { BellRing, BellOff } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, Unsubscribe, doc, getDoc } from "firebase/firestore";
import type { User as FirebaseUser } from 'firebase/auth';
import type { UserData } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Helper function to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function GlobalAdminNotifications() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  
  const [showModal, setShowModal] = useState(false);
  const [modalContent, setModalContent] = useState<{ title: string, description: string } | null>(null);
  const previousPendingOrdersCountRef = useRef<number | null>(null);
  const [notificationPermission, setNotificationPermission] = useState('default');
  const { toast } = useToast();

  const playSound = useCallback((soundPath: string) => {
    if (typeof window !== 'undefined') {
      const audio = new Audio(soundPath);
      audio.play().catch(error => {
        console.warn(`Audio autoplay for ${soundPath} was prevented:`, error);
        toast({
          title: "Audio Playback Blocked",
          description: `The sound notification was blocked by the browser. Please interact with the page to enable audio.`,
          duration: 7000
        });
      });
    }
  }, [toast]);

  // Request Notification Permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      toast({ title: "Unsupported Browser", description: "Push notifications are not supported in your browser.", variant: "destructive" });
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);

    if (permission === 'granted') {
      try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('Service Worker registered with scope:', registration.scope);

        await navigator.serviceWorker.ready; // Ensure service worker is active
        
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
            const vapidPublicKey = 'BChHHP90TSqXkJWwE1EbDP_tXsvluIYidA4SODw8wPqqEnYKRR5sy9Bl34LH1XQIR5LkyWR3ZPlG4sC2EfppWiU'; // Replace with your actual VAPID public key
            if (!vapidPublicKey.startsWith('B')) {
                console.error("VAPID public key is missing or invalid. Push notifications will not work.");
                toast({ title: "Setup Incomplete", description: "Push notification setup is incomplete. Admin needs to configure VAPID keys.", variant: "destructive" });
                return;
            }
            const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
            subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey,
            });
        }
        
        // TODO: Send `subscription` object to your server to store it for this user
        console.log('Push Subscription:', subscription);
        toast({ title: "Notifications Enabled", description: "You will now receive notifications for new orders." });
      } catch (error) {
        console.error('Error during notification setup:', error);
        toast({ title: "Notification Error", description: "Could not set up push notifications.", variant: "destructive" });
      }
    } else {
      toast({ title: "Notifications Blocked", description: "You have blocked notifications. Please enable them in your browser settings if you wish to receive alerts.", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    if ('Notification' in window) {
      setNotificationPermission(Notification.permission);
    }
    const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
      setIsLoadingAuth(true);
      setCurrentUser(user);
      if (user) {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        setIsAdmin(userDocSnap.exists() && userDocSnap.data().role === 'admin');
      } else {
        setIsAdmin(false);
        previousPendingOrdersCountRef.current = null;
      }
      setIsLoadingAuth(false);
    });
    return () => unsubscribeAuth();
  }, []);

  const showPushNotification = (title: string, body: string, sound: string) => {
      if (!('Notification' in window) || Notification.permission !== 'granted') {
          return;
      }
      navigator.serviceWorker.ready.then(registration => {
          registration.showNotification(title, {
              body,
              icon: '/mclogo.png',
              badge: '/mclogo.png',
              sound,
              vibrate: [200, 100, 200],
              tag: 'new-order',
              renotify: true,
              data: { url: '/admin/orders' }
          });
      });
  };

  useEffect(() => {
    let unsubscribeOrders: Unsubscribe | undefined;

    if (isAdmin && !isLoadingAuth) {
      const ordersRef = collection(db, "orders");
      const q = query(ordersRef, where("status", "==", "Pending"));

      unsubscribeOrders = onSnapshot(q, (snapshot) => {
        const currentCount = snapshot.size;
        setPendingOrdersCount(currentCount);

        const prevCount = previousPendingOrdersCountRef.current;
        
        if (prevCount === null) { // First load for this session
          if (currentCount > 0) {
            setModalContent({
              title: "Pending Orders Alert",
              description: `You have ${currentCount} pending order(s) that require attention.`
            });
            setShowModal(true);
            playSound('/pending.mp3');
            showPushNotification("Pending Orders Alert", `You have ${currentCount} pending order(s).`, '/pending.mp3');
          }
        } else if (currentCount > prevCount) { // New order(s) arrived
          const newOrders = currentCount - prevCount;
          const orderText = newOrders > 1 ? `${newOrders} new orders` : `A new order`;
          setModalContent({
            title: "New Order Received!",
            description: `${orderText} has been placed. You now have ${currentCount} total pending order(s).`
          });
          setShowModal(true);
          playSound('/neworder.mp3');
          showPushNotification("New Order Received!", `${orderText} just arrived!`, '/neworder.mp3');
        }
        previousPendingOrdersCountRef.current = currentCount;
      }, (error) => {
        console.error("Error fetching pending orders:", error);
      });
    }

    return () => {
      if (unsubscribeOrders) unsubscribeOrders();
    };
  }, [isAdmin, isLoadingAuth, playSound, showPushNotification]);

  const handleModalClose = () => {
    setShowModal(false);
    setModalContent(null);
  };
  
  if (isLoadingAuth) return null;

  return (
    <>
      {isAdmin && notificationPermission !== 'granted' && (
        <div className="fixed bottom-20 right-6 z-40">
           <Button onClick={requestNotificationPermission} variant="default" size="sm" className="bg-blue-600 hover:bg-blue-700 shadow-lg">
             <BellRing className="mr-2 h-4 w-4" /> Enable Order Notifications
           </Button>
        </div>
      )}
      {isAdmin && notificationPermission === 'denied' && (
         <div className="fixed bottom-20 right-6 z-40 p-3 bg-destructive text-destructive-foreground rounded-md shadow-lg text-xs flex items-center gap-2">
            <BellOff className="h-4 w-4"/>
           <span>You have blocked notifications.</span>
        </div>
      )}

      {showModal && modalContent && (
        <AlertDialog open={showModal} onOpenChange={(open) => !open && handleModalClose()}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <BellRing className={cn("h-6 w-6 text-primary", modalContent.title.includes("New Order") && "animate-pulse")} />
                {modalContent.title}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {modalContent.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={handleModalClose}>Dismiss</AlertDialogCancel>
              <AlertDialogAction asChild onClick={handleModalClose}>
                <Link href="/admin/orders">View Orders</Link>
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </>
  );
}
