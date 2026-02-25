import { openDB, IDBPDatabase } from 'idb';
import { collection, addDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { uploadToCloudinary } from '../lib/cloudinary';
import toast from 'react-hot-toast';

const DB_NAME = 'parcel-tracker-offline';
const STORE_NAME = 'pending-parcels';

export interface OfflineParcel {
  id?: number;
  data: any;
  imageBlob?: Blob | null;
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        }
      },
    });
  }
  return dbPromise;
};

export const saveParcelOffline = async (parcelData: any, imageBlob?: Blob | null) => {
  const db = await getDB();
  const entry: OfflineParcel = {
    data: parcelData,
    imageBlob: imageBlob || null,
    timestamp: Date.now(),
  };
  await db.add(STORE_NAME, entry);
  return true;
};

export const getPendingParcels = async (): Promise<OfflineParcel[]> => {
  const db = await getDB();
  return db.getAll(STORE_NAME);
};

export const deletePendingParcel = async (id: number) => {
  const db = await getDB();
  await db.delete(STORE_NAME, id);
};

export const syncOfflineData = async () => {
  if (!navigator.onLine) return;

  const pending = await getPendingParcels();
  if (pending.length === 0) return;

  const toastId = toast.loading(`Syncing ${pending.length} offline entries...`);
  let successCount = 0;

  for (const entry of pending) {
    try {
      // Ensure we have the latest auth state
      if (!auth.currentUser) continue;

      const dataToSync = {
        ...entry.data,
        createdAt: Timestamp.now(),
        createdBy: auth.currentUser.uid,
      };

      const docRef = await addDoc(collection(db, 'parcels'), dataToSync);

      // Handle image upload if present
      if (entry.imageBlob) {
        try {
          const weightImageUrl = await uploadToCloudinary(entry.imageBlob as File);
          if (weightImageUrl) {
            await updateDoc(docRef, { weightImageUrl });
          }
        } catch (imgErr) {
          console.error("Offline image sync error:", imgErr);
        }
      }

      await deletePendingParcel(entry.id!);
      successCount++;
    } catch (error) {
      console.error("Sync error for entry:", entry, error);
    }
  }

  if (successCount > 0) {
    toast.success(`Successfully synced ${successCount} entries!`, { id: toastId });
  } else {
    toast.dismiss(toastId);
  }
};

// Listen for online status
if (typeof window !== 'undefined') {
  window.addEventListener('online', syncOfflineData);
}
