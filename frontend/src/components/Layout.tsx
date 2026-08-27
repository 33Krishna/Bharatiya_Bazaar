import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { role, user, loginContext, logout, token } = useAuth();
  const [balance, setBalance] = useState<number>(0);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteSide, setInviteSide] = useState<"LEFT" | "RIGHT">("LEFT");
  const navigate = useNavigate();
  const location = useLocation();

  // Load wallet balance for topbar chip
  useEffect(() => {
    if (token && role === "MEMBER") {
      fetch("/api/wallet/balance", {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(res => {
          if (res.success && res.data) {
            setBalance(res.data.balancePaise || 0);
          }
        })
        .catch(err => console.error("Error loading topbar balance:", err));
    }
  }, [token, role, location.pathname]);

  const handleLogout = (e: React.MouseEvent) => {
    e.preventDefault();
    logout();
    navigate("/login");
  };

  const copyReferralLink = () => {
    const memberCode = user?.memberCode || "";
    if (memberCode) {
      // Direct register link mapping side parameter
      const link = `${window.location.origin}/register?ref=${memberCode}&side=${inviteSide}`;
      navigator.clipboard.writeText(link)
        .then(() => {
          alert(`✅ ${inviteSide} LEG referral link copied!\n\n` + link);
          setInviteModalOpen(false);
        })
        .catch(() => {
          prompt("Copy your referral link:", link);
          setInviteModalOpen(false);
        });
    } else {
      alert("Member code not available. Please refresh.");
    }
  };

  const activeCardNumber = loginContext?.cardNumber || user?.memberCode || "";
  const isSub = loginContext?.isSubCard || false;
  const ownerCode = loginContext?.ownerMemberCode || user?.memberCode || "";
  const name = user?.name || "Member";
  const avatarChar = name.charAt(0).toUpperCase();

  const renderMemberSidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-badge"></span>
        <div className="brand-text">
          <div className="title">Bharatiya Bazaar</div>
          <div className="subtitle">भारतीय बाज़ार</div>
        </div>
      </div>
      <div className="sidebar-profile">
        <div className="avatar">{avatarChar}</div>
        <div className="profile-info">
          <div className="profile-name">{name}</div>
          <div className="profile-code">{activeCardNumber}</div>
        </div>
      </div>
      <div className="sidebar-nav">
        <div className="nav-section-title">Cooperative Hub</div>
        <Link to="/dashboard" className={`nav-item ${location.pathname === "/dashboard" ? "active" : ""}`}>
          <span className="icon">📊</span>Dashboard
        </Link>
        <Link to="/wallet" className={`nav-item ${location.pathname === "/wallet" ? "active" : ""}`}>
          <span className="icon">💼</span>My Wallet
        </Link>
        <Link to="/commissions" className={`nav-item ${location.pathname === "/commissions" ? "active" : ""}`}>
          <span className="icon">🪙</span>Commissions
        </Link>
        <Link to="/my-system" className={`nav-item ${location.pathname === "/my-system" ? "active" : ""}`}>
          <span className="icon">🌳</span>My System
        </Link>
        <Link to="/autopool" className={`nav-item ${location.pathname === "/autopool" ? "active" : ""}`}>
          <span className="icon">🌀</span>AutoPool
        </Link>
        <Link to="/setu-kosh" className={`nav-item ${location.pathname === "/setu-kosh" ? "active" : ""}`}>
          <span className="icon">🏺</span>Setu Kosh
        </Link>
        <Link to="/rebirth" className={`nav-item ${location.pathname === "/rebirth" ? "active" : ""}`}>
          <span className="icon">🔄</span>Rebirth IDs
        </Link>
        
        <div className="nav-section-title">Account</div>
        <Link to="/notifications" className={`nav-item ${location.pathname === "/notifications" ? "active" : ""}`}>
          <span className="icon">🔔</span>Notifications
        </Link>
        <Link to="/qr" className={`nav-item ${location.pathname === "/qr" ? "active" : ""}`}>
          <span className="icon">🪪</span>My QR Card
        </Link>
        <Link to="/calculator" className={`nav-item ${location.pathname === "/calculator" ? "active" : ""}`}>
          <span className="icon">🧮</span>Calculator
        </Link>
        <Link to="/hindi" className={`nav-item ${location.pathname === "/hindi" ? "active" : ""}`}>
          <span className="icon">🇮🇳</span>हिंदी में (Hindi)
        </Link>
        <a href="#" className="nav-item logout" onClick={handleLogout}>
          <span className="icon">🚪</span>Sign Out
        </a>
      </div>
    </aside>
  );

  const renderVendorSidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-badge"></span>
        <div className="brand-text">
          <div className="title">Bharatiya Bazaar</div>
          <div className="subtitle">भारतीय बाज़ार</div>
        </div>
      </div>
      <div className="sidebar-profile">
        <div className="avatar">🏪</div>
        <div className="profile-info">
          <div className="profile-name">{user?.businessName || "Merchant"}</div>
          <div className="profile-code">{user?.category || "VENDOR"}</div>
        </div>
      </div>
      <div className="sidebar-nav">
        <div className="nav-section-title">Merchant Hub</div>
        <Link to="/vendor-dashboard" className={`nav-item ${location.pathname === "/vendor-dashboard" ? "active" : ""}`}>
          <span className="icon">🏪</span>Shop Terminal
        </Link>
        <Link to="/vendor-settlements" className={`nav-item ${location.pathname === "/vendor-settlements" ? "active" : ""}`}>
          <span className="icon">🧾</span>Settlements
        </Link>
        <a href="#" className="nav-item logout" onClick={handleLogout}>
          <span className="icon">🚪</span>Sign Out
        </a>
      </div>
    </aside>
  );

  const renderAdminSidebar = () => (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <span className="brand-badge"></span>
        <div className="brand-text">
          <div className="title">Admin Portal</div>
          <div className="subtitle">भारतीय बाज़ार</div>
        </div>
      </div>
      <div className="sidebar-profile">
        <div className="avatar">⚙️</div>
        <div className="profile-info">
          <div className="profile-name">{user?.name || "Admin"}</div>
          <div className="profile-code">ADMIN</div>
        </div>
      </div>
      <div className="sidebar-nav">
        <div className="nav-section-title">Governance Hub</div>
        <Link to="/admin-dashboard" className={`nav-item ${location.pathname === "/admin-dashboard" ? "active" : ""}`}>
          <span className="icon">🏛️</span>Overview
        </Link>
        <Link to="/admin-kyc" className={`nav-item ${location.pathname === "/admin-kyc" ? "active" : ""}`}>
          <span className="icon">🪪</span>KYC Audits
        </Link>
        <Link to="/admin-payouts" className={`nav-item ${location.pathname === "/admin-payouts" ? "active" : ""}`}>
          <span className="icon">💸</span>Payout Audits
        </Link>
        <Link to="/admin-members" className={`nav-item ${location.pathname === "/admin-members" ? "active" : ""}`}>
          <span className="icon">👥</span>Members Grid
        </Link>
        <Link to="/admin-reports" className={`nav-item ${location.pathname === "/admin-reports" ? "active" : ""}`}>
          <span className="icon">📈</span>Reports & Sweep
        </Link>
        <Link to="/admin-settings" className={`nav-item ${location.pathname === "/admin-settings" ? "active" : ""}`}>
          <span className="icon">⚙️</span>Settings
        </Link>
        <Link to="/admin-disputes" className={`nav-item ${location.pathname === "/admin-disputes" ? "active" : ""}`}>
          <span className="icon">⚖️</span>Disputes
        </Link>
        <a href="#" className="nav-item logout" onClick={handleLogout}>
          <span className="icon">🚪</span>Sign Out
        </a>
      </div>
    </aside>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      {/* Dynamic Sidebar based on role */}
      {role === "ADMIN" ? renderAdminSidebar() : role === "VENDOR" ? renderVendorSidebar() : renderMemberSidebar()}

      {/* Main Workspace layout */}
      <div className="main" style={{ flex: 1 }}>
        {role === "MEMBER" && (
          <header className="topbar">
            <div>
              <h2>Good morning, {name} 🙏</h2>
              <p>
                Active Card: <strong>{activeCardNumber}</strong>
                {isSub && <span style={{ fontSize: "11px", color: "var(--amber)", marginLeft: "6px" }}>(owner {ownerCode})</span>}
              </p>
            </div>
            <div className="topbar-actions">
              <button className="topbar-btn primary" onClick={() => setInviteModalOpen(true)}>🔗 Invite Member</button>
              <Link to="/wallet" className="topbar-btn amber">
                💼 Wallet: ₹{(balance / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </Link>
            </div>
          </header>
        )}

        {role === "VENDOR" && (
          <header className="topbar">
            <div>
              <h2>Store Management Terminal</h2>
              <p>{user?.businessName}</p>
            </div>
            <div className="topbar-actions">
              <Link to="/vendor-dashboard" className="topbar-btn primary">🏪 Record Spends</Link>
            </div>
          </header>
        )}

        {role === "ADMIN" && (
          <header className="topbar">
            <div>
              <h2>Governance Control Center</h2>
              <p>Superadmin Authority Panel</p>
            </div>
            <div className="topbar-actions">
              <Link to="/admin-reports" className="topbar-btn primary">⚡ Monday Settlement Sweep</Link>
            </div>
          </header>
        )}

        <div className="container">
          {children}
        </div>
      </div>

      {/* Shared Invitation Modal */}
      {inviteModalOpen && (
        <div className="modal-backdrop open" onClick={() => setInviteModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Generate Referral Link</h3>
            <p style={{ fontSize: "13.5px", color: "var(--muted)", marginBottom: "16px" }}>
              Choose which leg to place new card registrations. Our model descends outer edges automatically.
            </p>
            
            <div style={{ display: "flex", gap: "12px", marginBottom: "16px" }}>
              <button
                type="button"
                className={`btn btn-secondary ${inviteSide === "LEFT" ? "active" : ""}`}
                style={{ flex: 1, flexDirection: "column", gap: "4px", padding: "12px 6px", border: inviteSide === "LEFT" ? "2px solid var(--teal)" : "1px solid var(--border)" }}
                onClick={() => setInviteSide("LEFT")}
              >
                <strong>LEFT LEG</strong>
                <span style={{ fontSize: "10px", fontWeight: 400, color: "var(--muted)" }}>Outer descent</span>
              </button>
              <button
                type="button"
                className={`btn btn-secondary ${inviteSide === "RIGHT" ? "active" : ""}`}
                style={{ flex: 1, flexDirection: "column", gap: "4px", padding: "12px 6px", border: inviteSide === "RIGHT" ? "2px solid var(--teal)" : "1px solid var(--border)" }}
                onClick={() => setInviteSide("RIGHT")}
              >
                <strong>RIGHT LEG</strong>
                <span style={{ fontSize: "10px", fontWeight: 400, color: "var(--muted)" }}>Outer descent</span>
              </button>
            </div>
            
            <div className="modal-actions">
              <button className="btn btn-navy" onClick={copyReferralLink}>🔗 Copy Invite Link</button>
              <button className="btn btn-secondary" onClick={() => setInviteModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
