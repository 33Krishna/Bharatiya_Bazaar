import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function AdminDashboard() {
  const { token, logout, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  // Users management (SUPER_ADMIN only)
  const [usersModalOpen, setUsersModalOpen] = useState(false);
  const [adminUsers, setAdminUsers] = useState<any[]>([]);
  const [userAlert, setUserAlert] = useState<{ text: string; type: "success" | "danger" } | null>(null);

  // New admin user form
  const [newAdminName, setNewAdminName] = useState("");
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminPassword, setNewAdminPassword] = useState("");
  const [newAdminRole, setNewAdminRole] = useState("ADMIN");

  // Monday sweep trigger
  const [sweepModalOpen, setSweepModalOpen] = useState(false);
  const [sweepAlert, setSweepAlert] = useState<{ text: string; type: "success" | "danger" } | null>(null);
  const [sweeping, setSweeping] = useState(false);

  useEffect(() => {
    if (!token) {
      logout();
      navigate("/login");
      return;
    }
    loadDashboard();
  }, [token]);

  const loadDashboard = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [statsRes, auditRes] = await Promise.all([
        fetch("/api/admin/dashboard-stats", { headers }).then(r => r.json()),
        fetch("/api/admin/audit-logs", { headers }).then(r => r.json())
      ]);

      if (statsRes.success) setStats(statsRes.data);
      if (auditRes.success) setAuditLogs(auditRes.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadAdminUsers = async () => {
    try {
      const res = await fetch("/api/admin/users", {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      if (res.success) {
        setAdminUsers(res.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenUsersModal = async () => {
    setUsersModalOpen(true);
    await loadAdminUsers();
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserAlert(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newAdminName.trim(),
          email: newAdminEmail.trim().toLowerCase(),
          password: newAdminPassword,
          role: newAdminRole
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || "Failed to create user");

      setUserAlert({
        text: `Admin user ${newAdminName} created successfully!`,
        type: "success"
      });

      setNewAdminName("");
      setNewAdminEmail("");
      setNewAdminPassword("");
      await loadAdminUsers();
    } catch (err: any) {
      setUserAlert({ text: err.message, type: "danger" });
    }
  };

  const handlePromoteAdmin = async (userId: string) => {
    if (!window.confirm("Promote this user to SUPER_ADMIN? They will gain full authority over all platform settings.")) return;
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ role: "SUPER_ADMIN" })
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || "Failed to promote user");
      await loadAdminUsers();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const triggerSettlementSweep = async () => {
    setSweeping(true);
    setSweepAlert(null);
    try {
      const res = await fetch("/api/admin/settlement/trigger", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error?.message || "Settlement run failed.");

      setSweepAlert({
        text: `Settlement Run Completed! ✓ Processed: ${data.data.vendorCount || 0} vendors | Total: ${formatINR(data.data.grossPaise || 0)}`,
        type: "success"
      });
      setTimeout(() => {
        setSweepModalOpen(false);
        loadDashboard();
      }, 2000);
    } catch (err: any) {
      setSweepAlert({ text: err.message || "Failed to execute settlement.", type: "danger" });
    } finally {
      setSweeping(false);
    }
  };

  const formatINR = (paise: number) => {
    return "₹" + (Number(paise || 0) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return <div className="loading">Loading admin dashboard...</div>;
  }

  const isSuper = user?.role === "SUPER_ADMIN";

  return (
    <div style={{ width: "100%" }}>
      <section className="page-head">
        <div>
          <h1>Platform Operations Command</h1>
          <p>Administrative governance, live reconciliation, and engine parameters</p>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          {isSuper && (
            <button className="topbar-btn amber" onClick={handleOpenUsersModal}>
              👤 Manage Admins
            </button>
          )}
        </div>
      </section>

      {/* METRICS GRID */}
      <section className="summary-grid" style={{ gridTemplateColumns: "repeat(6, 1fr)" }}>
        <div className="card stat-card">
          <div className="label">Total Members</div>
          <div className="value">{stats?.members || 0}</div>
          <div className="sub">Registered accounts</div>
        </div>
        <div className="card stat-card">
          <div className="label">Total ID Cards</div>
          <div className="value">{stats?.idCards || 0}</div>
          <div className="sub">MAIN / SUB / REBIRTH</div>
        </div>
        <div className="card stat-card">
          <div className="label">AutoPool Global Head</div>
          <div className="value">#{stats?.autopoolHead || 0}</div>
          <div className="sub">BFS Tree Nodes</div>
        </div>
        <div className="card stat-card">
          <div className="label">Active Vendors</div>
          <div className="value">{stats?.activeVendors || 0}</div>
          <div className="sub">Verified merchants</div>
        </div>
        <div className="card stat-card">
          <div className="label">Pending Withdrawals</div>
          <div className="value" style={{ color: "var(--warning)" }}>{formatINR(stats?.pendingWithdrawalsPaise || 0)}</div>
          <div className="sub">{stats?.pendingWithdrawalsCount || 0} requests queued</div>
        </div>
        <div className="card stat-card">
          <div className="label">Pending 194R Liability</div>
          <div className="value" style={{ color: "var(--danger)" }}>{formatINR(stats?.pending194RPaise || 0)}</div>
          <div className="sub">Vouchers TDS to recover</div>
        </div>
      </section>

      {/* QUICK ACTIONS HUB */}
      <section style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "14px", margin: "20px 0" }}>
        <Link to="/admin-settings" className="card panel" style={{ textDecoration: "none", color: "inherit" }}>
          <h3 style={{ fontSize: "16px", color: "var(--navy)", marginBottom: "6px" }}>⚙️ Platform Settings & Margins</h3>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Configure TDS rates, operational thresholds, hold toggles, and category margins.</p>
        </Link>
        <Link to="/admin-reports" className="card panel" style={{ textDecoration: "none", color: "inherit" }}>
          <h3 style={{ fontSize: "16px", color: "var(--navy)", marginBottom: "6px" }}>📊 Financial Reports & Queue</h3>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Platform wallet reconciliation, pending withdrawal approvals, and TDS tracking.</p>
        </Link>
        <div className="card panel" style={{ cursor: "pointer" }} onClick={() => setSweepModalOpen(true)}>
          <h3 style={{ fontSize: "16px", color: "var(--navy)", marginBottom: "6px" }}>⚡ Run Weekly Settlement</h3>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Execute the weekly Monday settlement sweep manually for all cleared vendor sales.</p>
        </div>
        <Link to="/admin-kyc" className="card panel" style={{ textDecoration: "none", color: "inherit" }}>
          <h3 style={{ fontSize: "16px", color: "var(--navy)", marginBottom: "6px" }}>🪪 KYC Document Verification</h3>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Review and verify member PAN and Aadhaar identity submissions for KYC.</p>
        </Link>
        <Link to="/admin-members" className="card panel" style={{ textDecoration: "none", color: "inherit" }}>
          <h3 style={{ fontSize: "16px", color: "var(--navy)", marginBottom: "6px" }}>👥 Member & Tree Explorer</h3>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Search members, inspect AutoPool / MY SYSTEM tree structures, and check status.</p>
        </Link>
        <Link to="/admin-disputes" className="card panel" style={{ textDecoration: "none", color: "inherit" }}>
          <h3 style={{ fontSize: "16px", color: "var(--navy)", marginBottom: "6px" }}>⚖️ Vendor Violations & Penalties</h3>
          <p style={{ fontSize: "13px", color: "var(--muted)" }}>Manage store fraud penalties (10x transaction value) and security deposit freezes.</p>
        </Link>
      </section>

      {/* AUDIT TRAIL TABLE */}
      <section className="card panel">
        <h2>Recent Audit Trail (नवीनतम प्रशासनिक ऑडिट)</h2>
        <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "12px" }}>
          Immutable before/after logging of all platform setting adjustments and governance operations.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Action</th>
                <th>Entity</th>
                <th>Actor ID</th>
                <th>Change Details / Metadata</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.length > 0 ? (
                auditLogs.map((log, idx) => (
                  <tr key={idx}>
                    <td>{formatDate(log.createdAt)}</td>
                    <td><strong>{log.action}</strong></td>
                    <td>{log.entityType} ({log.entityId})</td>
                    <td>{log.actorId || "System"}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "12px", whiteSpace: "pre-wrap" }}>
                      {log.details || JSON.stringify(log.metadata || {}, null, 2)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", padding: "20px", color: "var(--muted)" }}>
                    No audit logs available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* SETTLEMENT RUN MODAL */}
      {sweepModalOpen && (
        <div className="modal-backdrop open" onClick={() => setSweepModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Execute Settlement Sweep</h3>
            <p style={{ fontSize: "13.5px", color: "var(--muted)", marginBottom: "12px" }}>
              This will lock all pending Vendor sales, apply Section 194C TDS calculations, calculate volume discounts, and sweep balances to vendor wallets.
            </p>

            {sweepAlert && (
              <div className={`note ${sweepAlert.type === "success" ? "success" : "danger"}`}>
                {sweepAlert.text}
              </div>
            )}

            <div className="modal-actions" style={{ display: "grid", gap: "10px" }}>
              <button className="btn btn-navy" onClick={triggerSettlementSweep} disabled={sweeping}>
                {sweeping ? "Sweeping Balances..." : "Execute Sweep ⚡"}
              </button>
              <button className="btn btn-secondary" onClick={() => setSweepModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MANAGE ADMINS MODAL */}
      {usersModalOpen && (
        <div className="modal-backdrop open" onClick={() => setUsersModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ width: "min(600px, 100%)" }}>
            <h3>Admin User Management</h3>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "16px" }}>Create new administrators and manage RBAC role permissions.</p>

            {userAlert && (
              <div className={`note ${userAlert.type === "success" ? "success" : "danger"}`}>
                {userAlert.text}
              </div>
            )}

            {/* CREATE NEW ADMIN FORM */}
            <form onSubmit={handleCreateAdmin} style={{ borderBottom: "1px solid var(--border)", paddingBottom: "16px", marginBottom: "16px" }}>
              <h4 style={{ fontSize: "14px", color: "var(--navy)", marginBottom: "8px" }}>Add New Admin User</h4>
              <div className="field-group">
                <label className="field-label">Full Name *</label>
                <input type="text" placeholder="e.g. Vikram Malhotra" value={newAdminName} onChange={e => setNewAdminName(e.target.value)} required />
              </div>
              <div className="field-group">
                <label className="field-label">Email *</label>
                <input type="email" placeholder="e.g. vikram@bharatiyabazaar.com" value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)} required />
              </div>
              <div className="field-group">
                <label className="field-label">Password *</label>
                <input type="password" placeholder="Min. 6 characters" value={newAdminPassword} onChange={e => setNewAdminPassword(e.target.value)} required />
              </div>
              <div className="field-group">
                <label className="field-label">Role *</label>
                <select value={newAdminRole} onChange={e => setNewAdminRole(e.target.value)}>
                  <option value="ADMIN">ADMIN (Operational Settings, Settlements & Withdrawals)</option>
                  <option value="SUPER_ADMIN">SUPER_ADMIN (Full Governance, TDS & Security)</option>
                </select>
              </div>
              <button type="submit" className="btn-primary" style={{ marginTop: "8px" }}>
                Add Admin User
              </button>
            </form>

            {/* ADMINS LIST */}
            <h4>Administrator List</h4>
            <div style={{ maxHeight: "200px", overflowY: "auto", marginTop: "8px" }}>
              {adminUsers.map((u, idx) => (
                <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "13px" }}>
                  <div>
                    <strong>{u.name}</strong> ({u.email})
                    <br />
                    <span className={`badge ${u.role === "SUPER_ADMIN" ? "super" : "admin"}`}>{u.role}</span>
                  </div>
                  <div>
                    {u.role !== "SUPER_ADMIN" ? (
                      <button className="topbar-btn" style={{ fontSize: "11px", padding: "4px 8px" }} onClick={() => handlePromoteAdmin(u._id || u.id)}>
                        Promote to SUPER_ADMIN
                      </button>
                    ) : (
                      <span style={{ fontSize: "11px", color: "var(--muted)" }}>Full Access</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="modal-actions" style={{ marginTop: "14px" }}>
              <button className="btn btn-secondary" onClick={() => setUsersModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
