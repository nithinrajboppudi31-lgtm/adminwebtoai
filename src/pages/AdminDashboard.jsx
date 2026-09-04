import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  Users,
  FolderGit2,
  CreditCard,
  Coins,
  ReceiptText,
  Package,
  Rocket,
  Headphones,
  Settings,
  LogOut,
  TrendingUp,
  Calendar,
  ChevronDown,
  Menu,
  X,
  Plus,
  Edit2,
  Gift,
  Search,
  Sparkles,
  RefreshCw,
  AlertCircle
} from 'lucide-react';

const BACKEND_URL = 'https://webtoai-backend.onrender.com';

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Live database states
  const [stats, setStats] = useState({
    totalUsers: '0',
    totalProjects: '0',
    totalRevenue: '₹0',
    creditsSold: '0',
    activeDeployments: '0',
  });
  const [usersList, setUsersList] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [creditPackages, setCreditPackages] = useState([]);

  // Modals for credit management
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [creditAmount, setCreditAmount] = useState(5);
  const [userSearch, setUserSearch] = useState('');

  // Modal for package updates
  const [showPackageModal, setShowPackageModal] = useState(false);
  const [selectedPkg, setSelectedPkg] = useState(null);
  const [editPrice, setEditPrice] = useState('');
  const [editCredits, setEditCredits] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);

  // Fetch Live PostgreSQL Data
  const loadDashboardData = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      const headers = {
        'Accept': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const res = await fetch(`${BACKEND_URL}/api/admin/dashboard-data`, { headers });
      
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText || 'Failed to fetch'}`);
      }

      const data = await res.json();

      // Maps both metrics & stats keys
      const m = data.metrics || data.stats;
      if (m) {
        setStats({
          totalUsers: String(m.totalUsers ?? '0'),
          totalProjects: String(m.totalProjects ?? '0'),
          totalRevenue: String(m.totalRevenue ?? '₹0'),
          creditsSold: String(m.creditsSold ?? '0'),
          activeDeployments: String(m.activeDeployments ?? '0'),
        });
      }

      if (Array.isArray(data.users)) setUsersList(data.users);
      if (Array.isArray(data.transactions)) setTransactions(data.transactions);

      // Maps both packages & creditPackages keys
      const pkgs = data.packages || data.creditPackages;
      if (pkgs && Array.isArray(pkgs)) {
        setCreditPackages(
          pkgs.map((p) => {
            const numPrice = Number(p.priceVal ?? p.priceInInr ?? String(p.price ?? '').replace(/[^0-9]/g, '')) || 0;
            const numCredits = Number(p.creditsVal ?? p.credits ?? String(p.credits ?? '').replace(/[^0-9]/g, '')) || 0;
            return {
              id: p.id,
              name: p.name || 'Package',
              price: `₹${numPrice}`,
              priceVal: numPrice,
              credits: `${numCredits} Credits`,
              creditsVal: numCredits,
            };
          })
        );
      }
    } catch (err) {
      console.error('Error fetching admin data:', err);
      setErrorMessage(err.message || 'Could not connect to backend server');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Open Edit Package Modal
  const handleOpenEditPackage = (pkg) => {
    setSelectedPkg(pkg);
    setEditPrice(pkg.priceVal || String(pkg.price || '').replace(/[^0-9]/g, ''));
    setEditCredits(pkg.creditsVal || String(pkg.credits || '').replace(/[^0-9]/g, ''));
    setShowPackageModal(true);
  };

  // Save Package Update Directly to PostgreSQL
  const handleSavePackage = async (e) => {
    e.preventDefault();
    if (!selectedPkg) return;
    setSaveLoading(true);

    const targetId = String(selectedPkg.id || selectedPkg.name).toLowerCase().split(' ')[0].trim();
    const newPriceVal = Number(String(editPrice).replace(/[^0-9]/g, ''));
    const newCreditsVal = Number(String(editCredits).replace(/[^0-9]/g, ''));

    // Optimistic UI update
    setCreditPackages((prev) =>
      prev.map((pkg) => {
        const currentId = String(pkg.id || pkg.name).toLowerCase().split(' ')[0].trim();
        if (currentId === targetId) {
          return {
            ...pkg,
            price: `₹${newPriceVal}`,
            priceVal: newPriceVal,
            credits: `${newCreditsVal} Credits`,
            creditsVal: newCreditsVal,
          };
        }
        return pkg;
      })
    );

    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/admin/packages/save`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: targetId,
          packageId: targetId,
          priceInInr: newPriceVal,
          price: newPriceVal,
          credits: newCreditsVal,
          name: selectedPkg.name,
        }),
      });

      const result = await res.json();
      if (!res.ok || result.error) {
        throw new Error(result.error || 'Failed to save to database');
      }

      setShowPackageModal(false);
      await loadDashboardData();
    } catch (err) {
      console.error('Failed to update package:', err);
      alert(`Could not save: ${err.message}`);
      loadDashboardData();
    } finally {
      setSaveLoading(false);
    }
  };

  // Grant Global Credits Handler
  const handleGlobalCreditGrant = async () => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/admin/credits/grant-global`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ amount: creditAmount }),
      });

      if (res.ok) {
        setShowGlobalModal(false);
        loadDashboardData();
      }
    } catch (err) {
      console.error('Global credit update error:', err);
    }
  };

  // Adjust Specific User Credit Handler
  const handleUserCreditAdjust = async (user, delta) => {
    try {
      const token = localStorage.getItem('token') || localStorage.getItem('adminToken');
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`${BACKEND_URL}/api/admin/credits/adjust-user`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ email: user.email, userId: user.id, delta }),
      });

      if (res.ok) {
        loadDashboardData();
      }
    } catch (err) {
      console.error('Single user credit update error:', err);
    }
  };

  const menuItems = [
    { label: 'Dashboard', icon: LayoutDashboard },
    { label: 'Users', icon: Users },
    { label: 'Projects', icon: FolderGit2 },
    { label: 'Payments', icon: CreditCard },
    { label: 'Credits', icon: Coins },
    { label: 'Transactions', icon: ReceiptText },
    { label: 'Credit Packages', icon: Package },
    { label: 'Deployments', icon: Rocket },
    { label: 'Support Tickets', icon: Headphones },
  ];

  return (
    <div className="min-h-screen bg-[#F4F6FB] flex font-sans text-slate-800">
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0F1123] text-slate-300 flex flex-col justify-between transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div>
          <div className="flex items-center justify-between p-6 border-b border-slate-800">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/30">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="font-extrabold text-white text-base tracking-wide">WEBTO AI</span>
              <span className="text-[10px] uppercase font-bold bg-[#4338CA] text-indigo-100 px-2 py-0.5 rounded-full">ADMIN</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="lg:hidden text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="p-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-220px)]">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => {
                    setActiveTab(item.label);
                    setSidebarOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive 
                      ? 'bg-[#2E2856] text-white font-bold' 
                      : 'hover:bg-slate-800/60 text-slate-400 hover:text-slate-100'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 space-y-1">
          <button className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:bg-slate-800/60 hover:text-white transition">
            <Settings className="w-4 h-4" />
            Settings
          </button>
          <button className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-400 hover:bg-rose-500/10 transition">
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg bg-slate-100 text-slate-600 hover:text-slate-900"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">{activeTab}</h1>
            <button 
              onClick={loadDashboardData}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-slate-700 transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <button 
              onClick={() => setShowGlobalModal(true)}
              className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 transition"
            >
              <Gift className="w-3.5 h-3.5" />
              Give Global Free Credits
            </button>

            <div className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-500" />
              <span>Live Database Sync</span>
            </div>

            <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200">
              <img 
                src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80" 
                alt="Admin" 
                className="w-8 h-8 rounded-full object-cover border border-slate-200"
              />
              <div className="hidden sm:block text-left">
                <p className="text-xs font-bold text-slate-800 leading-tight">Admin User</p>
                <p className="text-[10px] text-slate-400 leading-tight">admin@webtoai.com</p>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </div>
          </div>
        </header>

        {/* Live Debug Banner: shows on screen if a fetch error occurs */}
        {errorMessage && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs font-bold text-red-700">
            <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
            <span>Connection Warning: {errorMessage}</span>
          </div>
        )}

        <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          {/* Top 5 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Users</span>
              <p className="text-2xl font-black text-slate-900 my-2">{stats.totalUsers}</p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                <span>+12.5% this month</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Projects</span>
              <p className="text-2xl font-black text-slate-900 my-2">{stats.totalProjects}</p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                <span>+18.7% this month</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Revenue</span>
              <p className="text-2xl font-black text-slate-900 my-2">{stats.totalRevenue}</p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                <span>+22.4% this month</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Credits Sold</span>
              <p className="text-2xl font-black text-slate-900 my-2">{stats.creditsSold}</p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                <span>+16.3% this month</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Active Deployments</span>
              <p className="text-2xl font-black text-slate-900 my-2">{stats.activeDeployments}</p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                <span>+8.2% this month</span>
              </div>
            </div>
          </div>

          {/* Graph, Transactions, Packages */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs font-bold text-slate-800">Revenue Overview</h2>
                <div className="flex items-center gap-1.5 text-[10px] text-indigo-600 font-semibold">
                  <div className="w-2.5 h-2.5 rounded-sm bg-[#5C45FD]"></div>
                  <span>Revenue (₹)</span>
                </div>
              </div>

              <div className="w-full h-44 relative flex items-end">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 300 120" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#6366F1" stopOpacity="0.4"/>
                      <stop offset="100%" stopColor="#6366F1" stopOpacity="0.0"/>
                    </linearGradient>
                  </defs>
                  
                  <line x1="0" y1="30" x2="300" y2="30" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="0" y1="60" x2="300" y2="60" stroke="#F1F5F9" strokeWidth="1" />
                  <line x1="0" y1="90" x2="300" y2="90" stroke="#F1F5F9" strokeWidth="1" />

                  <path
                    d="M 0,80 Q 25,60 50,75 T 100,40 T 150,60 T 200,45 T 250,70 T 300,30 L 300,120 L 0,120 Z"
                    fill="url(#chartGradient)"
                  />
                  <path
                    d="M 0,80 Q 25,60 50,75 T 100,40 T 150,60 T 200,45 T 250,70 T 300,30"
                    fill="none"
                    stroke="#5C45FD"
                    strokeWidth="2"
                  />
                  {[
                    [0,80], [50,75], [100,40], [150,60], [200,45], [250,70], [300,30]
                  ].map(([cx, cy], index) => (
                    <circle key={index} cx={cx} cy={cy} r="3" fill="#5C45FD" />
                  ))}
                </svg>
              </div>

              <div className="flex justify-between text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-100">
                <span>8 May</span>
                <span>13 May</span>
                <span>18 May</span>
                <span>23 May</span>
                <span>28 May</span>
                <span>2 Jun</span>
                <span>7 Jun</span>
              </div>
            </div>

            {/* Transactions */}
            <div className="lg:col-span-5 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-800">Recent Transactions</h2>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 text-[11px]">
                      <th className="pb-2 font-medium">Transaction ID</th>
                      <th className="pb-2 font-medium">User</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {transactions.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="py-4 text-center text-slate-400 text-xs">No transactions recorded yet</td>
                      </tr>
                    ) : (
                      transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 font-mono text-[11px] text-slate-600">{String(tx.id).slice(0, 12)}...</td>
                          <td className="py-2.5 font-medium text-slate-800">{tx.user}</td>
                          <td className="py-2.5 font-bold text-slate-900">{tx.amount}</td>
                          <td className="py-2.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              tx.status === 'Success' 
                                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' 
                                : 'bg-rose-50 text-rose-600 border border-rose-200'
                            }`}>
                              {tx.status}
                            </span>
                          </td>
                          <td className="py-2.5 text-slate-500 text-[11px]">{tx.date}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="text-center pt-3 border-t border-slate-100 mt-2">
                <button className="text-xs font-bold text-indigo-600 hover:text-indigo-700">View All</button>
              </div>
            </div>

            {/* Packages */}
            <div className="lg:col-span-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-bold text-slate-800">Credit Packages</h2>
                <button className="text-xs font-bold text-indigo-600 hover:underline">Manage</button>
              </div>

              <div className="space-y-2.5">
                {creditPackages.length === 0 ? (
                  <p className="text-xs text-slate-400">No credit packages created</p>
                ) : (
                  creditPackages.map((pkg) => (
                    <div key={pkg.id || pkg.name} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-slate-200 transition bg-slate-50/50">
                      <div>
                        <p className="text-xs font-bold text-slate-900">{pkg.name}</p>
                        <p className="text-[10px] text-slate-500">{pkg.credits}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-slate-800">{pkg.price}</span>
                        <button 
                          onClick={() => handleOpenEditPackage(pkg)}
                          className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                          title="Edit package"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button className="w-full mt-3 py-2 bg-[#5C45FD] hover:bg-[#4E38E5] text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition">
                <Plus className="w-3.5 h-3.5" />
                Add New Package
              </button>
            </div>
          </div>

          {/* User Credits Management Table */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">User Credits & Quota Control</h2>
                <p className="text-xs text-slate-400">Manage user quotas and direct database balances</p>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative w-full sm:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search by email or name..."
                    className="w-full pl-8 pr-3 py-1.5 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[11px]">
                    <th className="pb-2 font-medium">User</th>
                    <th className="pb-2 font-medium">Role</th>
                    <th className="pb-2 font-medium">Credits Left</th>
                    <th className="pb-2 font-medium">Projects</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {usersList
                    .filter((u) => 
                      (u.email || '').toLowerCase().includes(userSearch.toLowerCase()) || 
                      (u.name || '').toLowerCase().includes(userSearch.toLowerCase())
                    )
                    .map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5">
                          <p className="font-semibold text-slate-900">{user.name || 'Anonymous'}</p>
                          <p className="text-[11px] text-slate-400">{user.email}</p>
                        </td>
                        <td className="py-2.5">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600">
                            {user.role || 'USER'}
                          </span>
                        </td>
                        <td className="py-2.5 font-bold text-indigo-600">{user.credits}</td>
                        <td className="py-2.5 text-slate-500">{user.projectsCount ?? 0}</td>
                        <td className="py-2.5 text-right space-x-1.5">
                          <button
                            onClick={() => handleUserCreditAdjust(user, 5)}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-bold text-[11px] transition cursor-pointer"
                          >
                            +5 Credits
                          </button>
                          <button
                            onClick={() => handleUserCreditAdjust(user, -5)}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-[11px] transition cursor-pointer"
                          >
                            -5 Credits
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>

      {/* Package Edit Modal */}
      {showPackageModal && selectedPkg && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-extrabold text-slate-900">Edit {selectedPkg.name} Plan</h3>
              <button onClick={() => setShowPackageModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePackage} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Price in INR (₹)
                </label>
                <input 
                  type="number"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                  Credits Granted
                </label>
                <input 
                  type="number"
                  required
                  value={editCredits}
                  onChange={(e) => setEditCredits(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPackageModal(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveLoading}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition disabled:opacity-50 cursor-pointer"
                >
                  {saveLoading ? 'Saving...' : 'Save to Database'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Global Credit Modal */}
      {showGlobalModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl p-6 shadow-2xl border border-slate-200">
            <h3 className="text-sm font-extrabold text-slate-900 mb-2">Grant Free Credits</h3>
            <p className="text-xs text-slate-500 mb-4">Add free credits to all registered users.</p>
            <input 
              type="number" 
              value={creditAmount} 
              onChange={(e) => setCreditAmount(Number(e.target.value))}
              className="w-full px-3 py-2 border rounded-xl text-xs mb-4"
            />
            <div className="flex gap-2">
              <button onClick={() => setShowGlobalModal(false)} className="flex-1 py-2 bg-slate-100 rounded-xl text-xs font-bold text-slate-600 cursor-pointer">Cancel</button>
              <button onClick={handleGlobalCreditGrant} className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-xs font-bold cursor-pointer">Grant Credits</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
