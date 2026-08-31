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
  LogOut,
  ChevronDown,
  X,
  Edit2,
  Gift,
  Search,
  Sparkles,
  RefreshCw,
  KeyRound,
  ExternalLink
} from 'lucide-react';

const API_BASE = 'https://webtoai-backend.onrender.com';

export default function App() {
  // Authentication State
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || '');
  const [adminEmail, setAdminEmail] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  // Dashboard Navigation & Data
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const [metrics, setMetrics] = useState({
    totalUsers: '0',
    totalProjects: '0',
    totalRevenue: '₹0',
    creditsSold: '0',
    activeDeployments: '0'
  });

  const [usersList, setUsersList] = useState([]);
  const [projectsList, setProjectsList] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [packages, setPackages] = useState([]);

  // Modals & Search State
  const [userSearch, setUserSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showGlobalModal, setShowGlobalModal] = useState(false);
  const [globalCreditAmount, setGlobalCreditAmount] = useState(10);
  const [editingPackage, setEditingPackage] = useState(null);

  // Authentication Handlers
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail.trim().toLowerCase() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to dispatch OTP');
      setOtpSent(true);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: adminEmail.trim().toLowerCase(), otp: otpCode.trim() })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      localStorage.setItem('admin_token', data.token);
      setToken(data.token);
    } catch (err) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken('');
    setOtpSent(false);
    setOtpCode('');
  };

  // Data Synchronizer
  const fetchAllData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/dashboard-data`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        if (data.metrics) setMetrics(data.metrics);
        if (data.users) setUsersList(data.users);
        if (data.projects) setProjectsList(data.projects);
        if (data.transactions) setTransactions(data.transactions);
        if (data.packages) setPackages(data.packages);
      } else if (res.status === 401 || res.status === 403) {
        handleLogout();
      }
    } catch (err) {
      console.error('Fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchAllData();
    }
  }, [token]);

  const showToast = (msg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 4000);
  };

  // Credit & Package Modifiers
  const handleGlobalCreditGrant = async () => {
    const amt = Number(globalCreditAmount) || 0;
    try {
      const res = await fetch(`${API_BASE}/api/admin/credits/grant-global`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ amount: amt })
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.message || `Granted ${amt} credits globally.`);
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
    setShowGlobalModal(false);
  };

  const handleUserCreditAdjust = async (delta) => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`${API_BASE}/api/admin/credits/adjust-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ email: selectedUser.email, delta })
      });
      if (res.ok) {
        showToast(`Adjusted credits for ${selectedUser.name}`);
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
    setShowUserModal(false);
  };

  const handleSavePackage = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${API_BASE}/api/admin/packages/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editingPackage)
      });
      if (res.ok) {
        showToast('Package updated & live on webtoai.vercel.app');
        fetchAllData();
      }
    } catch (e) {
      console.error(e);
    }
    setEditingPackage(null);
  };

  // Login View
  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0F1123', padding: '16px', fontFamily: 'sans-serif' }}>
        <div style={{ width: '100%', maxWidth: '380px', backgroundColor: '#181B34', border: '1px solid #282C4B', borderRadius: '24px', padding: '32px', color: '#fff', textAlign: 'center' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '16px', background: 'linear-gradient(135deg, #6366f1, #9333ea)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', boxShadow: '0 4px 16px rgba(99, 102, 241, 0.4)' }}>
            <KeyRound size={26} color="#fff" />
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 6px 0' }}>WEBTO AI Admin Login</h2>
          <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 24px 0' }}>Sign in to manage users, credits, and live packages.</p>

          {authError && (
            <div style={{ backgroundColor: '#451a24', color: '#f87171', padding: '10px', borderRadius: '12px', fontSize: '12px', marginBottom: '16px' }}>
              {authError}
            </div>
          )}

          {!otpSent ? (
            <form onSubmit={handleRequestOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="email"
                required
                placeholder="Enter Registered Admin Email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '12px', backgroundColor: '#0F1123', border: '1px solid #282C4B', color: '#fff', fontSize: '13px', boxSizing: 'border-box' }}
              />
              <button
                type="submit"
                disabled={authLoading}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: '#5C45FD', color: '#fff', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer' }}
              >
                {authLoading ? 'Sending Email OTP...' : 'Send Security Code'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="Enter 6-Digit Code"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                style={{ width: '100%', padding: '12px', textAlign: 'center', letterSpacing: '6px', borderRadius: '12px', backgroundColor: '#0F1123', border: '1px solid #282C4B', color: '#fff', fontSize: '18px', fontWeight: 800, boxSizing: 'border-box' }}
              />
              <button
                type="submit"
                disabled={authLoading}
                style={{ width: '100%', padding: '12px', borderRadius: '12px', backgroundColor: '#10b981', color: '#fff', fontWeight: 700, fontSize: '13px', border: 'none', cursor: 'pointer' }}
              >
                {authLoading ? 'Verifying...' : 'Authenticate'}
              </button>
              <button
                type="button"
                onClick={() => setOtpSent(false)}
                style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '12px', cursor: 'pointer' }}
              >
                Change Email Address
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Navigation Items
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

  const filteredUsers = usersList.filter(u =>
    (u.name || '').toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(userSearch.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', minHeight: '100vh', backgroundColor: '#F4F6FB', color: '#1e293b', fontFamily: 'sans-serif' }}>
      
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}

      {/* Left Sidebar */}
      <aside style={{ width: '260px', backgroundColor: '#0F1123', color: '#94a3b8', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexShrink: 0, zIndex: 50 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 20px', borderBottom: '1px solid #1e293b' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '10px', background: 'linear-gradient(135deg, #6366f1, #9333ea)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                <Sparkles size={18} />
              </div>
              <span style={{ fontWeight: 800, color: '#ffffff', fontSize: '15px' }}>WEBTO AI</span>
              <span style={{ fontSize: '10px', fontWeight: 800, backgroundColor: '#4338CA', color: '#e0e7ff', padding: '2px 8px', borderRadius: '999px' }}>ADMIN</span>
            </div>
          </div>

          <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.label;
              return (
                <button
                  key={item.label}
                  onClick={() => { setActiveTab(item.label); setSidebarOpen(false); }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 14px',
                    borderRadius: '12px',
                    fontSize: '13px',
                    fontWeight: isActive ? 700 : 500,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: isActive ? '#2E2856' : 'transparent',
                    color: isActive ? '#ffffff' : '#94a3b8',
                    textAlign: 'left'
                  }}
                >
                  <Icon size={16} color={isActive ? '#818cf8' : '#94a3b8'} />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div style={{ padding: '16px 12px', borderTop: '1px solid #1e293b' }}>
          <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '12px', fontSize: '13px', fontWeight: 600, border: 'none', cursor: 'pointer', backgroundColor: 'transparent', color: '#f43f5e' }}>
            <LogOut size={16} />
            Logout Session
          </button>
        </div>
      </aside>

      {/* Main Panel */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
        <header style={{ backgroundColor: '#ffffff', borderBottom: '1px solid #e2e8f0', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 30 }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: 0 }}>{activeTab}</h1>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={() => setShowGlobalModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 14px', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', borderRadius: '10px', fontSize: '12px', fontWeight: 700, color: '#4338ca', cursor: 'pointer' }}
            >
              <Gift size={15} />
              Give Global Free Credits
            </button>
            <button
              onClick={fetchAllData}
              style={{ padding: '8px 12px', borderRadius: '10px', border: '1px solid #e2e8f0', backgroundColor: '#f8fafc', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600 }}
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              Sync DB
            </button>
          </div>
        </header>

        {statusMsg && (
          <div style={{ backgroundColor: '#10b981', color: '#ffffff', padding: '10px 24px', fontSize: '13px', fontWeight: 700, textAlign: 'center' }}>
            {statusMsg}
          </div>
        )}

        <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '1400px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
          
          {/* Top 5 Metric Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
            <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Total Users</span>
              <p style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '8px 0' }}>{metrics.totalUsers}</p>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>+12.5% this month</span>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Total Projects</span>
              <p style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '8px 0' }}>{metrics.totalProjects}</p>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>+18.7% this month</span>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Total Revenue</span>
              <p style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '8px 0' }}>{metrics.totalRevenue}</p>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>+22.4% this month</span>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Credits Sold</span>
              <p style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '8px 0' }}>{metrics.creditsSold}</p>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>+16.3% this month</span>
            </div>

            <div style={{ backgroundColor: '#ffffff', padding: '18px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#64748b' }}>Active Deployments</span>
              <p style={{ fontSize: '24px', fontWeight: 900, color: '#0f172a', margin: '8px 0' }}>{metrics.activeDeployments}</p>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#16a34a' }}>+8.2% this month</span>
            </div>
          </div>

          {/* VIEW: Users / Credits Management */}
          {(activeTab === 'Dashboard' || activeTab === 'Users' || activeTab === 'Credits') && (
            <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Registered Users & Live Quota Control</h2>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Real user accounts registered on WEBTO AI</p>
                </div>
                
                <div style={{ position: 'relative', width: '240px' }}>
                  <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px', top: '10px' }} />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search name or email..."
                    style={{ width: '100%', padding: '8px 10px 8px 32px', fontSize: '12px', border: '1px solid #e2e8f0', borderRadius: '10px', backgroundColor: '#f8fafc', boxSizing: 'border-box' }}
                  />
                </div>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '12px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#94a3b8', fontSize: '11px' }}>
                      <th style={{ paddingBottom: '10px' }}>User Details</th>
                      <th style={{ paddingBottom: '10px' }}>Sign-in Method</th>
                      <th style={{ paddingBottom: '10px' }}>AI Credits Balance</th>
                      <th style={{ paddingBottom: '10px' }}>Projects Built</th>
                      <th style={{ paddingBottom: '10px' }}>Joined Date</th>
                      <th style={{ paddingBottom: '10px', textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                          No users found matching your search.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user) => (
                        <tr key={user.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                          <td style={{ padding: '12px 0' }}>
                            <p style={{ margin: 0, fontWeight: 700, color: '#1e293b' }}>{user.name}</p>
                            <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{user.email}</p>
                          </td>
                          <td style={{ padding: '12px 0' }}>
                            <span style={{ padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700, backgroundColor: user.authProvider === 'GOOGLE' ? '#f0fdf4' : '#f8fafc', color: user.authProvider === 'GOOGLE' ? '#166534' : '#475569', border: `1px solid ${user.authProvider === 'GOOGLE' ? '#bbf7d0' : '#e2e8f0'}` }}>
                              {user.authProvider}
                            </span>
                          </td>
                          <td style={{ padding: '12px 0' }}>
                            <span style={{ fontWeight: 800, color: '#4338ca', backgroundColor: '#eef2ff', padding: '4px 10px', borderRadius: '6px', border: '1px solid #c7d2fe' }}>
                              {user.credits} Credits
                            </span>
                          </td>
                          <td style={{ padding: '12px 0', fontWeight: 600, color: '#475569' }}>
                            {user.projectsCount} Projects
                          </td>
                          <td style={{ padding: '12px 0', color: '#64748b', fontSize: '11px' }}>{user.joined}</td>
                          <td style={{ padding: '12px 0', textAlign: 'right' }}>
                            <button
                              onClick={() => { setSelectedUser(user); setShowUserModal(true); }}
                              style={{ padding: '6px 14px', backgroundColor: '#eef2ff', border: '1px solid #c7d2fe', color: '#4338ca', borderRadius: '8px', fontSize: '11px', fontWeight: 700, cursor: 'pointer' }}
                            >
                              Manage Credits
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* VIEW: Projects Created */}
          {(activeTab === 'Projects' || activeTab === 'Deployments') && (
            <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0' }}>All Generated User Projects</h2>
              <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#94a3b8', fontSize: '11px' }}>
                    <th style={{ paddingBottom: '10px' }}>Project Title</th>
                    <th style={{ paddingBottom: '10px' }}>Owner</th>
                    <th style={{ paddingBottom: '10px' }}>Type</th>
                    <th style={{ paddingBottom: '10px' }}>Deployment</th>
                    <th style={{ paddingBottom: '10px' }}>Last Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {projectsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>No projects created yet.</td>
                    </tr>
                  ) : (
                    projectsList.map((p) => (
                      <tr key={p.id} style={{ borderBottom: '1px solid #f8fafc' }}>
                        <td style={{ padding: '12px 0', fontWeight: 700, color: '#1e293b' }}>{p.name}</td>
                        <td style={{ padding: '12px 0', color: '#64748b' }}>{p.ownerEmail}</td>
                        <td style={{ padding: '12px 0' }}>
                          <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9' }}>{p.type}</span>
                        </td>
                        <td style={{ padding: '12px 0' }}>
                          {p.isDeployed ? (
                            <a href={p.deployedUrl} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              Live <ExternalLink size={12} />
                            </a>
                          ) : (
                            <span style={{ color: '#94a3b8' }}>Unpublished</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 0', color: '#64748b' }}>{p.updatedAt}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* VIEW: Credit Packages (Synced with Main Live App) */}
          {(activeTab === 'Dashboard' || activeTab === 'Credit Packages' || activeTab === 'Payments') && (
            <div style={{ backgroundColor: '#ffffff', padding: '24px', borderRadius: '16px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Credit Packages (Live Synced with Prisma DB)</h2>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Editing packages here immediately updates the main website's checkout pricing</p>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
                {packages.map((pkg) => (
                  <div key={pkg.id} style={{ padding: '20px', borderRadius: '16px', border: pkg.popular ? '2px solid #6366f1' : '1px solid #e2e8f0', backgroundColor: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>{pkg.name}</span>
                        {pkg.popular && <span style={{ fontSize: '10px', fontWeight: 800, color: '#4338ca', backgroundColor: '#e0e7ff', padding: '2px 6px', borderRadius: '4px' }}>POPULAR</span>}
                      </div>
                      <p style={{ fontSize: '22px', fontWeight: 900, color: '#0f172a', margin: '6px 0' }}>₹{pkg.priceInInr} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>/ {pkg.credits} Builds</span></p>
                    </div>

                    <button
                      onClick={() => setEditingPackage(pkg)}
                      style={{ marginTop: '16px', padding: '8px', backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    >
                      <Edit2 size={13} />
                      Edit Package Price & Credits
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </main>

      {/* Package Edit Modal */}
      {editingPackage && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 60 }}>
          <form onSubmit={handleSavePackage} style={{ backgroundColor: '#ffffff', borderRadius: '16px', maxWidth: '380px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 16px 0' }}>Edit {editingPackage.name}</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Package Name</label>
              <input
                type="text"
                value={editingPackage.name}
                onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Price (₹ INR)</label>
              <input
                type="number"
                value={editingPackage.priceInInr}
                onChange={(e) => setEditingPackage({ ...editingPackage, priceInInr: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>Build Credits Granted</label>
              <input
                type="number"
                value={editingPackage.credits}
                onChange={(e) => setEditingPackage({ ...editingPackage, credits: Number(e.target.value) })}
                style={{ width: '100%', padding: '8px 12px', borderRadius: '10px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" onClick={() => setEditingPackage(null)} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, backgroundColor: '#f1f5f9', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, backgroundColor: '#5C45FD', color: '#fff', border: 'none', cursor: 'pointer' }}>Save & Sync Live</button>
            </div>
          </form>
        </div>
      )}

      {/* Global Credits Modal */}
      {showGlobalModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 60 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', maxWidth: '380px', width: '100%', padding: '24px' }}>
            <h3 style={{ fontSize: '15px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px 0' }}>Grant Global Free Credits</h3>
            <p style={{ fontSize: '12px', color: '#64748b', margin: '0 0 16px 0' }}>Add free AI build credits to every registered user in your database simultaneously.</p>
            <input
              type="number"
              min="1"
              value={globalCreditAmount}
              onChange={(e) => setGlobalCreditAmount(e.target.value)}
              style={{ width: '100%', padding: '10px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '10px', marginBottom: '16px', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setShowGlobalModal(false)} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, backgroundColor: '#f1f5f9', border: 'none', cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleGlobalCreditGrant} style={{ flex: 1, padding: '10px', borderRadius: '10px', fontSize: '12px', fontWeight: 700, backgroundColor: '#5C45FD', color: '#fff', border: 'none', cursor: 'pointer' }}>Grant to All</button>
            </div>
          </div>
        </div>
      )}

      {/* Individual User Credits Modal */}
      {showUserModal && selectedUser && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', zIndex: 60 }}>
          <div style={{ backgroundColor: '#ffffff', borderRadius: '16px', maxWidth: '380px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: 800, color: '#0f172a', margin: 0 }}>Adjust User Credits</h3>
              <X size={16} color="#64748b" style={{ cursor: 'pointer' }} onClick={() => setShowUserModal(false)} />
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '10px', border: '1px solid #f1f5f9', marginBottom: '16px' }}>
              <p style={{ margin: 0, fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>{selectedUser.name}</p>
              <p style={{ margin: 0, fontSize: '11px', color: '#64748b' }}>{selectedUser.email}</p>
              <p style={{ margin: '6px 0 0 0', fontSize: '12px', fontWeight: 800, color: '#4338ca' }}>Current: {selectedUser.credits} Credits</p>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button onClick={() => handleUserCreditAdjust(5)} style={{ padding: '10px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>+5 Credits</button>
              <button onClick={() => handleUserCreditAdjust(20)} style={{ padding: '10px', backgroundColor: '#eef2ff', color: '#4338ca', border: '1px solid #c7d2fe', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>+20 Credits</button>
              <button onClick={() => handleUserCreditAdjust(-5)} style={{ padding: '10px', backgroundColor: '#fff1f2', color: '#be123c', border: '1px solid #fecdd3', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>-5 Credits</button>
              <button onClick={() => handleUserCreditAdjust(100)} style={{ padding: '10px', backgroundColor: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff', borderRadius: '10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>+100 Credits</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}