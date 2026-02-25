import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, orderBy, limit, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Button } from '../components/ui/Button';
import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LabelList, AreaChart, Area
} from 'recharts';
import { Package, Scale, Clock, Plus, X, Users, MapPin, FileText, TrendingUp, DollarSign } from 'lucide-react';
import { format, subDays } from 'date-fns';
import { cn } from '../lib/utils';
import { STATES, Parcel } from '../types';
import { generateProfessionalReceipt } from '../services/pdfService';
import toast from 'react-hot-toast';

const CHART_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6'];

export const Dashboard = () => {
  const [stats, setStats] = useState({
    totalParcels: 0,
    totalWeight: 0,
    pendingAmount: 0,
    paidAmount: 0,
    totalRevenue: 0
  });
  const [recentParcels, setRecentParcels] = useState<any[]>([]);
  const [stateStats, setStateStats] = useState<any[]>([]);
  const [partyStats, setPartyStats] = useState<any[]>([]);
  const [revenueTrend, setRevenueTrend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [stateFilter, setStateFilter] = useState('all');
  const [transportFilter, setTransportFilter] = useState('all');
  
  // Transport Management
  const [transports, setTransports] = useState<string[]>([]);
  const [sortedStates, setSortedStates] = useState<string[]>([...STATES]);
  const [showNewTransportInput, setShowNewTransportInput] = useState(false);
  const [newTransportName, setNewTransportName] = useState('');

  useEffect(() => {
    fetchTransports();
    fetchStateStats();
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

  const fetchTransports = async () => {
    try {
      const q = query(collection(db, 'transports'), orderBy('name'));
      const snapshot = await getDocs(q);
      setTransports(snapshot.docs.map(doc => doc.data().name));
    } catch (error) {
      console.error("Error fetching transports:", error);
    }
  };

  const handleAddNewTransport = async () => {
    if (!newTransportName.trim()) return;
    try {
      await addDoc(collection(db, 'transports'), { name: newTransportName.trim() });
      setTransports(prev => [...prev, newTransportName.trim()].sort());
      setNewTransportName('');
      setShowNewTransportInput(false);
      toast.success('Transport added successfully');
    } catch (error) {
      toast.error('Failed to add transport');
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        let q;
        const parcelsRef = collection(db, 'parcels');
        const constraints: any[] = [];

        if (dateFrom) constraints.push(where('date', '>=', dateFrom));
        if (dateTo) constraints.push(where('date', '<=', dateTo));
        
        if (constraints.length > 0) {
           q = query(parcelsRef, ...constraints, orderBy('date', 'desc'));
        } else {
           q = query(parcelsRef, orderBy('createdAt', 'desc'), limit(500)); 
        }

        const snapshot = await getDocs(q);
        
        let totalW = 0;
        let pending = 0;
        let paid = 0;
        let totalRev = 0;
        let filteredCount = 0;
        const parcels: any[] = [];
        const stateMap: Record<string, number> = {};
        const partyMap: Record<string, number> = {};
        const dailyRevenue: Record<string, number> = {};

        // Initialize last 7 days for trend
        for (let i = 6; i >= 0; i--) {
          const d = format(subDays(new Date(), i), 'yyyy-MM-dd');
          dailyRevenue[d] = 0;
        }

        snapshot.forEach((doc) => {
          const data = doc.data() as Parcel;
          
          // Client-side filtering
          if (stateFilter !== 'all' && data.state !== stateFilter) return;
          if (transportFilter !== 'all' && data.transport !== transportFilter) return;
          if (statusFilter !== 'all' && data.status !== statusFilter) return;

          parcels.push({ id: doc.id, ...data });
          filteredCount++;
          
          const weight = Number(data.weight || 0);
          totalW += weight;
          
          const amount = Number(data.totalAmount || 0);
          totalRev += amount;

          if (data.status === 'paid') {
            paid += amount;
          } else {
            pending += amount - Number(data.paidAmount || 0);
            paid += Number(data.paidAmount || 0);
          }

          // State stats
          const state = data.state || 'Unknown';
          stateMap[state] = (stateMap[state] || 0) + 1;

          // Party stats
          const party = data.partyName || 'Unknown';
          partyMap[party] = (partyMap[party] || 0) + 1;

          // Revenue Trend (using date field)
          if (data.date && dailyRevenue[data.date] !== undefined) {
            dailyRevenue[data.date] += amount;
          }
        });

        setStats({
          totalParcels: filteredCount,
          totalWeight: totalW,
          pendingAmount: pending,
          paidAmount: paid,
          totalRevenue: totalRev
        });
        setRecentParcels(parcels.slice(0, 5));
        
        const stateChartData = Object.entries(stateMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value);
          
        setStateStats(stateChartData);

        const partyChartData = Object.entries(partyMap)
          .map(([name, value]) => ({ name, value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 8);
          
        setPartyStats(partyChartData);

        const trendData = Object.entries(dailyRevenue)
          .map(([date, amount]) => ({ 
            date: format(new Date(date), 'dd MMM'), 
            amount 
          }))
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()); // Basic sort, though keys were already sorted by logic
        
        setRevenueTrend(trendData);

      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [dateFrom, dateTo, statusFilter, stateFilter, transportFilter]);

  if (loading) {
    return <div className="flex items-center justify-center h-full">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Dashboard</h2>
            <p className="text-sm text-slate-500">Overview of your transport operations.</p>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input 
              type="date" 
              label="From Date"
              value={dateFrom} 
              onChange={(e) => setDateFrom(e.target.value)} 
              className="flex-1 sm:w-40"
            />
            <span className="text-slate-400">-</span>
            <Input 
              type="date" 
              label="To Date"
              value={dateTo} 
              onChange={(e) => setDateTo(e.target.value)} 
              className="flex-1 sm:w-40"
            />
          </div>
        </div>

        {/* Advanced Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Transport Filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase">Transport</label>
                {!showNewTransportInput ? (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Select
                        options={[
                          { value: 'all', label: 'All Transports' },
                          ...transports.map(t => ({ value: t, label: t }))
                        ]}
                        value={transportFilter}
                        onChange={(e) => setTransportFilter(e.target.value)}
                      />
                    </div>
                    <Button type="button" variant="outline" className="h-14 w-14 p-0 shrink-0 rounded-xl border-slate-200" onClick={() => setShowNewTransportInput(true)} title="Add New Transport">
                      <Plus size={20} />
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        value={newTransportName}
                        onChange={(e) => setNewTransportName(e.target.value)}
                        placeholder="New Transport"
                        className="h-14"
                      />
                    </div>
                    <Button type="button" onClick={handleAddNewTransport} className="h-14 px-4 rounded-xl">Add</Button>
                    <Button type="button" variant="ghost" onClick={() => setShowNewTransportInput(false)} className="h-14 w-14 p-0 rounded-xl">
                      <X size={20} />
                    </Button>
                  </div>
                )}
              </div>

              {/* Status Filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase">Status</label>
                <Select
                  options={[
                    { value: 'all', label: 'All Statuses' },
                    { value: 'pending', label: 'Pending Only' },
                    { value: 'paid', label: 'Paid Only' },
                  ]}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                />
              </div>

              {/* State Filter */}
              <div className="space-y-1">
                <label className="text-xs font-medium text-slate-500 uppercase">State</label>
                <Select
                  options={[
                    { value: 'all', label: 'All States' },
                    ...sortedStates.map(s => ({ value: s, label: s }))
                  ]}
                  value={stateFilter}
                  onChange={(e) => setStateFilter(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Package size={20} />
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase">Total Parcels</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900">{stats.totalParcels}</h3>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-500/20">
              <div className="h-full bg-blue-500" style={{ width: '70%' }}></div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <Scale size={20} />
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase">Total Weight</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900">{stats.totalWeight.toFixed(0)} <span className="text-sm font-normal text-slate-500">kg</span></h3>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-purple-500/20">
              <div className="h-full bg-purple-500" style={{ width: '50%' }}></div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                <Clock size={20} />
              </div>
              <span className="text-xs font-medium text-slate-400 uppercase">Pending</span>
            </div>
            <h3 className="text-2xl font-bold text-slate-900">₹{stats.pendingAmount.toLocaleString()}</h3>
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-amber-500/20">
              <div className="h-full bg-amber-500" style={{ width: `${(stats.pendingAmount / (stats.totalRevenue || 1)) * 100}%` }}></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Party-wise Analysis */}
        <Card className="overflow-hidden border-none shadow-xl bg-gradient-to-br from-slate-900 to-slate-800 text-white">
          <CardHeader className="border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-indigo-500/20 rounded-lg">
                <Users className="text-indigo-400" size={20} />
              </div>
              <CardTitle className="text-white">Top Parties by Volume</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="h-[400px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={partyStats}
                layout="vertical"
                margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis 
                  dataKey="name" 
                  type="category" 
                  width={100} 
                  tick={{ fill: '#94a3b8', fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ 
                    backgroundColor: '#1e293b', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                  itemStyle={{ color: '#818cf8' }}
                />
                <Bar 
                  dataKey="value" 
                  fill="#6366f1" 
                  radius={[0, 4, 4, 0]}
                  barSize={24}
                >
                  {partyStats.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={index === 0 ? '#818cf8' : index === 1 ? '#6366f1' : '#4f46e5'} 
                    />
                  ))}
                  <LabelList dataKey="value" position="right" style={{ fill: '#fff', fontSize: 12, fontWeight: 'bold' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* State-wise Analysis */}
        <Card className="overflow-hidden border-none shadow-xl bg-white/90 backdrop-blur">
          <CardHeader className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-emerald-50 rounded-lg">
                <MapPin className="text-emerald-600" size={20} />
              </div>
              <CardTitle className="text-slate-900">State-wise Distribution</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="h-[400px] pt-6">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stateStats}
                  cx="50%"
                  cy="50%"
                  innerRadius={80}
                  outerRadius={120}
                  paddingAngle={8}
                  dataKey="value"
                  stroke="none"
                >
                  {stateStats.map((entry, index) => (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={['#10b981', '#059669', '#047857', '#065f46', '#064e3b', '#34d399', '#6ee7b7', '#a7f3d0'][index % 8]} 
                    />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' 
                  }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  iconType="circle"
                  wrapperStyle={{ paddingTop: '20px' }}
                />
                <text x="50%" y="48%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-900 font-bold text-3xl">
                  {stats.totalParcels}
                </text>
                <text x="50%" y="56%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 text-xs font-semibold uppercase tracking-widest">
                  Parcels
                </text>
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50">
                  <tr>
                    <th className="px-4 py-3">LR No</th>
                    <th className="px-4 py-3">Party</th>
                    <th className="px-4 py-3">State</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentParcels.map((parcel) => (
                    <tr key={parcel.id} className="border-b border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-medium">{parcel.lrNumber}</td>
                      <td className="px-4 py-3">{parcel.partyName}</td>
                      <td className="px-4 py-3">{parcel.state}</td>
                      <td className="px-4 py-3">₹{parcel.totalAmount}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "px-2 py-1 rounded-full text-xs font-medium",
                          parcel.status === 'paid' ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                        )}>
                          {parcel.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button 
                          onClick={() => generateProfessionalReceipt(parcel as any)}
                          className="p-1 text-slate-400 hover:text-emerald-600 transition-colors"
                          title="Download Receipt"
                        >
                          <FileText size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {recentParcels.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">No recent entries found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
