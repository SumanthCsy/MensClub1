
// /public/service-worker.js

// This is the service worker that will handle push notifications.

self.addEventListener('push', (event) => {
  if (!event.data) {
    console.log('Push event but no data');
    return;
  }

  const data = event.data.json();
  const title = data.title || 'Mens Club Keshavapatnam';
  const options = {
    body: data.body || 'You have a new notification.',
    icon: data.icon || '/mclogo.png', // Default icon
    badge: data.badge || '/mclogo.png', // Icon for notification bar on mobile
    sound: data.sound || undefined, // The custom sound path
    vibrate: data.vibrate || [200, 100, 200], // Vibration pattern
    tag: data.tag || 'general-notification', // Groups notifications
    renotify: true, // Re-notify if a new notification has the same tag
    data: {
      url: data.url || '/', // URL to open on click
    },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close(); // Close the notification

  // Open the URL specified in the notification data, or the root URL
  event.waitUntil(
    clients.openWindow(event.notification.data.url || '/')
  );
});
