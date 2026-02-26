import React, { useState, useEffect } from 'react';
import { collection, getDocs, deleteDoc, doc, addDoc, orderBy, query, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Trash2, Plus, Shield, User, X, Download, FileJson } from 'lucide-react';
import { handleFirebaseError } from '../lib/firebase-errors';
import toast from 'react-hot-toast';
import { UserProfile } from '../types';

export const Settings = () => {
  const { userProfile, isAdmin } = useAuth();
  const [parties, setParties] = useState<{ id: string; name: string }[]>([]);
  const [transports, setTransports] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [newParty, setNewParty] = useState('');
  const [newTransport, setNewTransport] = useState('');
  const [loading, setLoading] = useState(true);
  const [showRules, setShowRules] = useState(true);

  useEffect(() => {
    fetchParties();
    fetchTransports();
    if (isAdmin) {
      fetchUsers();
    }
  }, [isAdmin]);

  const handleDownloadTDL = () => {
    const appUrl = window.location.origin;
    const tdlContent = `;; ============================================================
;; PARCEL TRACKER INTEGRATION FOR TALLY PRIME
;; Version: 8.0 FINAL - Based on Official Tally Help Documentation
;;
;; VERIFIED RULES FROM TALLY OFFICIAL DOCS:
;; 1. Color on Field = "Background" attribute, NOT "Color"
;; 2. Conditional Background = Background : if cond then ColorA else ColorB
;; 3. Style values must be quoted strings e.g. "Normal Bold" "Large Bold"
;; 4. Width/Height on Form = integer numbers only (no %)
;; 5. Filter on Collection, NOT on Part
;; 6. Style/Background/Align/Skip/Width on Field ONLY
;; 7. Border/Active/Space on Part ONLY
;; 8. Purchase voucher form = "Purchase Color"
;; ============================================================

;; ============================================================
;; SECTION 1: API URL FORMULA
;; ============================================================

[System: Formula]
    ParcelTrackerURL : "${appUrl}/api/tally/check-lr"
    PT_CheckLRNo     : ""
    PT_CheckStatus   : ""
    PT_CheckDetail   : ""

;; ============================================================
;; SECTION 2: UDF — CUSTOM STORAGE ON PURCHASE VOUCHER
;; ============================================================

[System: UDF]
    SVTransportName : String : 2001
    SVLRNumber      : String : 2002
    SVTotalParcels  : Number : 2003
    SVParcelStatus  : String : 2004

;; ============================================================
;; SECTION 3: ADD PARCEL SECTION TO PURCHASE VOUCHER
;;            Purchase voucher form name = "Purchase Color"
;; ============================================================

[#Form: Purchase Color]
    Add : Part   : SVParcelInfoPart
    Add : Button : PT_VoucherButton

[Part: SVParcelInfoPart]
    Line   : SVP_TitleLine
    Line   : SVP_BlankLine
    Line   : SVP_TransportLine
    Line   : SVP_LRLine
    Line   : SVP_ParcelsLine
    Line   : SVP_StatusLine
    Line   : SVP_BlankLine
    Border : Thin Box

;; Title
[Line: SVP_TitleLine]
    Field  : SVP_TitleField

[Field: SVP_TitleField]
    Use        : Name Field
    Set as     : "-- TRANSPORT & PARCEL DETAILS --"
    Style      : "Large Bold"
    Align      : Centre
    Width      : 60
    Skip       : Yes

;; Blank
[Line: SVP_BlankLine]
    Field  : SVP_BlankField

[Field: SVP_BlankField]
    Use    : Name Field
    Set as : " "
    Skip   : Yes

;; Transport Name
[Line: SVP_TransportLine]
    Field  : SVP_TrPrompt
    Field  : SVP_TrField

[Field: SVP_TrPrompt]
    Use    : Short Prompt
    Set as : "Transport Name  :"

[Field: SVP_TrField]
    Use        : Name Field
    Storage    : SVTransportName
    Width      : 30
    Modifiable : Yes

;; LR Number
[Line: SVP_LRLine]
    Field  : SVP_LRPrompt
    Field  : SVP_LRField

[Field: SVP_LRPrompt]
    Use    : Short Prompt
    Set as : "LR Number       :"

[Field: SVP_LRField]
    Use        : Name Field
    Storage    : SVLRNumber
    Width      : 30
    Modifiable : Yes
    On         : Accept : Call : Func_CheckLROnVoucher

;; Total Parcels
[Line: SVP_ParcelsLine]
    Field  : SVP_ParcelsPrompt
    Field  : SVP_ParcelsField

[Field: SVP_ParcelsPrompt]
    Use    : Short Prompt
    Set as : "Total Parcels   :"

[Field: SVP_ParcelsField]
    Use        : Number Field
    Storage    : SVTotalParcels
    Width      : 10
    Modifiable : Yes

;; Parcel Status (auto-filled, read-only)
[Line: SVP_StatusLine]
    Field  : SVP_StatusPrompt
    Field  : SVP_StatusField

[Field: SVP_StatusPrompt]
    Use    : Short Prompt
    Set as : "Parcel Status   :"

[Field: SVP_StatusField]
    Use        : Name Field
    Storage    : SVParcelStatus
    Width      : 40
    Skip       : Yes
    Style      : "Medium Bold"

;; ============================================================
;; SECTION 4: LR CHECK FUNCTION (triggered on LR field accept)
;; ============================================================

[Function: Func_CheckLROnVoucher]
    Variable : vLR   : String
    Variable : vResp : String
    Variable : vStat : String
    Variable : vDet  : String
    Variable : vURL  : String

    10 : Set : vLR   : $SVLRNumber
    20 : If  : $$IsEmpty:##vLR
    30 :     Set : SVParcelStatus : "Enter LR Number first"
    40 :     Return
    50 : End If
    60 : Set : vURL  : @@ParcelTrackerURL + "?lr=" + ##vLR
    70 : Set : vResp : $$HTTP_GET:##vURL
    80 : If  : $$IsEmpty:##vResp
    90 :     Set : SVParcelStatus : "NOT RECEIVED - Server unreachable"
   100 :     Return
   110 : End If
   120 : Set : vStat : $$StrByChar:##vResp:0:$$StrFindChar:##vResp:"|"
   130 : Set : vDet  : $$StrByChar:##vResp:$$($$StrFindChar:##vResp:"|"+1):$$StrLen:##vResp
   140 : If  : ##vStat = "RECEIVED"
   150 :     Set : SVParcelStatus : "RECEIVED - " + ##vDet
   160 : Else
   170 :     Set : SVParcelStatus : "NOT RECEIVED"
   180 : End If
    Return

;; ============================================================
;; SECTION 5: MENU ITEMS + HOTKEY + VOUCHER BUTTON
;; ============================================================

[Key: PT_GlobalHotKey]
    Key    : Ctrl + Alt + P
    Action : Display : Rpt_ParcelChecker

[#Menu: Gateway of Tally]
    Add : Item : "Parcel Status Checker" : Display : Rpt_ParcelChecker
    Add : Item : "Not Received Parcels"  : Display : Rpt_NotReceived

[Button: PT_VoucherButton]
    Title  : "Check Parcel"
    Key    : Ctrl + Alt + P
    Action : Display : Rpt_ParcelChecker

;; ============================================================
;; SECTION 6: STANDALONE LR CHECKER POPUP REPORT
;; ============================================================

[Report: Rpt_ParcelChecker]
    Form   : Frm_ParcelChecker
    Title  : "Parcel Tracker - LR Status Checker"
    Auto   : Yes

[Form: Frm_ParcelChecker]
    Part   : PC_HeaderPart
    Part   : PC_BodyPart
    Part   : PC_FooterPart
    Width  : 60
    Height : 20

[Part: PC_HeaderPart]
    Line   : PC_TitleLine
    Line   : PC_BlankLine

[Line: PC_TitleLine]
    Field  : PC_TitleField

[Field: PC_TitleField]
    Use    : Name Field
    Set as : "PARCEL LR STATUS CHECKER"
    Style  : "Large Bold"
    Align  : Centre
    Width  : 60
    Skip   : Yes

[Line: PC_BlankLine]
    Field  : PC_BlankField

[Field: PC_BlankField]
    Use    : Name Field
    Set as : " "
    Skip   : Yes

[Part: PC_BodyPart]
    Line        : PC_InputLine
    Line        : PC_BlankLine
    Line        : PC_StatusLine
    Line        : PC_DetailLine
    Border      : Thin Box
    Space Left  : 2
    Space Right : 2

[Line: PC_InputLine]
    Field  : PC_LRPrompt
    Field  : PC_LRInput

[Field: PC_LRPrompt]
    Use    : Short Prompt
    Set as : "Enter LR Number :"

[Field: PC_LRInput]
    Use        : Name Field
    Width      : 30
    Modifiable : Yes
    Variable   : PT_CheckLRNo
    On         : Accept : Call : Func_StandaloneCheck

[Line: PC_StatusLine]
    Field  : PC_StatusPrompt
    Field  : PC_StatusDisplay

[Field: PC_StatusPrompt]
    Use    : Short Prompt
    Set as : "Status          :"

[Field: PC_StatusDisplay]
    Use      : Name Field
    Width    : 30
    Skip     : Yes
    Style    : "Large Bold"
    Variable : PT_CheckStatus

[Line: PC_DetailLine]
    Field  : PC_DetailPrompt
    Field  : PC_DetailDisplay

[Field: PC_DetailPrompt]
    Use    : Short Prompt
    Set as : "Details         :"

[Field: PC_DetailDisplay]
    Use      : Name Field
    Width    : 40
    Skip     : Yes
    Variable : PT_CheckDetail

[Part: PC_FooterPart]
    Line   : PC_FooterLine

[Line: PC_FooterLine]
    Field  : PC_FooterField

[Field: PC_FooterField]
    Use    : Name Field
    Set as : "Press ESC to Close"
    Align  : Centre
    Width  : 60
    Skip   : Yes

;; ============================================================
;; SECTION 7: STANDALONE CHECKER FUNCTION
;; ============================================================

[Function: Func_StandaloneCheck]
    Variable : vLR   : String
    Variable : vResp : String
    Variable : vStat : String
    Variable : vDet  : String
    Variable : vURL  : String

    10 : Set : vLR   : ##PT_CheckLRNo
    20 : If  : $$IsEmpty:##vLR
    30 :     Set : PT_CheckStatus : "Please enter an LR Number"
    40 :     Set : PT_CheckDetail : ""
    50 :     Return
    60 : End If
    70 : Set : vURL  : @@ParcelTrackerURL + "?lr=" + ##vLR
    80 : Set : vResp : $$HTTP_GET:##vURL
    90 : If  : $$IsEmpty:##vResp
   100 :     Set : PT_CheckStatus : "NOT RECEIVED"
   110 :     Set : PT_CheckDetail : "No response from server"
   120 :     Return
   130 : End If
   140 : Set : vStat : $$StrByChar:##vResp:0:$$StrFindChar:##vResp:"|"
   150 : Set : vDet  : $$StrByChar:##vResp:$$($$StrFindChar:##vResp:"|"+1):$$StrLen:##vResp
   160 : If  : ##vStat = "RECEIVED"
   170 :     Set : PT_CheckStatus : "RECEIVED"
   180 :     Set : PT_CheckDetail : ##vDet
   190 : Else
   200 :     Set : PT_CheckStatus : "NOT RECEIVED"
   210 :     Set : PT_CheckDetail : "LR not found in Parcel Tracker"
   220 : End If
    Return

;; ============================================================
;; SECTION 8: NOT RECEIVED PARCELS REPORT
;; ============================================================

[Report: Rpt_NotReceived]
    Form   : Frm_NotReceived
    Title  : "Pending - Not Received Parcels"
    Auto   : Yes

[Form: Frm_NotReceived]
    Part   : NR_TitlePart
    Part   : NR_TablePart
    Part   : NR_FooterPart
    Width  : 90
    Height : 30

[Part: NR_TitlePart]
    Line   : NR_TitleLine
    Line   : NR_BlankLine

[Line: NR_TitleLine]
    Field  : NR_TitleField

[Field: NR_TitleField]
    Use    : Name Field
    Set as : "NOT RECEIVED PARCELS - PENDING LIST"
    Style  : "Large Bold"
    Align  : Centre
    Width  : 90
    Skip   : Yes

[Line: NR_BlankLine]
    Field  : NR_BlankField

[Field: NR_BlankField]
    Use    : Name Field
    Set as : " "
    Skip   : Yes

;; Collection with Filter
[Collection: Col_NotReceivedVch]
    Type   : Voucher
    Fetch  : Date, VoucherNumber, PartyLedgerName, VoucherTypeName, SVTransportName, SVLRNumber, SVTotalParcels, SVParcelStatus
    Filter : Fltr_PurchaseNotRcvd

[System: Formula]
    Fltr_PurchaseNotRcvd : ($VoucherTypeName = "Purchase") AND (NOT $$IsEmpty:$SVLRNumber) AND ($SVParcelStatus != "RECEIVED")

[Part: NR_TablePart]
    Line   : NR_HeadLine
    Line   : NR_DataLine
    Repeat : NR_DataLine : Col_NotReceivedVch
    Scroll : Vertical
    Border : Thin Box

;; Header
[Line: NR_HeadLine]
    Field  : NR_H_Date
    Field  : NR_H_VchNo
    Field  : NR_H_Party
    Field  : NR_H_Transport
    Field  : NR_H_LR
    Field  : NR_H_Parcels
    Field  : NR_H_Status

[Field: NR_H_Date]
    Use    : Name Field
    Set as : "Date"
    Width  : 12
    Style  : "Medium Bold"
    Skip   : Yes

[Field: NR_H_VchNo]
    Use    : Name Field
    Set as : "Voucher No."
    Width  : 14
    Style  : "Medium Bold"
    Skip   : Yes

[Field: NR_H_Party]
    Use    : Name Field
    Set as : "Party Name"
    Width  : 22
    Style  : "Medium Bold"
    Skip   : Yes

[Field: NR_H_Transport]
    Use    : Name Field
    Set as : "Transport"
    Width  : 18
    Style  : "Medium Bold"
    Skip   : Yes

[Field: NR_H_LR]
    Use    : Name Field
    Set as : "LR Number"
    Width  : 15
    Style  : "Medium Bold"
    Skip   : Yes

[Field: NR_H_Parcels]
    Use    : Name Field
    Set as : "Parcels"
    Width  : 8
    Style  : "Medium Bold"
    Skip   : Yes

[Field: NR_H_Status]
    Use    : Name Field
    Set as : "Status"
    Width  : 20
    Style  : "Medium Bold"
    Skip   : Yes

;; Data Rows
[Line: NR_DataLine]
    Field  : NR_Date
    Field  : NR_VchNo
    Field  : NR_Party
    Field  : NR_Transport
    Field  : NR_LR
    Field  : NR_Parcels
    Field  : NR_Status

[Field: NR_Date]
    Use    : Name Field
    Set as : $$String:$Date:"DD-MMM-YY"
    Width  : 12
    Skip   : Yes

[Field: NR_VchNo]
    Use    : Name Field
    Set as : $VoucherNumber
    Width  : 14
    Skip   : Yes

[Field: NR_Party]
    Use    : Name Field
    Set as : $PartyLedgerName
    Width  : 22
    Skip   : Yes

[Field: NR_Transport]
    Use    : Name Field
    Set as : $SVTransportName
    Width  : 18
    Skip   : Yes

[Field: NR_LR]
    Use    : Name Field
    Set as : $SVLRNumber
    Width  : 15
    Skip   : Yes

[Field: NR_Parcels]
    Use    : Name Field
    Set as : $$String:$SVTotalParcels
    Width  : 8
    Skip   : Yes

[Field: NR_Status]
    Use    : Name Field
    Set as : if $$IsEmpty:$SVParcelStatus then "NOT RECEIVED" else $SVParcelStatus
    Width  : 20
    Style  : "Medium Bold"
    Skip   : Yes

;; Footer
[Part: NR_FooterPart]
    Line   : NR_FooterLine

[Line: NR_FooterLine]
    Field  : NR_FooterField

[Field: NR_FooterField]
    Use    : Name Field
    Set as : "Press ESC to Close | Showing Purchase vouchers with pending LR only"
    Align  : Centre
    Width  : 90
    Skip   : Yes

;; ============================================================
;; END OF TDL - ParcelTracker v8.0 FINAL
;; ============================================================
`;
    
    const blob = new Blob([tdlContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ParcelTracker.tdl';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('TDL file downloaded');
  };

  const fetchTransports = async () => {
    try {
      const q = query(collection(db, 'transports'), orderBy('name'));
      const snapshot = await getDocs(q);
      setTransports(snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name })));
    } catch (error) {
      console.error("Error fetching transports:", error);
    }
  };

  const fetchParties = async () => {
    try {
      // 1. Fetch all parcels to count party occurrences
      const parcelsSnapshot = await getDocs(collection(db, 'parcels'));
      const counts: Record<string, number> = {};
      parcelsSnapshot.forEach(doc => {
        const pName = doc.data().partyName;
        if (pName) counts[pName] = (counts[pName] || 0) + 1;
      });

      // 2. Fetch all parties
      const q = query(collection(db, 'parties'), orderBy('name'));
      const snapshot = await getDocs(q);
      const partyList = snapshot.docs.map(doc => ({ id: doc.id, name: doc.data().name }));

      // 3. Sort by frequency (descending), then by name (ascending)
      const sortedParties = partyList.sort((a, b) => {
        const countA = counts[a.name] || 0;
        const countB = counts[b.name] || 0;
        if (countB !== countA) return countB - countA;
        return a.name.localeCompare(b.name);
      });

      setParties(sortedParties);
    } catch (error) {
      handleFirebaseError(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const q = query(collection(db, 'users'));
      const snapshot = await getDocs(q);
      // Ensure uid is populated from doc.id if missing in data
      setUsers(snapshot.docs.map(doc => {
        const data = doc.data();
        return { 
          ...data, 
          uid: doc.id, // Always use doc.id as the uid source of truth
          email: data.email || '',
          role: data.role || 'staff'
        } as UserProfile;
      }));
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  };

  const updateUserRole = async (uid: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'staff' : 'admin';
    try {
      await updateDoc(doc(db, 'users', uid), { role: newRole });
      toast.success('User role updated');
      fetchUsers();
    } catch (error) {
      handleFirebaseError(error);
    }
  };

  const handleAddParty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParty.trim()) return;

    try {
      await addDoc(collection(db, 'parties'), { name: newParty.trim() });
      setNewParty('');
      fetchParties();
      toast.success('Party added');
    } catch (error) {
      handleFirebaseError(error);
    }
  };

  const handleDeleteParty = async (id: string) => {
    if (!isAdmin) {
      toast.error('Only admins can delete parties');
      return;
    }
    if (!confirm('Delete this party?')) return;
    try {
      await deleteDoc(doc(db, 'parties', id));
      setParties(parties.filter(p => p.id !== id));
      toast.success('Party deleted');
    } catch (error) {
      handleFirebaseError(error);
    }
  };

  const handleAddTransport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTransport.trim()) return;

    try {
      await addDoc(collection(db, 'transports'), { name: newTransport.trim() });
      setNewTransport('');
      fetchTransports();
      toast.success('Transport added');
    } catch (error) {
      handleFirebaseError(error);
    }
  };

  const handleDeleteTransport = async (id: string) => {
    if (!isAdmin) {
      toast.error('Only admins can delete transports');
      return;
    }
    if (!confirm('Delete this transport?')) return;
    try {
      await deleteDoc(doc(db, 'transports', id));
      setTransports(transports.filter(t => t.id !== id));
      toast.success('Transport deleted');
    } catch (error) {
      handleFirebaseError(error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Settings</h2>

      {showRules && (
        <Card className="bg-amber-50 border-amber-200 relative">
          <button 
            onClick={() => setShowRules(false)}
            className="absolute top-4 right-4 text-amber-700 hover:text-amber-900"
          >
            <X size={16} />
          </button>
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center gap-2">
              <Shield size={20} />
              Firebase Security Rules
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-amber-700 mb-4">
              If you experienced "Missing permissions" errors, ensure your Firestore Rules are updated in the Firebase Console:
            </p>
            <div className="bg-slate-900 text-slate-50 p-3 rounded-md text-xs font-mono overflow-x-auto">
              <pre>{`match /{document=**} { allow read, write: if request.auth != null; }`}</pre>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your Profile</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
                <User size={24} />
              </div>
              <div>
                <p className="font-medium text-slate-900">{userProfile?.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase ${userProfile?.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-700'}`}>
                    {userProfile?.role}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileJson size={20} className="text-indigo-600" />
            Tally Prime Integration
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mb-4">
            <h4 className="font-semibold text-indigo-900 mb-2">How to Integrate with Tally Prime</h4>
            <ol className="list-decimal list-inside text-sm text-indigo-800 space-y-2">
              <li>Download the TDL file using the button below.</li>
              <li>Open Tally Prime and go to <strong>Help &gt; TDL & Add-On &gt; Manage Local TDLs</strong>.</li>
              <li>Select the downloaded file <code>ParcelTracker.tdl</code>.</li>
              <li>Set "Load TDL" to <strong>Yes</strong>.</li>
              <li>Go to <strong>Purchase Voucher</strong>. You will see a new field "Check LR Number".</li>
              <li>Enter an LR Number to instantly check its status in this tracker.</li>
            </ol>
          </div>
          <Button onClick={handleDownloadTDL} className="w-full sm:w-auto">
            <Download size={18} className="mr-2" /> Download TDL File
          </Button>
        </CardContent>
      </Card>

      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle>User Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 text-slate-500 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Email</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((user) => (
                    <tr key={user.uid} className="bg-white">
                      <td className="px-4 py-3 font-medium">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold uppercase ${user.role === 'admin' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {user.uid !== auth.currentUser?.uid && (
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => updateUserRole(user.uid, user.role)}
                          >
                            Make {user.role === 'admin' ? 'Staff' : 'Admin'}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Manage Parties</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddParty} className="flex gap-4 mb-6">
            <Input
              placeholder="Enter new party name"
              value={newParty}
              onChange={(e) => setNewParty(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">
              <Plus size={18} className="mr-2" /> Add Party
            </Button>
          </form>

          <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-slate-500">Loading...</div>
            ) : parties.length === 0 ? (
              <div className="p-4 text-center text-slate-500">No parties found.</div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {parties.map((party) => (
                  <li key={party.id} className="p-3 flex items-center justify-between hover:bg-white transition-colors">
                    <span className="font-medium text-slate-700">{party.name}</span>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteParty(party.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Manage Transports</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddTransport} className="flex gap-4 mb-6">
            <Input
              placeholder="Enter new transport name"
              value={newTransport}
              onChange={(e) => setNewTransport(e.target.value)}
              className="flex-1"
            />
            <Button type="submit">
              <Plus size={18} className="mr-2" /> Add Transport
            </Button>
          </form>

          <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden max-h-60 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-slate-500">Loading...</div>
            ) : transports.length === 0 ? (
              <div className="p-4 text-center text-slate-500">No transports found.</div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {transports.map((transport) => (
                  <li key={transport.id} className="p-3 flex items-center justify-between hover:bg-white transition-colors">
                    <span className="font-medium text-slate-700">{transport.name}</span>
                    {isAdmin && (
                      <button
                        onClick={() => handleDeleteTransport(transport.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
