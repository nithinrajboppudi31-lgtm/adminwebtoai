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
  RefreshCw
} from 'lucide-react';

const BACKEND_URL = 'https://webtoai-backend.onrender.com';

export default function AdminDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [loading, setLoading] = useState(false);
  
  // Real database states
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProjects: 0,
    totalRevenue: '₹0',
    creditsSold: 0,
    activeDeployments: 0,
  });
  const [usersList, setUsersList] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [creditPackages, setCreditPackages] = useState([]);

  // Modals for credit management
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [showUserModal, setShowUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [creditAmount, setCreditAmount] = useState(5);
  const [userSearch, setUserSearch] = useState('');

  // Fetch Live PostgreSQL Data
  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/dashboard-data`);
      if (res.ok) {
        const data = await res.json();
        if (data.stats) setStats(data.stats);
        if (data.users) setUsersList(data.users);
        if (data.transactions) setTransactions(data.transactions);
        if (data.creditPackages) setCreditPackages(data.creditPackages);
      }
    } catch (err) {
      console.error('Error fetching PostgreSQL admin data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Grant Global Credits Handler
  const handleGlobalCreditGrant = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/credits/grant-global`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: creditAmount }),
      });

      if (res.ok) {
        setShowGlobalModal(false);
        loadDashboardData(); // Refresh UI
      }
    } catch (err) {
      console.error('Global credit update error:', err);
    }
  };

  // Adjust Specific User Credit Handler
  const handleUserCreditAdjust = async (delta) => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`${BACKEND_URL}/api/admin/credits/adjust-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUser.id, delta }),
      });

      if (res.ok) {
        setShowUserModal(false);
        loadDashboardData(); // Refresh UI
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
      
      {/* Mobile Sidebar Backdrop */}
      {sidebarOpen && (
        <div 
          onClick={() => setSidebarOpen(false)} 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        />
      )}

      {/* Sidebar Navigation */}
      <aside className={`
        fixed top-0 bottom-0 left-0 z-50 w-64 bg-[#0F1123] text-slate-300 flex flex-col justify-between transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div>
          {/* Logo Header */}
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

          {/* Navigation Links */}
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

        {/* Bottom Actions */}
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        
        {/* Top Navbar */}
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

        {/* Dynamic Data Grid */}
        <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
          
          {/* Top 5 Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Users</span>
              <p className="text-2xl font-black text-slate-900 my-2">{stats.totalUsers.toLocaleString()}</p>
              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                <TrendingUp className="w-3 h-3" />
                <span>+12.5% this month</span>
              </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <span className="text-xs font-semibold text-slate-500">Total Projects</span>
              <p className="text-2xl font-black text-slate-900 my-2">{stats.totalProjects.toLocaleString()}</p>
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
              <span className="text-xs font-semibold text-slate-500">Credits Balance (All)</span>
              <p className="text-2xl font-black text-slate-900 my-2">{stats.creditsSold.toLocaleString()}</p>
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

          {/* Center Chart, Transactions, Packages */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Graph */}
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
                        <button className="p-1 text-slate-400 hover:text-slate-600">
                          <Edit2 className="w-3 h-3" />
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

          {/* User Credits Management Table (Connected to PostgreSQL Users) */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">User Credits & Quota Control</h2>
                <p className="text-xs text-slate-400">Search users and adjust real generation balances</p>
              </div>
              
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search user..."
                    className="w-full text-xs pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-400 text-[11px]">
                    <th className="pb-2 font-medium">User ID</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Balance</th>
                    <th className="pb-2 font-medium">Joined</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {usersList
                    .filter(u => 
                      (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase())) || 
                      (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase()))
                    )
                    .map((user) => (
                      <tr key={user.id} className="hover:bg-slate-50/50">
                        <td className="py-2.5 font-mono text-[11px] text-slate-500">{user.id.slice(0, 8)}...</td>
                        <td className="py-2.5">
                          <p className="font-bold text-slate-800">{user.name || 'Anonymous User'}</p>
                          <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                            user.role === 'ADMIN' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="py-2.5 text-slate-600">
                          <div>{user.email}</div>
                          <span className="text-[10px] text-slate-400 capitalize">{String(user.authProvider).toLowerCase()}</span>
                        </td>
                        <td className="py-2.5">
                          <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                            {user.credits} Credits
                          </span>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            Free builds: {user.freeBuildsUsed}/{user.freeBuildsTotal}
                          </p>
                        </td>
                        <td className="py-2.5 text-slate-500">{user.joined}</td>
                        <td className="py-2.5 text-right">
                          <button
                            onClick={() => {
                              setSelectedUser(user);
                              setShowUserModal(true);
                            }}
                            className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Manage Credits
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

      {/* Global Free Credits Modal */}
      {showGlobalModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">Grant Global Free Credits</h3>
              <button onClick={() => setShowGlobalModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-500">
              This will add free generation credits to every registered user in your PostgreSQL database simultaneously.
            </p>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Credits Amount</label>
              <input
                type="number"
                min="1"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowGlobalModal(false)}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleGlobalCreditGrant}
                className="flex-1 py-2 rounded-xl text-xs font-bold text-white bg-[#5C45FD] hover:bg-[#4E38E5] transition shadow-sm"
              >
                Grant to All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* User Specific Credit Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl border border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">Adjust User Credits</h3>
              <button onClick={() => setShowUserModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <p className="text-xs font-bold text-slate-800">{selectedUser.name}</p>
              <p className="text-[11px] text-slate-500">{selectedUser.email}</p>
              <p className="text-xs font-extrabold text-indigo-600 mt-1">Current: {selectedUser.credits} Credits</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleUserCreditAdjust(5)}
                className="py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                +5 Credits
              </button>
              <button
                onClick={() => handleUserCreditAdjust(20)}
                className="py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                +20 Credits
              </button>
              <button
                onClick={() => handleUserCreditAdjust(-5)}
                className="py-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                -5 Credits
              </button>
              <button
                onClick={() => handleUserCreditAdjust(100)}
                className="py-2 bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 rounded-xl text-xs font-bold transition cursor-pointer"
              >
                +100 Credits
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}