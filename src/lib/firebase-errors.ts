import toast from 'react-hot-toast';

export const handleFirebaseError = (error: any) => {
  console.error("Firebase Error:", error);
  
  let message = error.message || "An error occurred";
  
  // Auth Errors
  if (error.code === 'auth/invalid-credential' || error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
    message = 'Invalid email or password. If you are new, please create an account.';
  } else if (error.code === 'auth/email-already-in-use') {
    message = 'This email is already registered. Please sign in instead.';
  } else if (error.code === 'auth/weak-password') {
    message = 'Password should be at least 6 characters.';
  } else if (error.code === 'auth/network-request-failed') {
    message = 'Network error. Check internet connection or Authorized Domains in Firebase Console.';
  } 
  
  // Firestore Errors
  else if (error.code === 'permission-denied' || error.message?.includes('Missing or insufficient permissions')) {
    message = 'Permission Denied: Check Firestore Security Rules in Firebase Console.';
    // We'll show a longer duration toast for this one
    toast.error(message, { duration: 8000, icon: '🔒' });
    return;
  }

  toast.error(message);
};
