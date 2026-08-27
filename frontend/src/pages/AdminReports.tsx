import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { FileSpreadsheet, ShieldCheck, Play, Award, Sparkles, AlertCircle, FileText } from "lucide-react";
import confetti from "canvas-confetti";

export default function AdminReports() {
  const { token } = useAuth();
  const [tdsSummary, setTdsSummary] = useState<any>(null);
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Settlement Form State
  const [runDate, setRunDate] = useState(new Date().toISOString().split("T")[0]);
  const [rateOverride, setRateOverride] = useState("");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchReportsData = () => {
    if (!token) return;
    setLoading(true);

    Promise.all([
      fetch("/api/admin/reports/tds-summary", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      fetch("/api/admin/reports/settlements", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
    ])
      .then(([tRes, sRes]) => {
        if (tRes.success) setTdsSummary(tRes.data);
        if (sRes.success && Array.isArray(sRes.data)) setRuns(sRes.data);
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchReportsData();
  }, [token]);

  const handleRunSettlements = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm("Do you wish to execute the weekly Monday settlements sweep? This will write transactions and trigger payouts.")) return;

    setRunning(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/settlements/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          runDate,
          adminRatePctOverride: rateOverride ? parseFloat(rateOverride) : null
        })
      });

      const data = await res.json();
      if (data.success) {
        confetti({
          particleCount: 180,
          spread: 85,
          origin: { y: 0.6 }
        });
        
        const summary = data.data;
        setMessage({
          type: "success",
          text: `Sweep executed! Processed ${summary.totalEntries} vendor payouts. Net Disbursed: ₹${(summary.netPaise / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}.`
        });
        
        setRateOverride("");
        fetchReportsData();
      } else {
        setMessage({ type: "error", text: data.error?.message || "Monday settlements sweep failed." });
      }
    } catch (err) {
      setMessage({ type: "error", text: "Network connection error executing settlements." });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return <div style={{ color: "var(--text-secondary)" }}>Loading compliance report screens...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title text-gradient">Financial Compliance Reports</h1>
          <p className="text-secondary" style={{ fontSize: "14px", marginTop: "4px" }}>
            Execute weekly settlements loops and inspect platform-wide statutory TDS liability aggregates.
          </p>
        </div>
      </div>

      {message && (
        <div className={`alert-box ${message.type === "error" ? "alert-danger" : "alert-info"}`} style={{ marginBottom: "32px" }}>
          <span>{message.text}</span>
        </div>
      )}

      {/* Main Splits grid */}
      <div className="grid-cols-1-3">
        {/* Left Side: TDS matrix & Payout Runs history */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* TDS matrix summary */}
          <div className="glass-card">
            <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <ShieldCheck size={18} color="var(--success)" /> Statutory TDS Compliance Ledger (FY)
            </h3>

            <div className="table-container">
              <table className="custom-table">
                <thead>
                  <tr>
                    <th>Deduction Section</th>
                    <th>Held / Pending</th>
                    <th>Deposited / Cleared</th>
                    <th>Reversed / Cancelled</th>
                    <th>Total Liability</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.keys(tdsSummary || {}).map(sectionKey => {
                    const sec = tdsSummary[sectionKey];
                    return (
                      <tr key={sectionKey}>
                        <td><strong>{sectionKey.replace("SECTION_", "Sec ")}</strong></td>
                        <td style={{ color: "var(--primary)" }}>₹{((sec.HELD || sec.PENDING || 0) / 100).toFixed(2)}</td>
                        <td style={{ color: "var(--success)" }}>₹{((sec.DEPOSITED || 0) / 100).toFixed(2)}</td>
                        <td style={{ color: "var(--text-muted)" }}>₹{((sec.REVERSED || 0) / 100).toFixed(2)}</td>
                        <td style={{ fontWeight: 700 }}>₹{(sec.total / 100).toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Settlements runs */}
          <div className="glass-card">
            <h3 style={{ fontSize: "18px", fontWeight: 800, marginBottom: "20px" }}>
              Completed Settlement Payout Runs
            </h3>

            {runs.length > 0 ? (
              <div className="table-container">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Period Range</th>
                      <th>Merchant</th>
                      <th>Gross Sales</th>
                      <th>TDS 194C</th>
                      <th>Net Disbursed</th>
                      <th>Payout Method</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((r: any) => (
                      <tr key={r._id}>
                        <td>
                          {new Date(r.periodStart).toLocaleDateString()} - {new Date(r.periodEnd).toLocaleDateString()}
                        </td>
                        <td><strong>{r.vendorId?.businessName}</strong></td>
                        <td>₹{(r.grossSalesPaise / 100).toFixed(2)}</td>
                        <td>₹{(r.tdsPaise / 100).toFixed(2)}</td>
                        <td style={{ color: "var(--primary)", fontWeight: 700 }}>₹{(r.netPayablePaise / 100).toFixed(2)}</td>
                        <td>{r.payoutMethod}</td>
                        <td>
                          <span className="status-badge status-active">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)", fontSize: "13px" }}>
                No completed settlement runs logged.
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Settlements Sweep execution box */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <div className="glass-card" style={{ border: "1px solid var(--border-glow-active)" }}>
            <h3 style={{ fontSize: "20px", fontWeight: 800, marginBottom: "20px", display: "flex", alignItems: "center", gap: "8px" }}>
              <Play size={20} color="var(--primary)" /> Settlements Sweep
            </h3>

            <form onSubmit={handleRunSettlements}>
              <div className="form-group">
                <label className="form-label">Settlement Period End Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={runDate}
                  onChange={e => setRunDate(e.target.value)}
                  required
                />
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                  Sweep processes unsettled sales from Monday 00:00 to the Sunday prior to this date.
                </span>
              </div>

              <div className="form-group" style={{ marginBottom: "24px" }}>
                <label className="form-label">Admin Charge Rate Override (%)</label>
                <input
                  type="number"
                  step="0.5"
                  className="form-input"
                  placeholder="Leave blank to use platform defaults (10% Bank / 5% Wallet)"
                  value={rateOverride}
                  onChange={e => setRateOverride(e.target.value)}
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={running}>
                <Sparkles size={16} /> {running ? "Running Settlements Sweep..." : "Execute Monday Sweep"}
              </button>
            </form>

            <div style={{ marginTop: "24px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "16px" }}>
              <h4 style={{ fontSize: "13px", fontWeight: 700, display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                <AlertCircle size={14} color="var(--primary)" /> Sweep Loop Checklist
              </h4>
              <ul style={{ fontSize: "12px", color: "var(--text-secondary)", listStyleType: "circle", paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                <li>Calculates GST & margins for active vendors</li>
                <li>Audits Section 194C thresholds (1% Indiv / 2% Corp / 20% Penalty)</li>
                <li>Deducts admin charges & sweeps inactivity schedules</li>
                <li>Releases PENDING_SETTLEMENT member commissions</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
