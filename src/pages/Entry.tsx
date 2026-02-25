import React, { useState, useEffect, useRef } from 'react';
import { collection, addDoc, getDocs, query, orderBy, Timestamp, updateDoc, where, limit } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { uploadToCloudinary } from '../lib/cloudinary';
import { saveParcelOffline } from '../services/offlineService';
import { generateProfessionalReceipt } from '../services/pdfService';
import { extractParcelDataFromImage } from '../services/geminiService';
import { STATES, Parcel } from '../types';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { 
  Upload, Plus, Camera, X, WifiOff, FileText, Scan, 
  Truck, User, Scale, IndianRupee, Calendar, MapPin, Share2, Loader2 
} from 'lucide-react';
import toast from 'react-hot-toast';
import { handleFirebaseError } from '../lib/firebase-errors';
import imageCompression from 'browser-image-compression';
import { format } from 'date-fns';

export const Entry = () => {
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [parties, setParties] = useState<string[]>([]);
  const [transports, setTransports] = useState<string[]>([]);
  const [sortedStates, setSortedStates] = useState<string[]>([...STATES]);
  
  const [showNewPartyInput, setShowNewPartyInput] = useState(false);
  const [showNewTransportInput, setShowNewTransportInput] = useState(false);
  const [showNewStateInput, setShowNewStateInput] = useState(false);
  const [newPartyName, setNewPartyName] = useState('');
  const [newTransportName, setNewTransportName] = useState('');
  const [newStateName, setNewStateName] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    lrNumber: '',
    partyName: '',
    transport: '',
    state: STATES[0] as string,
    weight: '',
    rate: '',
    totalAmount: '',
    paidAmount: '',
    status: 'pending',
    paymentMode: 'cash',
  });

  const [weightImage, setWeightImage] = useState<File | null>(null);
  const [weightImagePreview, setWeightImagePreview] = useState<string | null>(null);
  const [lastSavedParcel, setLastSavedParcel] = useState<any | null>(null);

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleStatusChange = () => setIsOffline(!navigator.onLine);
    window.addEventListener('online', handleStatusChange);
    window.addEventListener('offline', handleStatusChange);
    return () => {
      window.removeEventListener('online', handleStatusChange);
      window.removeEventListener('offline', handleStatusChange);
    };
  }, []);

  useEffect(() => {
    fetchParties();
    fetchTransports();
    fetchStateStats();
  }, []);

  // ... (Keep existing fetch logic) ...
  const fetchStateStats = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'parcels'));
      const counts: Record<string, number> = {};
      snapshot.forEach(doc => {
        const state = doc.data().state;
        if (state) counts[state] = (counts[state] || 0) + 1;
      });

      const sorted = [...STATES].sort((a, b) => {
        const countA = counts[a] || 0;
        const countB = counts[b] || 0;
        if (countB !== countA) return countB - countA;
        return a.localeCompare(b);
      });
      setSortedStates(sorted);
      if (sorted.length > 0 && !formData.state) {
        setFormData(prev => ({ ...prev, state: sorted[0] }));
      }
    } catch (error) {
      console.error("Error fetching state stats:", error);
    }
  };

  const fetchParties = async () => {
    try {
      const parcelsSnapshot = await getDocs(collection(db, 'parcels'));
      const counts: Record<string, number> = {};
      parcelsSnapshot.forEach(doc => {
        const pName = doc.data().partyName;
        if (pName) counts[pName] = (counts[pName] || 0) + 1;
      });

      const q = query(collection(db, 'parties'), orderBy('name'));
      const snapshot = await getDocs(q);
      const partyList = snapshot.docs.map(doc => doc.data().name);

      const sortedParties = partyList.sort((a, b) => {
        const countA = counts[a] || 0;
        const countB = counts[b] || 0;
        if (countB !== countA) return countB - countA;
        return a.localeCompare(b);
      });

      setParties(sortedParties);
    } catch (error) {
      console.error("Error fetching parties:", error);
    }
  };

  const fetchTransports = async () => {
    try {
      const q = query(collection(db, 'transports'), orderBy('name'));
      const snapshot = await getDocs(q);
      setTransports(snapshot.docs.map(doc => doc.data().name));
    } catch (error) {
      console.error("Error fetching transports:", error);
    }
  };

  // ... (Keep existing add logic) ...
  const handleAddNewParty = async () => {
    if (!newPartyName.trim()) return;
    try {
      await addDoc(collection(db, 'parties'), { name: newPartyName.trim() });
      setParties(prev => [...prev, newPartyName.trim()].sort());
      setFormData(prev => ({ ...prev, partyName: newPartyName.trim() }));
      setNewPartyName('');
      setShowNewPartyInput(false);
      toast.success('Party added successfully');
    } catch (error) {
      handleFirebaseError(error);
    }
  };

  const handleAddNewTransport = async () => {
    if (!newTransportName.trim()) return;
    try {
      await addDoc(collection(db, 'transports'), { name: newTransportName.trim() });
      setTransports(prev => [...prev, newTransportName.trim()].sort());
      setFormData(prev => ({ ...prev, transport: newTransportName.trim() }));
      setNewTransportName('');
      setShowNewTransportInput(false);
      toast.success('Transport added successfully');
    } catch (error) {
      handleFirebaseError(error);
    }
  };

  const handleAddNewState = () => {
    if (!newStateName.trim()) return;
    const upperState = newStateName.trim().toUpperCase();
    if (!sortedStates.includes(upperState)) {
      setSortedStates(prev => [...prev, upperState].sort());
    }
    setFormData(prev => ({ ...prev, state: upperState }));
    setNewStateName('');
    setShowNewStateInput(false);
    toast.success('State added temporarily (will persist after saving entry)');
  };

  // Auto Calculations
  useEffect(() => {
    const weight = parseFloat(formData.weight) || 0;
    const rate = parseFloat(formData.rate) || 0;
    if (weight && rate) {
      setFormData(prev => ({ ...prev, totalAmount: (weight * rate).toFixed(2) }));
    }
  }, [formData.weight, formData.rate]);

  // Rate Suggestion
  useEffect(() => {
    const suggestRate = async () => {
      if (formData.partyName && formData.state && !formData.rate && navigator.onLine) {
        try {
          const q = query(
            collection(db, 'parcels'),
            where('partyName', '==', formData.partyName),
            where('state', '==', formData.state),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          const snapshot = await getDocs(q);
          if (!snapshot.empty) {
            const lastRate = snapshot.docs[0].data().rate;
            if (lastRate) {
              setFormData(prev => ({ ...prev, rate: lastRate.toString() }));
              toast.success(`Suggested rate ₹${lastRate} from previous entry`, { icon: '💡', duration: 3000 });
            }
          }
        } catch (error: any) {
          // If index is missing, fallback to unordered query (best effort)
          if (error.code === 'failed-precondition' || error.message?.includes('index')) {
            console.warn("Index missing for rate suggestion. Falling back to unordered query.");
            try {
              const qFallback = query(
                collection(db, 'parcels'),
                where('partyName', '==', formData.partyName),
                where('state', '==', formData.state),
                limit(1)
              );
              const snapshot = await getDocs(qFallback);
              if (!snapshot.empty) {
                const lastRate = snapshot.docs[0].data().rate;
                if (lastRate) {
                  setFormData(prev => ({ ...prev, rate: lastRate.toString() }));
                  toast.success(`Suggested rate ₹${lastRate} (approximate)`, { icon: '💡', duration: 3000 });
                }
              }
            } catch (fallbackError) {
              console.error("Fallback rate suggestion failed:", fallbackError);
            }
          } else {
            console.error("Error suggesting rate:", error);
          }
        }
      }
    };
    suggestRate();
  }, [formData.partyName, formData.state]);

  // AI Scanner Handler
  const handleAIScan = async (file: File) => {
    if (!file) return;
    setIsScanning(true);
    const toastId = toast.loading("🤖 AI is analyzing the receipt...");
    
    try {
      const data = await extractParcelDataFromImage(file);
      
      setFormData(prev => ({
        ...prev,
        lrNumber: data.lrNumber || prev.lrNumber,
        partyName: data.partyName || prev.partyName,
        weight: data.weight?.toString() || prev.weight,
        totalAmount: data.totalAmount?.toString() || prev.totalAmount,
        // If date is found, we could use it, but keeping current date is usually safer for "Entry Date"
      }));

      toast.success("Data extracted successfully!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Could not extract data. Please fill manually.", { id: toastId });
    } finally {
      setIsScanning(false);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!file) return;
    const options = { maxSizeMB: 0.2, maxWidthOrHeight: 1024, useWebWorker: false };
    try {
      const compressedFile = await imageCompression(file, options);
      const preview = URL.createObjectURL(compressedFile);
      setWeightImage(compressedFile);
      setWeightImagePreview(preview);
    } catch (error) {
      console.error(error);
      toast.error('Image compression failed');
    }
  };

  const handleWhatsAppShare = (parcel: any) => {
    const message = `Hello ${parcel.partyName}, your parcel (LR: ${parcel.lrNumber}) has been booked.\n\nDetails:\nWeight: ${parcel.weight} kg\nAmount: ₹${parcel.totalAmount}\nStatus: ${parcel.status}\n\nTrack here: ${window.location.origin}/search?q=${parcel.lrNumber}`;
    const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // ... (Keep existing submission logic, just updated for new UI structure) ...
    const currentFormData = { ...formData };
    const currentWeightImage = weightImage;

    if (!navigator.onLine) {
       // Offline logic (same as before)
       const toastId = toast.loading('Saving offline...');
       try {
         const parcelData = {
           ...currentFormData,
           weight: parseFloat(currentFormData.weight),
           rate: parseFloat(currentFormData.rate),
           totalAmount: parseFloat(currentFormData.totalAmount),
           paidAmount: parseFloat(currentFormData.paidAmount) || 0,
           weightImageUrl: '',
           date: new Date().toISOString().split('T')[0],
         };
         await saveParcelOffline(parcelData, currentWeightImage);
         toast.success('Saved offline!', { id: toastId });
         resetForm();
       } catch (err) {
         toast.error('Failed to save offline', { id: toastId });
       } finally {
         setLoading(false);
       }
       return;
    }

    const toastId = toast.loading('Saving details...');
    try {
      const parcelData: any = {
        ...currentFormData,
        weight: parseFloat(currentFormData.weight),
        rate: parseFloat(currentFormData.rate),
        totalAmount: parseFloat(currentFormData.totalAmount),
        paidAmount: parseFloat(currentFormData.paidAmount) || 0,
        weightImageUrl: '',
        createdAt: Timestamp.now(),
        createdBy: auth.currentUser?.uid,
        date: new Date().toISOString().split('T')[0],
      };

      const docRef = await addDoc(collection(db, 'parcels'), parcelData);
      const finalParcel = { ...parcelData, id: docRef.id };

      if (currentWeightImage) {
        toast.loading('Uploading image...', { id: toastId });
        try {
          const weightImageUrl = await uploadToCloudinary(currentWeightImage);
          if (weightImageUrl) {
            await updateDoc(docRef, { weightImageUrl });
            finalParcel.weightImageUrl = weightImageUrl;
          }
        } catch (uploadError: any) {
          console.error("Cloudinary upload error:", uploadError);
        }
      }
      
      setLastSavedParcel(finalParcel);
      toast.success('Entry saved!', { id: toastId });
      resetForm();
    } catch (error) {
      console.error(error);
      toast.error('Failed to save entry', { id: toastId });
      handleFirebaseError(error);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      lrNumber: '',
      partyName: '',
      transport: '',
      state: sortedStates[0] || STATES[0],
      weight: '',
      rate: '',
      totalAmount: '',
      paidAmount: '',
      status: 'pending',
      paymentMode: 'cash',
    });
    setWeightImage(null);
    setWeightImagePreview(null);
  };

  return (
    <div className="max-w-3xl mx-auto pb-20">
      {/* Data Entry Form */}
      <div className="w-full">
        <Card className="border-none shadow-none bg-transparent">
          <CardHeader className="px-0 pt-0">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-2xl">New Entry</CardTitle>
                <p className="text-slate-500 text-sm">Create a new parcel record</p>
              </div>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={(e) => e.target.files?.[0] && handleAIScan(e.target.files[0])}
                  disabled={isScanning}
                />
                <Button variant="secondary" className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border-indigo-200" disabled={isScanning}>
                  {isScanning ? <Loader2 className="animate-spin mr-2" size={18} /> : <Scan className="mr-2" size={18} />}
                  {isScanning ? 'Scanning...' : 'AI Scan Bill'}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-0">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <Input
                  label="LR Number"
                  icon={FileText}
                  value={formData.lrNumber}
                  onChange={(e) => setFormData({ ...formData, lrNumber: e.target.value })}
                  required
                  placeholder="12345"
                />

                {/* Party Name with Autocomplete */}
                <div className="space-y-1 relative">
                  {!showNewPartyInput ? (
                    <div className="flex gap-3 items-start">
                       <div className="flex-1">
                        <Select
                          label="Party Name"
                          icon={User}
                          options={[
                            { value: "", label: "Select Party" },
                            ...parties.map(p => ({ value: p, label: p }))
                          ]}
                          value={formData.partyName}
                          onChange={(e) => setFormData({ ...formData, partyName: e.target.value })}
                          required
                        />
                      </div>
                      <Button type="button" variant="outline" className="h-14 w-14 p-0 shrink-0 rounded-xl border-slate-200 hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 transition-all" onClick={() => setShowNewPartyInput(true)}>
                        <Plus size={24} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <Input
                          icon={User}
                          value={newPartyName}
                          onChange={(e) => setNewPartyName(e.target.value)}
                          placeholder="New Party Name"
                          autoFocus
                          label="New Party Name"
                        />
                      </div>
                      <Button type="button" onClick={handleAddNewParty} className="h-14 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700">Add</Button>
                      <Button type="button" variant="ghost" onClick={() => setShowNewPartyInput(false)} className="h-14 w-14 p-0 rounded-xl">
                        <X size={24} />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-1 relative">
                  {!showNewTransportInput ? (
                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <Select
                          label="Transport"
                          icon={Truck}
                          options={[
                            { value: "", label: "Select Transport" },
                            ...transports.map(t => ({ value: t, label: t }))
                          ]}
                          value={formData.transport}
                          onChange={(e) => setFormData({ ...formData, transport: e.target.value })}
                        />
                      </div>
                      <Button type="button" variant="outline" className="h-14 w-14 p-0 shrink-0 rounded-xl border-slate-200 hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 transition-all" onClick={() => setShowNewTransportInput(true)}>
                        <Plus size={24} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <Input
                          icon={Truck}
                          value={newTransportName}
                          onChange={(e) => setNewTransportName(e.target.value)}
                          placeholder="New Transport"
                          autoFocus
                          label="New Transport"
                        />
                      </div>
                      <Button type="button" onClick={handleAddNewTransport} className="h-14 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700">Add</Button>
                      <Button type="button" variant="ghost" onClick={() => setShowNewTransportInput(false)} className="h-14 w-14 p-0 rounded-xl">
                        <X size={24} />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-1 relative">
                  {!showNewStateInput ? (
                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <Select
                          label="State"
                          icon={MapPin}
                          options={sortedStates.map(s => ({ value: s, label: s }))}
                          value={formData.state}
                          onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                        />
                      </div>
                      <Button type="button" variant="outline" className="h-14 w-14 p-0 shrink-0 rounded-xl border-slate-200 hover:bg-slate-50 hover:border-indigo-200 hover:text-indigo-600 transition-all" onClick={() => setShowNewStateInput(true)}>
                        <Plus size={24} />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-3 items-start">
                      <div className="flex-1">
                        <Input
                          icon={MapPin}
                          value={newStateName}
                          onChange={(e) => setNewStateName(e.target.value)}
                          placeholder="New State"
                          autoFocus
                          label="New State"
                        />
                      </div>
                      <Button type="button" onClick={handleAddNewState} className="h-14 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700">Add</Button>
                      <Button type="button" variant="ghost" onClick={() => setShowNewStateInput(false)} className="h-14 w-14 p-0 rounded-xl">
                        <X size={24} />
                      </Button>
                    </div>
                  )}
                </div>

                <Input
                  label="Weight (KG)"
                  icon={Scale}
                  type="number"
                  step="0.01"
                  value={formData.weight}
                  onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                  required
                />

                <Input
                  label="Rate"
                  icon={IndianRupee}
                  type="number"
                  step="0.01"
                  value={formData.rate}
                  onChange={(e) => setFormData({ ...formData, rate: e.target.value })}
                  required
                />

                <Input
                  label="Total Amount"
                  icon={IndianRupee}
                  type="number"
                  value={formData.totalAmount}
                  readOnly
                  className="bg-slate-100 font-bold text-slate-700"
                />

                <Select
                  label="Status"
                  options={[
                    { value: 'pending', label: 'Pending' },
                    { value: 'paid', label: 'Paid' },
                    { value: 'partial', label: 'Partial' },
                  ]}
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                />

                <Input
                  label="Paid Amount"
                  icon={IndianRupee}
                  type="number"
                  value={formData.paidAmount}
                  onChange={(e) => setFormData({ ...formData, paidAmount: e.target.value })}
                />
              </div>

              {/* Image Upload */}
              <div className="space-y-3">
                <p className="block text-sm font-medium text-slate-700 mb-1">Weight Proof</p>
                
                {weightImagePreview ? (
                  <div className="relative h-48 w-full border-2 border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                    <img 
                      src={weightImagePreview} 
                      alt="Preview" 
                      className="h-full w-full object-contain" 
                      referrerPolicy="no-referrer"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setWeightImage(null);
                        setWeightImagePreview(null);
                      }}
                      className="absolute top-2 right-2 bg-red-500 text-white p-1.5 rounded-full z-20 hover:bg-red-600 transition-colors shadow-sm"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {/* Camera Button */}
                    <div 
                      onClick={() => cameraInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-indigo-50 hover:border-indigo-300 transition-all cursor-pointer group h-32 active:scale-95 transform duration-100"
                    >
                      <input
                        ref={cameraInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                      />
                      <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full mb-2 group-hover:scale-110 transition-transform shadow-sm">
                        <Camera size={24} />
                      </div>
                      <p className="font-medium text-slate-900 text-sm">Take Photo</p>
                    </div>

                    {/* Gallery Button */}
                    <div 
                      onClick={() => galleryInputRef.current?.click()}
                      className="border-2 border-dashed border-slate-300 rounded-xl p-4 flex flex-col items-center justify-center text-center hover:bg-indigo-50 hover:border-indigo-300 transition-all cursor-pointer group h-32 active:scale-95 transform duration-100"
                    >
                      <input
                        ref={galleryInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && handleImageUpload(e.target.files[0])}
                      />
                      <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full mb-2 group-hover:scale-110 transition-transform shadow-sm">
                        <Upload size={24} />
                      </div>
                      <p className="font-medium text-slate-900 text-sm">Upload File</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button type="submit" size="lg" isLoading={loading} className="w-full md:w-auto bg-slate-900 hover:bg-slate-800">
                  Save Entry
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Modal
        isOpen={!!lastSavedParcel}
        onClose={() => setLastSavedParcel(null)}
        title="Entry Saved Successfully"
      >
        <div className="flex flex-col items-center justify-center p-6 text-center">
          <div className="h-16 w-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mb-4">
            <FileText size={32} />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">Entry Saved!</h3>
          <p className="text-slate-500 mb-6">LR No: {lastSavedParcel?.lrNumber}</p>
          
          <div className="flex flex-col gap-3 w-full max-w-xs">
            <Button onClick={() => generateProfessionalReceipt(lastSavedParcel)} className="w-full">
              <FileText className="mr-2" size={18} /> Download PDF
            </Button>
            <Button variant="outline" onClick={() => handleWhatsAppShare(lastSavedParcel)} className="w-full border-green-200 text-green-700 hover:bg-green-50">
              <Share2 className="mr-2" size={18} /> Share on WhatsApp
            </Button>
            <Button variant="ghost" onClick={() => setLastSavedParcel(null)} className="w-full">
              Create New Entry
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
