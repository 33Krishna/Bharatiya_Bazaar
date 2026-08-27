import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Landmark, Check, X, ShieldAlert, FileSpreadsheet, Eye } from "lucide-react";

export default function AdminPayouts() {
  const { token } = useAuth();
  const [payoutsList, setPayoutsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchPendingPayouts = () => {
    if (!token) return;
    setLoading(true);
    fetch("/api/admin/reports/withdrawals", {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(res => {
        if (res.success && Array.isArray(res.data)) {
          setPayoutsList(res.data);
        }
      })
      .catch(err => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchPendingPayouts();
  }, [token]);

  const handleApprove = async (id: string) => {
    if (!window.confirm("Confirm approval. This will complete wallet debits and lock statutory TDS ledgers.")) return;
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/approve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Withdrawal approved and disbursed successfully." });
        fetchPendingPayouts();
      } else {
        setMessage({ type: "error", text: data.error?.message || "Failed to approve payout request." });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Network error submitting approval." });
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt("Enter rejection reason:");
    if (reason === null) return; // Cancelled prompt
    if (!reason.trim()) {
      alert("Rejection reason is required.");
      return;
    }

    setMessage(null);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: reason.trim() })
      });
      const data = await res.json();
      if (data.success) {
        setMessage({ type: "success", text: "Withdrawal request successfully rejected and funds refunded to member." });
        fetchPendingPayouts();
      } else {
        setMessage({ type: "error", text: data.error?.message || "Failed to reject payout request." });
      }
    } catch (e) {
      setMessage({ type: "error", text: "Network error submitting rejection." });
    }
  };

  if (loading) {
    return <div style={{ color: "var(--text-secondary)" }}>Loading requested payouts queue...</div>;
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title text-gradient">Requested Payouts Queue</h1>
          <p className="text-secondary" style={{ fontSize: "14px", marginTop: "4px" }}>
            Review pending member cashouts, check statutory aggregates, and authorize transfers.
          </p>
        </div>
      </div>

      {message && (
        <div className={`alert-box ${message.type === "error" ? "alert-danger" : "alert-info"}`}>
          <span>{message.text}</span>
        </div>
      )}

      <div className="glass-card">
        {payoutsList.length > 0 ? (
          <div className="table-container">
            <table className="custom-table" style={{ fontSize: "13px" }}>
              <thead>
                <tr>
                  <th>Member Code</th>
                  <th>Card Code</th>
                  <th>Method</th>
                  <th>Gross Amount</th>
                  <th>194R Recov</th>
                  <th>TDS 194H</th>
                  <th>Admin Charge</th>
                  <th>Net Disburse</th>
                  <th>Destination Credentials</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payoutsList.map((p: any) => {
                  let detailsObj: any = {};
                  try {
                    detailsObj = p.paymentDetails ? JSON.parse(p.paymentDetails) : {};
                  } catch (e) {
                    detailsObj = { raw: p.paymentDetails };
                  }

                  return (
                    <tr key={p._id}>
                      <td><strong>{p.memberId?.memberCode}</strong><br /><span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{p.memberId?.name}</span></td>
                      <td>{p.idCardId?.cardNumber}</td>
                      <td>{p.method}</td>
                      <td>₹{(p.grossPaise / 100).toFixed(2)}</td>
                      <td style={{ color: p.recovered194RPaise > 0 ? "var(--error)" : "inherit" }}>₹{(p.recovered194RPaise / 100).toFixed(2)}</td>
                      <td style={{ color: p.tdsPaise > 0 ? "var(--error)" : "inherit" }}>₹{(p.tdsPaise / 100).toFixed(2)}</td>
                      <td style={{ color: p.adminChargePaise > 0 ? "var(--error)" : "inherit" }}>₹{(p.adminChargePaise / 100).toFixed(2)}</td>
                      <td style={{ color: "var(--success)", fontWeight: 700 }}>₹{(p.netPaise / 100).toFixed(2)}</td>
                      <td>
                        {p.method === "BANK" ? (
                          <div style={{ lineHeight: 1.4 }}>
                            <strong>Bank:</strong> {detailsObj.bankName}<br />
                            <strong>A/C:</strong> {detailsObj.accountNumber}<br />
                            <strong>IFSC:</strong> {detailsObj.ifsc}
                          </div>
                        ) : (
                          <div><strong>UPI ID:</strong> {detailsObj.upiId || detailsObj.raw || "—"}</div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "8px" }}>
                          <button
                            onClick={() => handleApprove(p._id)}
                            className="btn btn-secondary"
                            style={{
                              padding: "6px 12px",
                              fontSize: "12px",
                              color: "var(--success)",
                              borderColor: "var(--success-glow)"
                            }}
                          >
                            <Check size={14} /> Approve
                          </button>
                          <button
                            onClick={() => handleReject(p._id)}
                            className="btn btn-secondary"
                            style={{
                              padding: "6px 12px",
                              fontSize: "12px",
                              color: "var(--error)",
                              borderColor: "var(--error-glow)"
                            }}
                          >
                            <X size={14} /> Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "40px" }}>
            <FileSpreadsheet size={48} color="var(--text-muted)" style={{ margin: "0 auto 16px auto", opacity: 0.5 }} />
            <h3 style={{ fontSize: "18px", fontWeight: 800 }}>Payouts Queue Clear</h3>
            <p style={{ color: "var(--text-secondary)", maxWidth: "400px", margin: "8px auto" }}>
              No pending cashout requests are currently awaiting approval.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
