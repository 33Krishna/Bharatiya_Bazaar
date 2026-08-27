import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function AdminKyc() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [pendingKyc, setPendingKyc] = useState<any[]>([]);
  const [remarksMap, setRemarksMap] = useState<Record<string, string>>({});
  const [actioningId, setActioningId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      logout();
      navigate("/login");
      return;
    }
    loadPendingKyc();
  }, [token]);

  const loadPendingKyc = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/kyc/pending", {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());

      if (res.success) {
        setPendingKyc(res.data || []);
      }
    } catch (err) {
      console.error("Error loading pending KYC:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleKycAction = async (memberId: string, action: "approve" | "reject", tier: string) => {
    const remarks = remarksMap[memberId] || "";
    if (action === "reject" && !remarks.trim()) {
      alert("⚠️ Please enter a rejection reason.");
      return;
    }

    setActioningId(memberId);
    try {
      const endpoint = action === "approve" ? "/api/admin/kyc/approve" : "/api/admin/kyc/reject";
      const body = action === "approve" ? { memberId, tier, remarks } : { memberId, remarks };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      }).then(r => r.json());

      if (!res.success) throw new Error(res.error?.message || "Failed to process KYC.");

      alert(`✅ KYC ${action === "approve" ? "Approved" : "Rejected"} successfully!`);
      
      // Clear remarks
      setRemarksMap(prev => {
        const copy = { ...prev };
        delete copy[memberId];
        return copy;
      });

      // Reload
      await loadPendingKyc();
    } catch (err: any) {
      alert(`⚠️ Error: ${err.message}`);
    } finally {
      setActioningId(null);
    }
  };

  const handleRemarksChange = (memberId: string, val: string) => {
    setRemarksMap(prev => ({
      ...prev,
      [memberId]: val
    }));
  };

  if (loading) {
    return <div className="loading">Loading pending KYC audit queue...</div>;
  }

  return (
    <div style={{ width: "100%" }}>
      <section className="page-head">
        <div>
          <h1>KYC Document Verification</h1>
          <p>Review and verify member PAN and identity submissions for Platform Tier status.</p>
        </div>
      </section>

      <div className="pending-stack">
        {pendingKyc.length > 0 ? (
          pendingKyc.map((item) => {
            const avatarChar = (item.name || "M").charAt(0).toUpperCase();
            return (
              <div key={item._id || item.id} className="kyc-card">
                <div className="kc-head">
                  <div className="kc-hl">
                    <div className="kc-avatar">{avatarChar}</div>
                    <div>
                      <div className="kc-name">{item.name}</div>
                      <div className="kc-id">Code: {item.memberCode} | PAN: {item.panNumber || "Not Provided"}</div>
                      <div className="kc-sub">Joined: {new Date(item.createdAt).toLocaleDateString()}</div>
                    </div>
                  </div>
                  <div className="kc-badges">
                    <span className="st-badge st-pending">PENDING AUDIT</span>
                    <span className="st-badge st-normal" style={{ marginTop: "4px" }}>Tier {item.kycTier || 1} Request</span>
                  </div>
                </div>

                <div className="kc-body">
                  <div>
                    <div className="kc-col-title">📄 Document Details</div>
                    <div className="d-row">
                      <span className="k">Full Name</span>
                      <span className="v">{item.name}</span>
                    </div>
                    <div className="d-row">
                      <span className="k">PAN Card Number</span>
                      <span className="v">{item.panNumber || "—"}</span>
                    </div>
                    <div className="d-row">
                      <span className="k">PAN Verification Status</span>
                      <span className="v" style={{ color: item.panVerified ? "var(--success)" : "var(--warning)" }}>
                        {item.panVerified ? "✓ Verified" : "Pending API Check"}
                      </span>
                    </div>
                    <div className="d-row">
                      <span className="k">Email Address</span>
                      <span className="v">{item.email || "—"}</span>
                    </div>
                    <div className="d-row">
                      <span className="k">Mobile Number</span>
                      <span className="v">{item.mobile}</span>
                    </div>
                  </div>

                  <div>
                    <div className="kc-col-title">🖼️ Identity Preview</div>
                    <div className="doc-grid">
                      <div className="doc-tile">
                        <div className="doc-ph">🪪</div>
                        <div className="doc-name">PAN Document</div>
                        <div className="doc-file">{item.panNumber || "Not Uploaded"}</div>
                        <button className="btn-preview" onClick={() => alert(`Reviewing PAN: ${item.panNumber}`)}>Preview</button>
                      </div>
                      <div className="doc-tile">
                        <div className="doc-ph">👤</div>
                        <div className="doc-name">Aadhaar / Passport</div>
                        <div className="doc-file">Aadhaar verification check</div>
                        <button className="btn-preview" onClick={() => alert("Reviewing Aadhaar submission")}>Preview</button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Audit remarks footer bar */}
                <div className="kc-foot">
                  <div className="kc-reason">
                    <input
                      type="text"
                      className="input"
                      placeholder="Enter verification comments or rejection reason..."
                      value={remarksMap[item._id || item.id] || ""}
                      onChange={e => handleRemarksChange(item._id || item.id, e.target.value)}
                    />
                  </div>
                  <div className="kc-actions">
                    <button
                      className="btn-primary"
                      style={{ background: "var(--success)", padding: "10px 18px", width: "auto" }}
                      disabled={actioningId === (item._id || item.id)}
                      onClick={() => handleKycAction(item._id || item.id, "approve", "2")}
                    >
                      Approve Tier 2 ✓
                    </button>
                    <button
                      className="btn-primary"
                      style={{ background: "var(--danger)", padding: "10px 18px", width: "auto" }}
                      disabled={actioningId === (item._id || item.id)}
                      onClick={() => handleKycAction(item._id || item.id, "reject", "1")}
                    >
                      Reject Submission ❌
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <div className="es-ic">🎉</div>
            <p>KYC pending audit queue is completely empty! Great job operations team.</p>
          </div>
        )}
      </div>
    </div>
  );
}
