import { VercelRequest, VercelResponse } from '@vercel/node';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";

// Firebase Config
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyCKPB2THMJ-CsOOKw23U89xBWwrV13t8a0",
  authDomain: "transporttracker-42f40.firebaseapp.com",
  projectId: "transporttracker-42f40",
  storageBucket: "transporttracker-42f40.firebasestorage.app",
  messagingSenderId: "759721099061",
  appId: "1:759721099061:web:464cb8910b7399bc22d67c",
  measurementId: "G-0L3T7VNLMC"
};

// Initialize Firebase (Singleton pattern for serverless)
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { lr, format } = req.query;

    if (!lr) {
      return res.status(400).json({ error: "LR Number is required" });
    }

    const lrNumber = String(lr).trim();
    
    const q = query(collection(db, "parcels"), where("lrNumber", "==", lrNumber));
    const snapshot = await getDocs(q);

    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      const data = doc.data();
      
      if (format === 'text') {
        // Format: STATUS|TRANSPORT|WEIGHT|AMOUNT
        return res.send(`RECEIVED|${data.transport || 'Unknown'}|${data.weight || '0'}kg|${data.totalAmount || '0'}`);
      }

      return res.json({
        found: true,
        status: "received",
        message: "Received",
        details: {
          lrNumber: data.lrNumber,
          partyName: data.partyName,
          transport: data.transport,
          weight: data.weight,
          totalAmount: data.totalAmount
        }
      });
    } else {
      if (format === 'text') {
        return res.send("NOT_RECEIVED|||");
      }

      return res.json({
        found: false,
        status: "not_received",
        message: "Not Received"
      });
    }
  } catch (error) {
    console.error("Error checking LR:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
}
