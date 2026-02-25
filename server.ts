import express from "express";
import { createServer as createViteServer } from "vite";
import { initializeApp } from "firebase/app";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
import dotenv from "dotenv";

dotenv.config();

// Firebase Config (Server-Side)
// Note: In a real production environment, use Admin SDK with service account.
// For this preview environment, we reuse the client config but run it in Node.
// This is acceptable for the preview context where we don't have easy access to service account JSON.
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY || "AIzaSyCKPB2THMJ-CsOOKw23U89xBWwrV13t8a0",
  authDomain: "transporttracker-42f40.firebaseapp.com",
  projectId: "transporttracker-42f40",
  storageBucket: "transporttracker-42f40.firebasestorage.app",
  messagingSenderId: "759721099061",
  appId: "1:759721099061:web:464cb8910b7399bc22d67c",
  measurementId: "G-0L3T7VNLMC"
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Tally Integration
  app.get("/api/tally/check-lr", async (req, res) => {
    try {
      const { lr } = req.query;

      if (!lr) {
        return res.status(400).json({ error: "LR Number is required" });
      }

      const lrNumber = String(lr).trim();
      console.log(`Checking LR: ${lrNumber}`);

      const q = query(collection(db, "parcels"), where("lrNumber", "==", lrNumber));
      const snapshot = await getDocs(q);

      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
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
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production static file serving would go here
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
