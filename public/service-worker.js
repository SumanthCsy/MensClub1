
// public/service-worker.js

// This command is crucial. It tells the new service worker to take over the page
// and start controlling it immediately, without waiting for the user to close all tabs.
self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  // This ensures that any old service workers are cleaned up.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  console.log('Service Worker: Push event received.');
  
  let data;
  try {
    data = event.data.json();
  } catch (e) {
    console.error('Service Worker: Could not parse push data.', e);
    data = {
      title: 'New Notification',
      body: 'You have a new update.',
      url: '/',
    };
  }

  const { title, body, url } = data;

  const options = {
    body: body,
    icon: '/mclogo.png', // Main icon for the notification
    badge: '/mclogo.png', // Small icon, often shown in the status bar
    vibrate: [200, 100, 200], // Vibration pattern
    data: {
      url: url, // URL to open on click
    },
  };

  // The waitUntil() method ensures the service worker doesn't terminate
  // until the notification is displayed.
  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  console.log('Service Worker: Notification clicked.');
  
  // Close the notification
  event.notification.close();

  // Open the URL specified in the notification data
  const urlToOpen = event.notification.data.url || '/';

  // The waitUntil() ensures the browser doesn't terminate the service worker
  // before the new window/tab has been opened.
  event.waitUntil(
    self.clients.openWindow(urlToOpen)
  );
});
