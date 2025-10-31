
// @/components/layout/FirebaseErrorListener.tsx
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export function FirebaseErrorListener() {
  useEffect(() => {
    const handleError = (permissionError: FirestorePermissionError) => {
      // Get the current auth state when the error is emitted
      const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
        let authStateForError = null;

        if (user) {
          // Construct a serializable auth object
          authStateForError = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            emailVerified: user.emailVerified,
            // You can add more serializable fields here if needed
            // token: await user.getIdTokenResult(), // Avoid complex objects
          };
        }

        permissionError.requestAuth = authStateForError;

        // Throw an uncaught exception that Next.js dev overlay will catch
        // We add a specific prefix to make it easily identifiable
        const errorForOverlay = new Error(
          `FirestoreError: Missing or insufficient permissions: The following request was denied by Firestore Security Rules:\n${JSON.stringify(
            {
              auth: permissionError.requestAuth,
              ...permissionError.context,
            },
            null,
            2
          )}`
        );
        
        // This makes sure the dev overlay shows our custom, detailed error.
        // DO NOT wrap this in a try/catch or use console.error, as it will
        // prevent the Next.js overlay from appearing.
        throw errorForOverlay;
      });

      // Unsubscribe after getting the auth state once to avoid memory leaks
      // This is a simplified approach; in a real-time app you might handle this differently
      setTimeout(() => unsubscribe(), 100);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  return null; // This component does not render anything
}
