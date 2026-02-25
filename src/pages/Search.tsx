import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  orderBy, 
  getDocs, 
  onSnapshot,
  where, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { uploadToCloudinary } from '../lib/cloudinary';
import { Parcel, STATES } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal } from '../components/ui/Modal';
import { Card, CardContent } from '../components/ui/Card';
import { cn } from '../lib/utils';
import { 
  Search as SearchIcon, 
  Filter, 
  Download, 
  Upload, 
  Trash2, 
  Edit, 
  Eye, 
  CheckSquare, 
  Square, 
  FileSpreadsheet, 
  FileText,
  MoreHorizontal,
  Image as ImageIcon,
  PenTool,
  AlertTriangle
} from 'lucide-react';
import { generateProfessionalReceipt } from '../services/pdfService';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

export const Search = () => {
  const { isAdmin } = useAuth();
  const [parcels, setParcels] = useState<Parcel[]>([]);
  const [filteredParcels, setFilteredParcels] = useState<Parcel[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [sortedStates, setSortedStates] = useState<string[]>([...STATES]);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

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

  // Modal
  const [selectedParcel, setSelectedParcel] = useState<Parcel | null>(null);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editFormData, setEditFormData] = useState<Parcel | null>(null);
  const [editWeightFile, setEditWeightFile] = useState<File | null>(null);
  
  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'parcels'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Parcel));
      setParcels(data);
      setLoading(false);
    }, (error) => {
      console.error("Error listening to parcels:", error);
      toast.error('Failed to sync data');
      setLoading(false);
    });

    fetchStateStats();

    return () => unsubscribe();
  }, []);

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
    } catch (error) {
      console.error("Error fetching state stats:", error);
    }
  };

  useEffect(() => {
    if (editFormData) {
      const weight = Number(editFormData.weight) || 0;
      const rate = Number(editFormData.rate) || 0;
      const total = (weight * rate).toFixed(2);
      if (Number(editFormData.totalAmount) !== Number(total)) {
        setEditFormData(prev => prev ? ({ ...prev, totalAmount: Number(total) }) : null);
      }
    }
  }, [editFormData?.weight, editFormData?.rate]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) {
      toast.error('Permission denied. Only admins can edit entries.');
      return;
    }
    if (!editFormData || !editFormData.id) return;

    const toastId = toast.loading('Updating parcel...');

    try {
      let weightImageUrl = editFormData.weightImageUrl;

      // Upload new images if selected
      if (editWeightFile) {
        toast.loading('Uploading weight proof to Cloudinary...', { id: toastId });
        try {
          weightImageUrl = await uploadToCloudinary(editWeightFile);
        } catch (uploadError: any) {
          console.error("Cloudinary upload error:", uploadError);
          throw new Error(`Image upload failed: ${uploadError.message}`);
        }
      }

      const docRef = doc(db, 'parcels', editFormData.id);
      await updateDoc(docRef, {
        lrNumber: editFormData.lrNumber,
        partyName: editFormData.partyName,
        state: editFormData.state,
        weight: Number(editFormData.weight),
        rate: Number(editFormData.rate),
        totalAmount: Number(editFormData.totalAmount),
        paidAmount: Number(editFormData.paidAmount),
        status: editFormData.status,
        paymentMode: editFormData.paymentMode,
        date: editFormData.date,
        weightImageUrl,
      });
      
      toast.success('Parcel updated successfully', { id: toastId });
      setIsEditModalOpen(false);
      setEditWeightFile(null);
      fetchParcels();
    } catch (error) {
      console.error(error);
      toast.error('Failed to update parcel', { id: toastId });
    }
  };

  useEffect(() => {
    filterData();
  }, [searchTerm, dateFrom, dateTo, statusFilter, stateFilter, sortBy, parcels]);

  const fetchParcels = async () => {
    // Handled by onSnapshot
  };

  const filterData = () => {
    let result = [...parcels];

    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.lrNumber.toLowerCase().includes(lower) || 
        p.partyName.toLowerCase().includes(lower)
      );
    }

    if (dateFrom) {
      result = result.filter(p => p.date >= dateFrom);
    }

    if (dateTo) {
      result = result.filter(p => p.date <= dateTo);
    }

    if (statusFilter !== 'all') {
      result = result.filter(p => p.status === statusFilter);
    }

    if (stateFilter !== 'all') {
      result = result.filter(p => p.state === stateFilter);
    }

    // Sorting
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.date || b.createdAt?.toDate()).getTime() - new Date(a.date || a.createdAt?.toDate()).getTime();
        case 'date-asc':
          return new Date(a.date || a.createdAt?.toDate()).getTime() - new Date(b.date || b.createdAt?.toDate()).getTime();
        case 'amount-desc':
          return (b.totalAmount || 0) - (a.totalAmount || 0);
        case 'amount-asc':
          return (a.totalAmount || 0) - (b.totalAmount || 0);
        case 'status-paid': // Paid first
           return (a.status === 'paid' ? -1 : 1) - (b.status === 'paid' ? -1 : 1);
        case 'status-pending': // Pending first
           return (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1);
        default:
          return 0;
      }
    });

    setFilteredParcels(result);
  };

  // Stats for current view
  const totalWeight = filteredParcels.reduce((sum, p) => sum + (Number(p.weight) || 0), 0);
  const totalAmount = filteredParcels.reduce((sum, p) => sum + (Number(p.totalAmount) || 0), 0);
  const totalPaid = filteredParcels.reduce((sum, p) => sum + (Number(p.paidAmount) || 0), 0);
  const totalPending = totalAmount - totalPaid;

  // Search Stats for LR
  const searchStats = React.useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return null;
    const lowerSearch = searchTerm.toLowerCase();
    
    // Find all unique LR numbers that match the search term
    const matchingLRs = new Set<string>(
      parcels
        .filter(p => String(p.lrNumber || '').toLowerCase().includes(lowerSearch))
        .map(p => String(p.lrNumber || ''))
    );

    if (matchingLRs.size === 0) return null;

    // If there's an exact match, prioritize it
    const exactLR = Array.from(matchingLRs).find(lr => lr.toLowerCase() === lowerSearch);
    
    if (exactLR) {
      const count = parcels.filter(p => p.lrNumber === exactLR).length;
      return { lr: exactLR, count, isExact: true };
    }

    // If only one LR matches partially
    if (matchingLRs.size === 1) {
      const lr = Array.from(matchingLRs)[0];
      const count = parcels.filter(p => p.lrNumber === lr).length;
      return { lr, count, isExact: false };
    }

    return null;
  }, [searchTerm, parcels]);

  // Bulk Actions
  const handleSelectAll = () => {
    if (selectedIds.size === filteredParcels.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredParcels.map(p => p.id!)));
    }
  };

  const toggleSelection = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleBulkStatusUpdate = async (status: 'paid' | 'pending') => {
    if (!isAdmin) {
      toast.error('Permission denied. Only admins can update status.');
      return;
    }
    if (selectedIds.size === 0) return;
    if (!confirm(`Mark ${selectedIds.size} items as ${status}?`)) return;

    try {
      const batch = writeBatch(db);
      selectedIds.forEach(id => {
        const parcel = parcels.find(p => p.id === id);
        if (!parcel) return;

        const ref = doc(db, 'parcels', id);
        const updates: any = { status };
        
        if (status === 'paid') {
          updates.paidAmount = parcel.totalAmount;
        } else if (status === 'pending') {
          updates.paidAmount = 0;
        }
        
        batch.update(ref, updates);
      });
      await batch.commit();
      toast.success('Bulk update successful');
      fetchParcels();
      setSelectedIds(new Set());
    } catch (error) {
      toast.error('Bulk update failed');
    }
  };

  const handleBulkDelete = async () => {
    if (!isAdmin) {
      toast.error('Permission denied. Only admins can delete entries.');
      return;
    }
    if (selectedIds.size === 0) return;
    
    setConfirmModal({
      isOpen: true,
      title: 'Bulk Delete',
      message: `Are you sure you want to delete ${selectedIds.size} items? This action cannot be undone.`,
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        const toastId = toast.loading(`Deleting ${selectedIds.size} items...`);
        try {
          const batch = writeBatch(db);
          selectedIds.forEach(id => {
            const parcelRef = doc(db, 'parcels', id);
            batch.delete(parcelRef);
          });
          await batch.commit();
          toast.success('Bulk delete successful', { id: toastId });
          fetchParcels();
          setSelectedIds(new Set());
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (error: any) {
          console.error("Bulk delete error:", error);
          toast.error(`Bulk delete failed: ${error.message || 'Unknown error'}`, { id: toastId });
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  const handleDelete = async (id: string) => {
    if (!isAdmin) {
      toast.error('Permission denied. Only admins can delete entries.');
      return;
    }
    
    setConfirmModal({
      isOpen: true,
      title: 'Delete Record',
      message: 'Are you sure you want to delete this record? This action cannot be undone.',
      isLoading: false,
      onConfirm: async () => {
        setConfirmModal(prev => ({ ...prev, isLoading: true }));
        const toastId = toast.loading('Deleting record...');
        try {
          await deleteDoc(doc(db, 'parcels', id));
          toast.success('Record deleted', { id: toastId });
          fetchParcels();
          setConfirmModal(prev => ({ ...prev, isOpen: false, isLoading: false }));
        } catch (error: any) {
          console.error("Delete error:", error);
          toast.error(`Delete failed: ${error.message || 'Unknown error'}`, { id: toastId });
          setConfirmModal(prev => ({ ...prev, isLoading: false }));
        }
      }
    });
  };

  // Export/Import
  const exportExcel = () => {
    const dataToExport = filteredParcels.map(p => ({
      Date: p.date,
      LR_Number: p.lrNumber,
      Party: p.partyName,
      State: p.state,
      Weight: p.weight,
      Rate: p.rate,
      Total_Amount: p.totalAmount,
      Paid_Amount: p.paidAmount,
      Status: p.status,
      Payment_Mode: p.paymentMode,
      Weight_Image_URL: p.weightImageUrl || '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Parcels");
    XLSX.writeFile(wb, `Transport_Data_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text("Transport Parcel Report", 14, 15);
    doc.text(`Generated: ${format(new Date(), 'PP')}`, 14, 22);
    
    const tableData = filteredParcels.map(p => [
      p.date,
      p.lrNumber,
      p.partyName,
      p.state,
      p.weight,
      p.totalAmount,
      p.status,
      p.weightImageUrl ? 'View' : '-',
    ]);

    autoTable(doc, {
      head: [['Date', 'LR No', 'Party', 'State', 'Weight', 'Amount', 'Status', 'Weight Img']],
      body: tableData,
      startY: 30,
      didDrawCell: (data) => {
        if (data.section === 'body' && data.column.index === 7) {
          const parcel = filteredParcels[data.row.index];
          const url = parcel.weightImageUrl;
          
          if (url) {
            doc.link(data.cell.x, data.cell.y, data.cell.width, data.cell.height, { url });
          }
        }
      }
    });

    doc.save(`Transport_Report_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    
    reader.onload = async (evt) => {
      const toastId = toast.loading('Reading file...');
      try {
        const content = evt.target?.result;
        if (!content) throw new Error('Failed to read file content');
        
        let data: any[] = [];

        if (file.name.endsWith('.json')) {
          data = JSON.parse(content as string);
          if (!Array.isArray(data)) throw new Error('JSON must be an array of objects');
        } else if (file.name.endsWith('.pdf')) {
          try {
            toast.loading('Parsing PDF...', { id: toastId });
            // Set worker source for pdf.js
            pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
            
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(content as ArrayBuffer) });
            const pdf = await loadingTask.promise;
            const maxPages = pdf.numPages;
            const allRows: any[] = [];

            if (maxPages === 0) throw new Error("The PDF file is empty.");

            for (let i = 1; i <= maxPages; i++) {
              const page = await pdf.getPage(i);
              const textContent = await page.getTextContent();
              
              if (textContent.items.length === 0) {
                console.warn(`Page ${i} has no text content. It might be a scanned image.`);
                continue;
              }
              
              const rows: { [key: number]: { x: number, text: string }[] } = {};
              const tolerance = 5; 
              
              textContent.items.forEach((item: any) => {
                const y = item.transform[5];
                const x = item.transform[4];
                const text = item.str.trim();
                
                if (text) {
                  let foundY = Object.keys(rows).map(Number).find(ry => Math.abs(ry - y) < tolerance);
                  if (foundY === undefined) {
                    foundY = y;
                    rows[foundY] = [];
                  }
                  rows[foundY].push({ x, text });
                }
              });

              const sortedY = Object.keys(rows).map(Number).sort((a, b) => b - a);
              const pageRows = sortedY.map(y => {
                return rows[y].sort((a, b) => a.x - b.x).map(item => item.text);
              });

              let headerMap: { [key: string]: number } = {};
              let foundHeader = false;

              pageRows.forEach(row => {
                const rowStr = row.join(' ').toLowerCase();
                
                if (!foundHeader && (rowStr.includes('date') || rowStr.includes('lr no') || rowStr.includes('party') || rowStr.includes('lr number'))) {
                  row.forEach((cell, idx) => {
                    const c = cell.toLowerCase();
                    if (c.includes('date')) headerMap.date = idx;
                    else if (c.includes('lr no') || c.includes('lr number')) headerMap.lr = idx;
                    else if (c.includes('party')) headerMap.party = idx;
                    else if (c.includes('state')) headerMap.state = idx;
                    else if (c.includes('weight')) headerMap.weight = idx;
                    else if (c.includes('amount')) headerMap.amount = idx;
                    else if (c.includes('status')) headerMap.status = idx;
                  });
                  if (Object.keys(headerMap).length >= 2) {
                    foundHeader = true;
                    return;
                  }
                }
                
                if (foundHeader && row.length >= 2) {
                  const entry: any = {};
                  if (headerMap.date !== undefined && row[headerMap.date]) entry.Date = row[headerMap.date];
                  if (headerMap.lr !== undefined && row[headerMap.lr]) entry.LR_Number = row[headerMap.lr];
                  if (headerMap.party !== undefined && row[headerMap.party]) entry.Party = row[headerMap.party];
                  if (headerMap.state !== undefined && row[headerMap.state]) entry.State = row[headerMap.state];
                  if (headerMap.weight !== undefined && row[headerMap.weight]) entry.Weight = row[headerMap.weight];
                  if (headerMap.amount !== undefined && row[headerMap.amount]) entry.Total_Amount = row[headerMap.amount];
                  if (headerMap.status !== undefined && row[headerMap.status]) entry.Status = row[headerMap.status];

                  if (entry.LR_Number || entry.Party) {
                    allRows.push(entry);
                  }
                } else if (!foundHeader && row.length >= 3) {
                  const entry: any = {};
                  const dateRegex = /(\d{1,4}[-/]\d{1,2}[-/]\d{1,4})/;
                  const dateIdx = row.findIndex(c => dateRegex.test(c));
                  if (dateIdx !== -1) entry.Date = row[dateIdx];
                  
                  const lrIdx = row.findIndex((c, idx) => idx !== dateIdx && (c.length >= 3 && /^[0-9]+$/.test(c)));
                  if (lrIdx !== -1) entry.LR_Number = row[lrIdx];
                  
                  const partyIdx = row.findIndex((c, idx) => idx !== dateIdx && idx !== lrIdx && c.length > 3 && isNaN(Number(c)) && !['DELHI', 'HARYANA', 'PUNJAB', 'UP', 'RAJASTHAN'].includes(c.toUpperCase()));
                  if (partyIdx !== -1) entry.Party = row[partyIdx];

                  const numbers = row.filter((c, idx) => idx !== dateIdx && idx !== lrIdx && !isNaN(Number(c.replace(/[^0-9.]/g, ''))) && c.trim() !== '');
                  if (numbers.length > 0) entry.Weight = numbers[0];
                  if (numbers.length > 1) entry.Total_Amount = numbers[numbers.length - 1];

                  if (entry.LR_Number || entry.Party) {
                    allRows.push(entry);
                  }
                }
              });
            }
            if (allRows.length === 0) {
              throw new Error("No readable text found in the PDF. Scanned documents are not supported.");
            }
            data = allRows;
          } catch (pdfErr: any) {
            console.error("PDF Parsing Error:", pdfErr);
            throw new Error(pdfErr.message || "Failed to parse PDF. Ensure it's a text-based PDF.");
          }
        } else {
          // Excel or CSV
          toast.loading('Reading Excel/CSV...', { id: toastId });
          const workbook = XLSX.read(content, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          data = XLSX.utils.sheet_to_json(worksheet);
        }

        if (data.length === 0) {
          toast.error('No valid data found in file', { id: toastId });
          return;
        }

        toast.loading(`Importing ${data.length} records to database...`, { id: toastId });
        const chunkSize = 100;
        let successCount = 0;

        try {
          for (let i = 0; i < data.length; i += chunkSize) {
            const chunk = data.slice(i, i + chunkSize);
            const batch = writeBatch(db);

            chunk.forEach((row: any) => {
              const lrNumber = row.LR_Number || row.lrNumber || row.lr_number || row['LR No'] || row['LR NO'] || row['LR Number'] || row['LR NUMBER'];
              if (!lrNumber && !row.Party && !row.partyName && !row['Party Name']) return;

              const newDocRef = doc(collection(db, 'parcels'));
              
              let dateStr = new Date().toISOString().split('T')[0];
              const rowDate = row.Date || row.date || row.DATE || row['Date'] || row['DATE'];
              if (rowDate) {
                if (typeof rowDate === 'number') {
                  const jsDate = new Date(Math.round((rowDate - 25569) * 86400 * 1000));
                  dateStr = jsDate.toISOString().split('T')[0];
                } else {
                  const parsed = new Date(rowDate);
                  if (!isNaN(parsed.getTime())) {
                    dateStr = parsed.toISOString().split('T')[0];
                  } else {
                    const parts = String(rowDate).trim().split(/[-/]/);
                    if (parts.length === 3) {
                      if (parts[0].length === 4) { // YYYY-MM-DD
                        dateStr = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                      } else { // DD-MM-YYYY
                        dateStr = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                      }
                    }
                  }
                }
              }

              batch.set(newDocRef, {
                lrNumber: String(lrNumber || 'N/A'),
                partyName: row.Party || row.partyName || row.party_name || row['Party Name'] || row['PARTY NAME'] || 'Unknown',
                state: row.State || row.state || row.STATE || row['State'] || row['STATE'] || 'DELHI',
                transport: row.Transport || row.transport || row.TRANSPORT || row['Transport'] || row['TRANSPORT'] || '',
                weight: Number(row.Weight || row.weight || row.WEIGHT || row['Weight'] || row['WEIGHT'] || 0),
                rate: Number(row.Rate || row.rate || row.RATE || row['Rate'] || row['RATE'] || 0),
                totalAmount: Number(row.Total_Amount || row.totalAmount || row.total_amount || row['Total Amount'] || row['TOTAL AMOUNT'] || row['Amount'] || row['AMOUNT'] || 0),
                paidAmount: Number(row.Paid_Amount || row.paidAmount || row.paid_amount || row['Paid Amount'] || row['PAID AMOUNT'] || 0),
                status: String(row.Status || row.status || row['Status'] || row['STATUS'] || 'pending').toLowerCase(),
                paymentMode: String(row.Payment_Mode || row.paymentMode || row.payment_mode || row['Payment Mode'] || row['PAYMENT MODE'] || 'cash').toLowerCase(),
                weightImageUrl: row.Weight_Image_URL || row.weightImageUrl || row.weight_image_url || row['Weight Image URL'] || row['WEIGHT IMAGE URL'] || '',
                createdAt: Timestamp.now(),
                createdBy: auth.currentUser?.uid || 'system',
                date: dateStr,
              });
              successCount++;
            });

            if (successCount > 0) {
              await batch.commit();
            }
          }
          
          if (successCount === 0) {
            toast.error('No valid records were found to import. Check column headers.', { id: toastId });
          } else {
            toast.success(`Successfully imported ${successCount} records`, { id: toastId });
            fetchParcels();
          }
        } catch (error: any) {
          console.error("Database Import Error:", error);
          toast.error(`Import failed: ${error.message || 'Database error'}`, { id: toastId });
        }
      } catch (error: any) {
        console.error("File Processing Error:", error);
        toast.error(`Import failed: ${error.message || 'Check file format'}`, { id: toastId });
      } finally {
        // Reset file input
        e.target.value = '';
      }
    };

    if (file.name.endsWith('.json')) {
      reader.readAsText(file);
    } else if (file.name.endsWith('.pdf') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsBinaryString(file);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            Search & Manage
            <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" title="Live Sync Active"></span>
          </h2>
          {!isAdmin && (
            <span className="px-2 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-medium border border-slate-200">
              View Only
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportExcel} title="Export Excel">
            <FileSpreadsheet size={18} className="mr-2" /> Excel
          </Button>
          <Button variant="outline" onClick={exportPDF} title="Export PDF">
            <FileText size={18} className="mr-2" /> PDF
          </Button>
          <div className="relative group">
            <input
              type="file"
              accept=".xlsx, .xls, .csv, .json, .pdf"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
              onChange={handleImport}
            />
            <Button variant="secondary" className="group-hover:bg-slate-700 transition-colors">
              <Upload size={18} className="mr-2" /> Import PDF/Excel
            </Button>
          </div>
          <Button variant="ghost" onClick={() => {
            const ws = XLSX.utils.json_to_sheet([{
              Date: '2023-10-25',
              LR_Number: '12345',
              Party: 'Example Party',
              Transport: 'Example Transport',
              State: 'DELHI',
              Weight: 100,
              Rate: 10,
              Total_Amount: 1000,
              Paid_Amount: 0,
              Status: 'pending',
              Payment_Mode: 'cash'
            }]);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, "Template");
            XLSX.writeFile(wb, "Import_Template.xlsx");
          }} title="Download Template">
            Template
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <Input
                placeholder="Search LR Number or Party Name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full"
              />
            </div>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              label="From"
            />
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              label="To"
            />
            <Select
              options={[
                { value: 'all', label: 'All States' },
                ...sortedStates.map(s => ({ value: s, label: s }))
              ]}
              value={stateFilter}
              onChange={(e) => setStateFilter(e.target.value)}
              label="State"
            />
            <Select
              label="Sort By"
              options={[
                { value: 'date-desc', label: 'Date (Newest)' },
                { value: 'date-asc', label: 'Date (Oldest)' },
                { value: 'amount-desc', label: 'Amount (High)' },
                { value: 'amount-asc', label: 'Amount (Low)' },
                { value: 'status-paid', label: 'Status (Paid First)' },
                { value: 'status-pending', label: 'Status (Pending First)' },
              ]}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 uppercase font-bold">Total Weight</p>
          <p className="text-xl font-bold text-slate-900">{totalWeight.toFixed(2)} kg</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 uppercase font-bold">Total Amount</p>
          <p className="text-xl font-bold text-slate-900">₹{totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 uppercase font-bold">Paid</p>
          <p className="text-xl font-bold text-green-600">₹{totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 uppercase font-bold">Pending</p>
          <p className="text-xl font-bold text-amber-600">₹{totalPending.toLocaleString()}</p>
        </div>
      </div>

      {/* Search Insights */}
      {searchStats && (
        <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex items-center gap-3 animate-in fade-in slide-in-from-left-2">
          <div className="bg-blue-600 p-2 rounded-full text-white">
            <SearchIcon size={18} />
          </div>
          <div>
            <p className="text-sm text-blue-900 font-medium">
              LR Number <span className="font-bold underline">{searchStats.lr}</span> has <span className="text-lg font-bold">{searchStats.count}</span> {searchStats.count === 1 ? 'entry' : 'entries'} in the system.
            </p>
            {!searchStats.isExact && (
              <p className="text-xs text-blue-700 mt-0.5">Showing results for the closest matching LR number.</p>
            )}
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {isAdmin && selectedIds.size > 0 && (
        <div className="bg-indigo-50 border border-indigo-100 p-3 rounded-lg flex items-center justify-between animate-in fade-in slide-in-from-top-2">
          <span className="text-sm font-medium text-indigo-900">
            {selectedIds.size} items selected
          </span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleBulkStatusUpdate('paid')} className="bg-green-600 hover:bg-green-700">
              Mark Paid
            </Button>
            <Button size="sm" onClick={() => handleBulkStatusUpdate('pending')} className="bg-amber-500 hover:bg-amber-600">
              Mark Pending
            </Button>
            <Button size="sm" onClick={handleBulkDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Delete Selected
            </Button>
          </div>
        </div>
      )}

      {/* Data Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b border-slate-200">
              <tr>
                {isAdmin && (
                  <th className="p-4 w-4">
                    <button onClick={handleSelectAll}>
                      {selectedIds.size === filteredParcels.length && filteredParcels.length > 0 ? (
                        <CheckSquare size={16} className="text-indigo-600" />
                      ) : (
                        <Square size={16} className="text-slate-400" />
                      )}
                    </button>
                  </th>
                )}
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">LR No</th>
                <th className="px-4 py-3">Party</th>
                <th className="px-4 py-3">State</th>
                <th className="px-4 py-3 text-right">Weight</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Weight Proof</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredParcels.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 10 : 9} className="p-8 text-center text-slate-500">
                    No records found matching your filters.
                  </td>
                </tr>
              ) : (
                filteredParcels.map((parcel) => (
                  <tr key={parcel.id} className={cn("hover:bg-slate-50 transition-colors", selectedIds.has(parcel.id!) && "bg-indigo-50/50")}>
                    {isAdmin && (
                      <td className="p-4">
                        <button onClick={() => toggleSelection(parcel.id!)}>
                          {selectedIds.has(parcel.id!) ? (
                            <CheckSquare size={16} className="text-indigo-600" />
                          ) : (
                            <Square size={16} className="text-slate-400" />
                          )}
                        </button>
                      </td>
                    )}
                    <td className="px-4 py-3 text-slate-600">{parcel.date}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{parcel.lrNumber}</td>
                    <td className="px-4 py-3 text-slate-900">{parcel.partyName}</td>
                    <td className="px-4 py-3 text-slate-600">{parcel.state}</td>
                    <td className="px-4 py-3 text-right font-mono">{parcel.weight}</td>
                    <td className="px-4 py-3 text-right font-mono">₹{parcel.totalAmount}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={cn(
                        "px-2 py-1 rounded-full text-xs font-medium",
                        parcel.status === 'paid' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                      )}>
                        {parcel.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex justify-center gap-2">
                        {parcel.weightImageUrl ? (
                          <div className="flex flex-col items-center gap-1">
                            <div 
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImage({ url: parcel.weightImageUrl!, title: `Weight Proof - LR: ${parcel.lrNumber}` });
                              }}
                              className="h-12 w-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden cursor-pointer hover:ring-2 hover:ring-indigo-500 transition-all shadow-sm"
                              title="Click to enlarge"
                            >
                              <img 
                                src={parcel.weightImageUrl} 
                                alt="Weight" 
                                className="h-full w-full object-cover" 
                                referrerPolicy="no-referrer"
                              />
                            </div>
                            <button 
                              onClick={(e) => {
                                e.stopPropagation();
                                setPreviewImage({ url: parcel.weightImageUrl!, title: `Weight Proof - LR: ${parcel.lrNumber}` });
                              }}
                              className="text-indigo-600 hover:text-indigo-800 text-[10px] font-medium underline"
                            >
                              View
                            </button>
                          </div>
                        ) : (
                          <div className="h-12 w-12 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300" title="No proof uploaded">
                            <ImageIcon size={20} />
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => generateProfessionalReceipt(parcel as any)}
                          className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                          title="Download Professional Receipt"
                        >
                          <FileText size={16} />
                        </button>
                        <button 
                          onClick={() => { setSelectedParcel(parcel); setIsViewModalOpen(true); }}
                          className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        {isAdmin && (
                          <button 
                            onClick={() => { setEditFormData({ ...parcel }); setIsEditModalOpen(true); }}
                            className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                        )}
                        {isAdmin && (
                          <button 
                            onClick={() => handleDelete(parcel.id!)}
                            className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => !confirmModal.isLoading && setConfirmModal(prev => ({ ...prev, isOpen: false }))}
        title={confirmModal.title}
        className="max-w-md"
      >
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-amber-600">
            <AlertTriangle size={24} />
            <p className="font-medium">Warning</p>
          </div>
          <p className="text-slate-600">{confirmModal.message}</p>
          <div className="flex justify-end gap-3 pt-4">
            <Button 
              variant="outline" 
              onClick={() => setConfirmModal(prev => ({ ...prev, isOpen: false }))}
              disabled={confirmModal.isLoading}
            >
              Cancel
            </Button>
            <Button 
              variant="danger" 
              onClick={confirmModal.onConfirm}
              isLoading={confirmModal.isLoading}
            >
              Confirm Delete
            </Button>
          </div>
        </div>
      </Modal>

      {/* View Details Modal */}
      <Modal
        isOpen={isViewModalOpen}
        onClose={() => setIsViewModalOpen(false)}
        title={`Parcel Details: ${selectedParcel?.lrNumber}`}
        className="max-w-2xl"
      >
        {selectedParcel && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Party Name</p>
                <p className="font-medium text-lg">{selectedParcel.partyName}</p>
              </div>
              <div>
                <p className="text-slate-500">Date</p>
                <p className="font-medium">{selectedParcel.date}</p>
              </div>
              <div>
                <p className="text-slate-500">State</p>
                <p className="font-medium">{selectedParcel.state}</p>
              </div>
              <div>
                <p className="text-slate-500">Payment Mode</p>
                <p className="font-medium capitalize">{selectedParcel.paymentMode}</p>
              </div>
            </div>

            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100">
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-xs text-slate-500 uppercase">Weight</p>
                  <p className="font-bold text-xl">{selectedParcel.weight} kg</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Rate</p>
                  <p className="font-bold text-xl">₹{selectedParcel.rate}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase">Total</p>
                  <p className="font-bold text-xl text-indigo-600">₹{selectedParcel.totalAmount}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <p className="text-sm font-medium mb-2">Weight Proof</p>
                {selectedParcel.weightImageUrl ? (
                  <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden border border-slate-200">
                    <img 
                      src={selectedParcel.weightImageUrl} 
                      alt="Weight Proof" 
                      className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                      onClick={() => window.open(selectedParcel.weightImageUrl, '_blank')}
                    />
                  </div>
                ) : (
                  <div className="aspect-video bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 text-sm border border-dashed border-slate-200">
                    No Image
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              {isAdmin && (
                <Button 
                  variant="outline" 
                  className="text-red-600 border-red-200 hover:bg-red-50"
                  onClick={() => {
                    if (selectedParcel.id) {
                      handleDelete(selectedParcel.id);
                      setIsViewModalOpen(false);
                    }
                  }}
                >
                  <Trash2 size={16} className="mr-2" /> Delete Entry
                </Button>
              )}
              <Button onClick={() => setIsViewModalOpen(false)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
      {/* Edit Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Parcel Details"
        className="max-w-2xl"
      >
        {editFormData && (
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Date"
                type="date"
                value={editFormData.date}
                onChange={(e) => setEditFormData({ ...editFormData, date: e.target.value })}
                required
              />
              <Input
                label="LR Number"
                value={editFormData.lrNumber}
                onChange={(e) => setEditFormData({ ...editFormData, lrNumber: e.target.value })}
                required
              />
              <Input
                label="Party Name"
                value={editFormData.partyName}
                onChange={(e) => setEditFormData({ ...editFormData, partyName: e.target.value })}
                required
              />
              <Select
                label="State"
                options={STATES.map(s => ({ value: s, label: s }))}
                value={editFormData.state}
                onChange={(e) => setEditFormData({ ...editFormData, state: e.target.value as any })}
              />
              <Input
                label="Weight (KG)"
                type="number"
                step="0.01"
                value={editFormData.weight}
                onChange={(e) => setEditFormData({ ...editFormData, weight: Number(e.target.value) })}
                required
              />
              <Input
                label="Rate"
                type="number"
                step="0.01"
                value={editFormData.rate}
                onChange={(e) => setEditFormData({ ...editFormData, rate: Number(e.target.value) })}
                required
              />
              <Input
                label="Total Amount"
                type="number"
                value={editFormData.totalAmount}
                readOnly
                className="bg-slate-50"
              />
              <Input
                label="Paid Amount"
                type="number"
                value={editFormData.paidAmount}
                onChange={(e) => setEditFormData({ ...editFormData, paidAmount: Number(e.target.value) })}
              />
              <Select
                label="Status"
                options={[
                  { value: 'pending', label: 'Pending' },
                  { value: 'paid', label: 'Paid' },
                  { value: 'partial', label: 'Partial' },
                ]}
                value={editFormData.status}
                onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value as any })}
              />
              <Select
                label="Payment Mode"
                options={[
                  { value: 'cash', label: 'Cash' },
                  { value: 'bank', label: 'Bank Transfer' },
                ]}
                value={editFormData.paymentMode || 'cash'}
                onChange={(e) => setEditFormData({ ...editFormData, paymentMode: e.target.value as any })}
              />
              
              <div className="col-span-1 md:col-span-2 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 mt-2">
                <div>
                  <label className="text-sm font-medium text-slate-700 block mb-1">Update Weight Proof</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                    onChange={(e) => e.target.files?.[0] && setEditWeightFile(e.target.files[0])}
                  />
                  {editFormData.weightImageUrl && !editWeightFile && (
                    <p className="text-xs text-green-600 mt-1">✓ Current image exists</p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
              <Button 
                type="button" 
                variant="outline" 
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => {
                  if (editFormData.id) {
                    handleDelete(editFormData.id);
                    setIsEditModalOpen(false);
                  }
                }}
              >
                <Trash2 size={16} className="mr-2" /> Delete Entry
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
                <Button type="submit">Update Parcel</Button>
              </div>
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
    </div>
  );
};
