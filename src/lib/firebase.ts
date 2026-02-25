import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: "AIzaSyCKPB2THMJ-CsOOKw23U89xBWwrV13t8a0",
  authDomain: "transporttracker-42f40.firebaseapp.com",
  projectId: "transporttracker-42f40",
  storageBucket: "transporttracker-42f40.firebasestorage.app",
  messagingSenderId: "759721099061",
  appId: "1:759721099061:web:464cb8910b7399bc22d67c",
  measurementId: "G-0L3T7VNLMC"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Initialize Firestore with persistence enabled
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Initialize Analytics only if supported (client-side)
let analytics: any = null;
if (typeof window !== 'undefined') {
  isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  }).catch(console.error);
}

export { analytics };
