
// @/lib/push-notifications.ts
'use server';

import webpush from 'web-push';

// Set VAPID details
// In a real production app, these should come from environment variables
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'BChHHP90TSqXkJWwE1EbDP_tXsvluIYidA4SODw8wPqqEnYKRR5sy9Bl34LH1XQIR5LkyWR3ZPlG4sC2EfppWiU';
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY || '2D0-fHlAOLE0pT4Sj_KKLJ3TNbkH84sHqF8s-YvF_sY';

if (!vapidPublicKey || !vapidPrivateKey) {
  console.error("VAPID keys are not configured. Push notifications will not work.");
} else {
    webpush.setVapidDetails(
        'mailto:your-email@example.com', // Replace with your contact email
        vapidPublicKey,
        vapidPrivateKey
    );
}

/**
 * Sends a push notification using a subscription object.
 * @param subscription The PushSubscription object from the browser.
 * @param title The title of the notification.
 * @param body The body text of the notification.
 * @param url The URL to open when the notification is clicked.
 */
export async function sendPushNotification(subscription: webpush.PushSubscription, title: string, body: string, url: string) {
    if (!vapidPublicKey || !vapidPrivateKey) {
        console.error("Cannot send push notification because VAPID keys are not configured.");
        return;
    }
    
    const payload = JSON.stringify({
        title,
        body,
        url,
    });

    try {
        await webpush.sendNotification(subscription, payload);
        console.log("Push notification sent successfully.");
    } catch (error) {
        console.error("Error sending push notification:", error);
        // If the subscription is expired or invalid, you might want to delete it from your database
        if (error instanceof Error && 'statusCode' in error && (error as any).statusCode === 410) {
            console.warn("Push subscription has expired or is invalid. It should be deleted.");
            // Here you would typically emit an event or call a function to delete the subscription from your DB
        }
    }
}
