export type UserRole = 'admin' | 'staff';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  displayName?: string;
}

export interface Parcel {
  id?: string;
  lrNumber: string;
  partyName: string;
  state: string;
  weight: number;
  rate: number;
  totalAmount: number;
  paidAmount: number;
  status: 'paid' | 'pending' | 'partial';
  paymentMode?: 'cash' | 'bank';
  transport?: string;
  weightImageUrl?: string;
  createdAt: any; // Firestore Timestamp
  createdBy: string;
  date: string; // ISO string for easier filtering YYYY-MM-DD
}

export interface Party {
  id?: string;
  name: string;
}

export interface Payment {
  id?: string;
  transportName: string;
  paymentDate: string;
  fromDate: string;
  toDate: string;
  amount: number;
  narration: string;
  signatureImageUrl?: string;
  createdAt: any;
  createdBy: string;
}

export const STATES = [
  'DELHI',
  'LUDHIANA',
  'ULHASNAGAR',
  'BANGALORE',
  'AHMEDABAD',
  'KOLKATA',
  'MUMBAI',
  'RAYDURGA'
] as const;
