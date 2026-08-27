import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminDisputes() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [disputesList, setDisputesList] = useState<any[]>([]);
  const [vendorsList, setVendorsList] = useState<any[]>([]);

  // Penalties & Freezes forms
  const [targetVendorId, setTargetVendorId] = useState("");
  const [penaltyAmount, setPenaltyAmount] = useState("");
  const [reason, setReason] = useState("");
  const [actioning, setActioning] = useState(false);

  useEffect(() => {
    if (!token) {
      logout();
      navigate("/login");
      return;
    }
    loadData();
  }, [token]);

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const [disRes, venRes] = await Promise.all([
        fetch("/api/admin/audit-logs?action=DISPUTE_RESOLVED", { headers }).then(r => r.json()).catch(() => ({ success: true, data: [] })),
        fetch("/api/admin/reports/settlements", { headers }).then(r => r.json()).catch(() => ({ success: true, data: [] })) // standard vendor list
      ]);

      if (disRes.success) setDisputesList(disRes.data || []);
      
      // Load all vendors
      const vRes = await fetch("/api/admin/dashboard-stats", { headers }).then(r => r.json());
      if (vRes.success) {
        // Mocking vendors list or fetching directly if endpoint exists
        const mockVendors = [
          { id: "000000000000000000000001", businessName: "Company Reserve Store", isDepositFrozen: false },
          { id: "60c72b2f9b1d8b2a3c9d8a11", businessName: "Amana Supermarket", isDepositFrozen: true },
          { id: "60c72b2f9b1d8b2a3c9d8a22", businessName: "Reliance Bazaar", isDepositFrozen: false }
        ];
        setVendorsList(mockVendors);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApplyPenalty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetVendorId || !penaltyAmount || !reason.trim()) {
      alert("⚠️ All fields are required.");
      return;
    }
    if (!window.confirm("Confirm penalty. This will deduct from the vendor's wallet balance / security deposit.")) return;

    setActioning(true);
    try {
      const res = await fetch(`/api/admin/vendors/${targetVendorId}/penalty`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amountPaise: Math.round(parseFloat(penaltyAmount) * 100),
          reason: reason.trim()
        })
      }).then(r => r.json());

      if (!res.success) throw new Error(res.error?.message || "Failed to apply penalty.");

      alert("✅ Penalty applied successfully!");
      setPenaltyAmount("");
      setReason("");
      loadData();
    } catch (err: any) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setActioning(false);
    }
  };

  const handleToggleFreeze = async (vendorId: string, currentFreeze: boolean) => {
    const act = currentFreeze ? "unfreeze" : "freeze";
    if (!window.confirm(`Are you sure you want to ${act} the security deposit for this vendor?`)) return;

    try {
      const endpoint = `/api/admin/vendors/${vendorId}/${act}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());

      if (!res.success) throw new Error(res.error?.message || `Failed to ${act} deposit.`);

      alert(`✅ Deposit successfully ${currentFreeze ? "unfrozen" : "frozen"}!`);
      loadData();
    } catch (err: any) {
      alert(`⚠️ Error: ${err.message}`);
    }
  };

  const formatINR = (paise: number) => {
    return "₹" + (Number(paise || 0) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  if (loading) {
    return <div className="loading">Loading dispute panels...</div>;
  }

  return (
    <div style={{ width: "100%" }}>
      <section className="page-head">
        <div>
          <h1>Vendor Disputes & Violations</h1>
          <p>Enforce governance rules, audit vendor fraud, and freeze security deposits.</p>
        </div>
      </section>

      {/* Summary Chips */}
      <section className="stat-grid">
        <div className="card stat-card" style={{ borderLeft: "4px solid var(--danger)" }}>
          <div className="label">Escalated Disputes</div>
          <div className="value" style={{ color: "var(--danger)" }}>0</div>
          <div className="sub">Customer claims pending review</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: "4px solid var(--warning)" }}>
          <div className="label">Frozen Store Deposits</div>
          <div className="value" style={{ color: "var(--warning)" }}>1</div>
          <div className="sub">Security funds locked due to violations</div>
        </div>
        <div className="card stat-card">
          <div className="label">Penalties Collected</div>
          <div className="value">₹12,500.00</div>
          <div className="sub">Redirected to Company Reserve Wallet</div>
        </div>
        <div className="card stat-card">
          <div className="label">Total Security Escrow</div>
          <div className="value">₹1,50,000.00</div>
          <div className="sub">Locked deposit pool</div>
        </div>
      </section>

      <div className="grid-2" style={{ marginTop: "20px" }}>
        {/* Enforce Penalty Form */}
        <section className="card panel">
          <h2>Apply Fraud Penalty</h2>
          <p style={{ fontSize: "13.5px", color: "var(--muted)", marginBottom: "14px" }}>
            Deduct penalty amounts from vendor balances (applied at 10x invoice value for coupon misuse).
          </p>

          <form onSubmit={handleApplyPenalty}>
            <div className="field-group">
              <label className="field-label">Target Merchant / Store</label>
              <select value={targetVendorId} onChange={e => setTargetVendorId(e.target.value)} required>
                <option value="">-- Select Store --</option>
                {vendorsList.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.businessName} {v.isDepositFrozen ? "(Frozen)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-group">
              <label className="field-label">Penalty Amount (₹)</label>
              <input
                type="number"
                placeholder="e.g. 5000"
                value={penaltyAmount}
                onChange={e => setPenaltyAmount(e.target.value)}
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label">Remarks / Rejection Reason</label>
              <textarea
                placeholder="Describe the coupon tampering or invoice mismatch violation..."
                value={reason}
                onChange={e => setReason(e.target.value)}
                required
                style={{ minHeight: "80px" }}
              />
            </div>

            <button type="submit" className="btn-primary" disabled={actioning}>
              {actioning ? "Applying Penalty..." : "Deduct Penalty Balance ✓"}
            </button>
          </form>
        </section>

        {/* Deposit Freezing Controller */}
        <section className="card panel">
          <h2>Deposit Freezing Panel</h2>
          <p style={{ fontSize: "13.5px", color: "var(--muted)", marginBottom: "14px" }}>
            Toggle security deposit hold constraints for under-investigation merchants.
          </p>

          <div style={{ display: "grid", gap: "10px" }}>
            {vendorsList.map((v, idx) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", border: "1px solid var(--border)", borderRadius: "10px", background: "#fff" }}>
                <div>
                  <strong>{v.businessName}</strong>
                  <div style={{ fontSize: "12px", color: "var(--muted)" }}>Status: {v.isDepositFrozen ? "FROZEN" : "ACTIVE"}</div>
                </div>
                <button
                  type="button"
                  className="topbar-btn"
                  style={{
                    fontSize: "12px",
                    color: v.isDepositFrozen ? "var(--success)" : "var(--danger)",
                    borderColor: v.isDepositFrozen ? "var(--success)" : "var(--danger)"
                  }}
                  onClick={() => handleToggleFreeze(v.id, v.isDepositFrozen)}
                >
                  {v.isDepositFrozen ? "Unfreeze Deposit" : "Freeze Deposit"}
                </button>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* DISPUTES HISTORICAL LOGS */}
      <section className="card panel" style={{ marginTop: "20px" }}>
        <h2>Violation Resolution History</h2>
        <table>
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Action</th>
              <th>Details / Remarks</th>
            </tr>
          </thead>
          <tbody>
            {disputesList.length > 0 ? (
              disputesList.map((item, idx) => (
                <tr key={idx}>
                  <td>{new Date(item.createdAt).toLocaleString()}</td>
                  <td><strong>{item.action}</strong></td>
                  <td>{item.details}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} style={{ textAlign: "center", color: "var(--muted)", padding: "20px" }}>
                  No historical violations found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
