
// @/app/api/send-push-notification/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { sendPushNotification } from '@/lib/push-notifications'; // We will create this

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription, title, body: notificationBody, url } = body;

    if (!subscription || !title || !notificationBody || !url) {
      return NextResponse.json({ message: 'Missing required fields for push notification.' }, { status: 400 });
    }

    // Call the server-side function to send the notification
    await sendPushNotification(subscription, title, notificationBody, url);

    return NextResponse.json({ message: 'Push notification sent successfully.' }, { status: 200 });

  } catch (error) {
    console.error('API error sending push notification:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
    return NextResponse.json({ message: 'Failed to send push notification.', error: errorMessage }, { status: 500 });
  }
}
