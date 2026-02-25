import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs, limit, query } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { handleFirebaseError } from '../lib/firebase-errors';
import toast from 'react-hot-toast';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  isAdmin: boolean;
  permissionError: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  isAdmin: false,
  permissionError: false,
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState(false);

  useEffect(() => {
    let unsubscribeProfile: () => void;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setPermissionError(false);
      
      if (firebaseUser) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        
        // Listen for real-time updates to the user profile
        unsubscribeProfile = onSnapshot(docRef, async (docSnap) => {
          if (docSnap.exists()) {
            setUserProfile(docSnap.data() as UserProfile);
          } else {
            // Check if this is the first user
            const usersQuery = query(collection(db, 'users'), limit(1));
            const usersSnapshot = await getDocs(usersQuery);
            const isFirstUser = usersSnapshot.empty;

            // Create default profile if not exists
            const newProfile: UserProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: isFirstUser ? 'admin' : 'staff',
            };
            try {
              await setDoc(docRef, newProfile);
              setUserProfile(newProfile);
              if (isFirstUser) {
                toast.success("You are the first user and have been granted Admin access.");
              }
            } catch (error: any) {
               console.error("Error creating profile:", error);
               if (error.code === 'permission-denied') {
                 setPermissionError(true);
                 toast.error("Database Permission Denied. You may need to update Firestore Rules.");
               }
            }
          }
          setLoading(false);
        }, (error) => {
          console.error("Error fetching user profile:", error);
          if (error.code === 'permission-denied') {
            setPermissionError(true);
            toast.error("Database Permission Denied. Admin status cannot be verified.");
          }
          setLoading(false);
        });
      } else {
        setUserProfile(null);
        setLoading(false);
        if (unsubscribeProfile) unsubscribeProfile();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, []);

  const isAdmin = userProfile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, isAdmin, permissionError }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};
