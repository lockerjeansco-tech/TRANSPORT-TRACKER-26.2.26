import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  onSnapshot,
  addDoc,
  doc, 
  updateDoc, 
  deleteDoc, 
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { uploadToCloudinary } from '../lib/cloudinary';
import { Payment } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { 
  Plus, 
  Search as SearchIcon, 
  Trash2, 
  Edit2, 
  Image as ImageIcon, 
  Upload, 
  Eye,
  Calendar,
  Truck,
  FileText,
  X,
  AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

export const Payments = () => {
  const { isAdmin } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [filteredPayments, setFilteredPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [transports, setTransports] = useState<string[]>([]);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [transportFilter, setTransportFilter] = useState('all');

  // Form State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    transportName: '',
    paymentDate: new Date().toISOString().split('T')[0],
    fromDate: '',
    toDate: '',
    amount: '',
    narration: '',
  });
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  
  // Edit State
  const [editingPayment, setEditingPayment] = useState<Payment | null>(null);
  const [editSignatureFile, setEditSignatureFile] = useState<File | null>(null);

  // Preview State
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    isLoading: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    isLoading: false,
  });

  useEffect(() => {
    fetchTransports();
    
    const q = query(collection(db, 'payments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Payment));
      setPayments(data);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to payments:", error);
      toast.error('Failed to sync payments');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    filterData();
  }, [searchTerm, dateFrom, dateTo, transportFilter, payments]);

  const fetchTransports = async () => {
    try {
      const q = query(collection(db, 'transports'), orderBy('name'));
      const snapshot = await getDocs(q);
      setTransports(snapshot.docs.map(doc => doc.data().name));
    } catch (error) {
      console.error("Error fetching transports:", error);
    }
  };

  const filterData = () => {
    let result = [...payments];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.transportName.toLowerCase().includes(lower) || 
        p.narration.toLowerCase().includes(lower)
      );
    }

    if (dateFrom) {
      result = result.filter(p => p.paymentDate >= dateFrom);
    }

    if (dateTo) {
      result = result.filter(p => p.paymentDate <= dateTo);
    }

    if (transportFilter !== 'all') {
      result = result.filter(p => p.transportName === transportFilter);
    }

    setFilteredPayments(result);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSignatureFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setSignaturePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.transportName) {
      toast.error('Please select a transport');
      return;
    }
    const toastId = toast.loading('Saving payment...');
    
    try {
      let signatureImageUrl = '';
      
      if (signatureFile) {
        toast.loading('Uploading signature to Cloudinary...', { id: toastId });
        try {
          signatureImageUrl = await uploadToCloudinary(signatureFile);
        } catch (uploadError: any) {
          console.error("Cloudinary upload error:", uploadError);
          throw new Error(`Upload failed: ${uploadError.message || 'Unknown error'}`);
        }
      }

      const paymentData = {
        transportName: formData.transportName,
        paymentDate: formData.paymentDate,
        fromDate: formData.fromDate,
        toDate: formData.toDate,
        amount: parseFloat(formData.amount),
        narration: formData.narration,
        signatureImageUrl,
        createdAt: Timestamp.now(),
        createdBy: auth.currentUser?.uid,
      };

      await addDoc(collection(db, 'payments'), paymentData);
      
      toast.success('Payment recorded successfully', { id: toastId });
      setIsAddModalOpen(false);
      setFormData({
        transportName: '',
        paymentDate: new Date().toISOString().split('T')[0],
        fromDate: '',
        toDate: '',
        amount: '',
        narration: '',
      });
      setSignatureFile(null);
      setSignaturePreview(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to record payment. Check your internet or permissions.', { id: toastId });
    }
  };

  const handleUpdatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Permission denied. Only admins can edit payments.');
      return;
    }
    if (!editingPayment || !editingPayment.id) return;
    
    const toastId = toast.loading('Updating payment...');
    
    try {
      let signatureImageUrl = editingPayment.signatureImageUrl;
      
      if (editSignatureFile) {
        toast.loading('Uploading new signature to Cloudinary...', { id: toastId });
        try {
          signatureImageUrl = await uploadToCloudinary(editSignatureFile);
        } catch (uploadError: any) {
          console.error("Cloudinary upload error:", uploadError);
          throw new Error(`Upload failed: ${uploadError.message || 'Unknown error'}`);
        }
      }

      const docRef = doc(db, 'payments', editingPayment.id);
      await updateDoc(docRef, {
        transportName: editingPayment.transportName,
        paymentDate: editingPayment.paymentDate,
        fromDate: editingPayment.fromDate,
        toDate: editingPayment.toDate,
        amount: parseFloat(editingPayment.amount.toString()),
        narration: editingPayment.narration,
        signatureImageUrl,
      });
      
      toast.success('Payment updated successfully', { id: toastId });
      setIsEditModalOpen(false);
      setEditSignatureFile(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to update payment', { id: toastId });
    }
  };

  const handleDeletePayment = async (id: string) => {
    if (!isAdmin) {
      toast.error('Permission denied. Only admins can delete payments.');
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Delete Payment Record',
      message: 'Are you sure you want to delete this payment record? This action cannot be undone.',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        const toastId = toast.loading('Deleting payment...');
        try {
          await deleteDoc(doc(db, 'payments', id));
          toast.success('Payment deleted successfully', { id: toastId });
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (error: any) {
          console.error("Delete error:", error);
          toast.error(`Delete failed: ${error.message || 'Unknown error'}`, { id: toastId });
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Payment Management
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Live Sync Active"></span>
          </h2>
          <p className="text-sm text-slate-500">Manage transporter payments and signatures.</p>
        </div>
        <Button onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} className="mr-2" /> New Payment
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Input
              placeholder="Search narration or transport..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              label="Search"
            />
            <Select
              options={[
                { value: 'all', label: 'All Transports' },
                ...transports.map(t => ({ value: t, label: t }))
              ]}
              value={transportFilter}
              onChange={(e) => setTransportFilter(e.target.value)}
              label="Transport"
            />
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              label="From (Payment Date)"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              label="To (Payment Date)"
            />
          </div>
        </CardContent>
      </Card>

      {/* Payments Table */}
      <Card>
        <CardHeader className="pb-0">
          <CardTitle className="text-lg">Payment Records</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-y border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">Date</th>
                  <th className="px-4 py-3 font-semibold">Transport</th>
                  <th className="px-4 py-3 font-semibold">Period</th>
                  <th className="px-4 py-3 font-semibold text-right">Amount</th>
                  <th className="px-4 py-3 font-semibold">Narration</th>
                  <th className="px-4 py-3 font-semibold text-center">Signature</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">Loading payments...</td>
                  </tr>
                ) : filteredPayments.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400">No payment records found.</td>
                  </tr>
                ) : (
                  filteredPayments.map((payment) => (
                    <tr key={payment.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium">{payment.paymentDate}</td>
                      <td className="px-4 py-3">{payment.transportName}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {payment.fromDate} to {payment.toDate}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-900">
                        ₹{payment.amount.toLocaleString()}
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate" title={payment.narration}>
                        {payment.narration}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {payment.signatureImageUrl ? (
                          <div 
                            onClick={() => setPreviewImage({ url: payment.signatureImageUrl!, title: `Signature - ${payment.transportName}` })}
                            className="h-10 w-10 mx-auto rounded border border-slate-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all"
                          >
                            <img 
                              src={payment.signatureImageUrl} 
                              alt="Sig" 
                              className="h-full w-full object-cover" 
                              referrerPolicy="no-referrer"
                            />
                          </div>
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              setEditingPayment(payment);
                              setIsEditModalOpen(true);
                            }}
                            disabled={!isAdmin}
                          >
                            <Edit2 size={16} />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="text-red-600 hover:bg-red-50"
                            onClick={() => payment.id && handleDeletePayment(payment.id)}
                            disabled={!isAdmin}
                          >
                            <Trash2 size={16} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Add Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Record New Payment"
        className="max-w-xl"
      >
        <form onSubmit={handleAddPayment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Transport"
              options={[
                { value: '', label: 'Select Transport' },
                ...transports.map(t => ({ value: t, label: t }))
              ]}
              value={formData.transportName}
              onChange={(e) => setFormData({ ...formData, transportName: e.target.value })}
              required
            />
            <Input
              label="Payment Date"
              type="date"
              value={formData.paymentDate}
              onChange={(e) => setFormData({ ...formData, paymentDate: e.target.value })}
              required
            />
            <Input
              label="From Date (Period)"
              type="date"
              value={formData.fromDate}
              onChange={(e) => setFormData({ ...formData, fromDate: e.target.value })}
              required
            />
            <Input
              label="To Date (Period)"
              type="date"
              value={formData.toDate}
              onChange={(e) => setFormData({ ...formData, toDate: e.target.value })}
              required
            />
            <Input
              label="Amount (₹)"
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
              required
            />
            <div className="md:col-span-2">
              <Input
                label="Narration"
                value={formData.narration}
                onChange={(e) => setFormData({ ...formData, narration: e.target.value })}
                placeholder="e.g. Payment for February first week"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-slate-700 block mb-1">Transporter Signature Image</label>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                  />
                </div>
                {signaturePreview && (
                  <div className="h-16 w-16 rounded border border-slate-200 overflow-hidden bg-slate-50">
                    <img src={signaturePreview} alt="Preview" className="h-full w-full object-cover" />
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsAddModalOpen(false)}>Cancel</Button>
            <Button type="submit">Save Payment</Button>
          </div>
        </form>
      </Modal>

      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Payment Record"
        className="max-w-xl"
      >
        {editingPayment && (
          <form onSubmit={handleUpdatePayment} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Transport"
                options={[
                  { value: '', label: 'Select Transport' },
                  ...transports.map(t => ({ value: t, label: t }))
                ]}
                value={editingPayment.transportName}
                onChange={(e) => setEditingPayment({ ...editingPayment, transportName: e.target.value })}
                required
              />
              <Input
                label="Payment Date"
                type="date"
                value={editingPayment.paymentDate}
                onChange={(e) => setEditingPayment({ ...editingPayment, paymentDate: e.target.value })}
                required
              />
              <Input
                label="From Date"
                type="date"
                value={editingPayment.fromDate}
                onChange={(e) => setEditingPayment({ ...editingPayment, fromDate: e.target.value })}
                required
              />
              <Input
                label="To Date"
                type="date"
                value={editingPayment.toDate}
                onChange={(e) => setEditingPayment({ ...editingPayment, toDate: e.target.value })}
                required
              />
              <Input
                label="Amount"
                type="number"
                value={editingPayment.amount}
                onChange={(e) => setEditingPayment({ ...editingPayment, amount: parseFloat(e.target.value) })}
                required
              />
              <div className="md:col-span-2">
                <Input
                  label="Narration"
                  value={editingPayment.narration}
                  onChange={(e) => setEditingPayment({ ...editingPayment, narration: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-slate-700 block mb-1">Update Signature Image</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && setEditSignatureFile(e.target.files[0])}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
                {editingPayment.signatureImageUrl && !editSignatureFile && (
                  <p className="text-xs text-green-600 mt-1">✓ Current signature exists</p>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button type="submit">Update Record</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Image Preview Modal */}
      <Modal
        isOpen={!!previewImage}
        onClose={() => setPreviewImage(null)}
        title={previewImage?.title || 'Image Preview'}
        className="max-w-4xl"
      >
        {previewImage && (
          <div className="flex flex-col items-center">
            <div className="relative w-full h-[60vh] bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center">
              <img 
                src={previewImage.url} 
                alt={previewImage.title} 
                className="max-w-full max-h-full object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex justify-end w-full mt-4 gap-2">
              <Button variant="outline" onClick={() => window.open(previewImage.url, '_blank')}>
                Open Original
              </Button>
              <Button onClick={() => setPreviewImage(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => !confirmModal.isLoading && setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600 bg-amber-50 p-3 rounded-lg border border-amber-100">
            <AlertTriangle size={24} />
            <p className="text-sm font-medium">{confirmModal.message}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button 
              variant="outline" 
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              disabled={confirmModal.isLoading}
            >
              Cancel
            </Button>
            <Button 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={confirmModal.onConfirm}
              disabled={confirmModal.isLoading}
            >
              {confirmModal.isLoading ? 'Deleting...' : 'Delete Permanently'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
