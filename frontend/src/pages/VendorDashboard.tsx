import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function VendorDashboard() {
  const { token, logout, user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [vendorData, setVendorData] = useState<any>(null);

  // Form states
  const [buyerCode, setBuyerCode] = useState("");
  const [saleAmount, setSaleAmount] = useState("");
  
  // Live calculation previews
  const [previewMargin, setPreviewMargin] = useState(0);
  const [previewNet, setPreviewNet] = useState(0);

  // Post sale buyer progress states
  const [buyerProgress, setBuyerProgress] = useState<any>(null);
  const [showBuyerDetails, setShowBuyerDetails] = useState(false);

  // Messages
  const [message, setMessage] = useState<{ text: string; type: "success" | "danger" } | null>(null);
  const [recording, setRecording] = useState(false);

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
      const res = await fetch("/api/vendors/me", { headers }).then(r => r.json());
      if (res.success && res.data) {
        setVendorData(res.data);
      }
    } catch (err) {
      console.error("Error loading vendor details:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleAmountChange = (val: string) => {
    setSaleAmount(val);
    const amt = parseFloat(val) || 0;
    const marginRate = vendorData?.marginRatePct || 10;
    const margin = amt * (marginRate / 100);
    const net = amt - margin;
    setPreviewMargin(margin);
    setPreviewNet(net);
  };

  const handleRecordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setRecording(true);

    const amt = parseFloat(saleAmount) || 0;
    const amountPaise = Math.round(amt * 100);

    try {
      const res = await fetch("/api/vendors/sales", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          buyerCode: buyerCode.trim().toUpperCase(),
          amountPaise
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Failed to record sale");
      }

      // Success
      setMessage({
        text: `Sale recorded successfully! Net credit of ${formatINR(amountPaise - (amountPaise * (vendorData?.marginRatePct || 10) / 100))} added to settlements.`,
        type: "success"
      });

      // Show buyer progress details from response
      if (data.data && data.data.buyerCounter) {
        setBuyerProgress(data.data.buyerCounter);
        setShowBuyerDetails(true);
      }

      // Clear fields
      setBuyerCode("");
      setSaleAmount("");
      setPreviewMargin(0);
      setPreviewNet(0);

      // Reload vendor metrics
      loadData();

    } catch (err: any) {
      setMessage({
        text: err.message || "Failed to submit purchase.",
        type: "danger"
      });
    } finally {
      setRecording(false);
    }
  };

  const formatINR = (paise: number) => {
    return "₹" + (Number(paise || 0) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  if (loading) {
    return <div className="loading">Loading vendor portal...</div>;
  }

  const marginRate = vendorData?.marginRatePct || 0;
  const walletBalance = vendorData?.walletBalancePaise || 0;
  const deposit = vendorData?.securityDepositPaise || 0;
  const status = vendorData?.status || "PROVISIONAL";

  return (
    <div style={{ width: "100%" }}>
      <section className="page-head">
        <div>
          <h1>{vendorData?.businessName || "Vendor Store"}</h1>
          <p>Vendor ID: {vendorData?.memberId || "—"} · Status: {status}</p>
        </div>
      </section>

      {/* Summary grid */}
      <section className="stat-grid">
        <div className="card stat-card">
          <div className="label">Vendor Status (स्थिति)</div>
          <div className="value">
            <span className={`badge ${status === "ACTIVE" || status === "VERIFIED" ? "success" : "warning"}`}>
              {status}
            </span>
          </div>
          <div className="sub">Category: {vendorData?.category || "GENERAL"}</div>
        </div>

        <div className="card stat-card">
          <div className="label">Wallet Balance (वॉलेट शेष)</div>
          <div className="value">{formatINR(walletBalance)}</div>
          <div className="sub">Cleared payouts available</div>
        </div>

        <div className="card stat-card">
          <div className="label">Category Margin Rate (मार्जिन दर)</div>
          <div className="value">{marginRate.toFixed(1)}%</div>
          <div className="sub">Auto-deducted for Setu Kosh</div>
        </div>

        <div className="card stat-card">
          <div className="label">Security Deposit (सुरक्षा जमा)</div>
          <div className="value">{formatINR(deposit)}</div>
          <div className="sub">Admin-Confirmed · Active</div>
        </div>
      </section>

      <div className="grid-2">
        {/* Record sale panel */}
        <section className="card panel">
          <h2>Record Member Purchase (बिक्री दर्ज करें)</h2>
          <p style={{ fontSize: "13.5px", color: "var(--muted)", marginBottom: "14px" }}>
            Scan buyer ID or enter member details to fund Setu Kosh tree and credit your store.
          </p>

          {message && (
            <div className={`note ${message.type === "success" ? "success" : "danger"}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={handleRecordSubmit}>
            <div className="field-group">
              <label className="field-label" htmlFor="buyerCode">
                Buyer ID / Member Code / Card Number <span className="hindi">(खरीदार का कार्ड / कोड)</span> *
              </label>
              <input
                type="text"
                id="buyerCode"
                placeholder="e.g. F10001, M10012, or 9876543210"
                value={buyerCode}
                onChange={e => setBuyerCode(e.target.value)}
                required
              />
            </div>

            <div className="field-group">
              <label className="field-label" htmlFor="saleAmount">
                Total Bill Amount (₹) <span className="hindi">(कुल बिल राशि)</span> *
              </label>
              <input
                type="number"
                id="saleAmount"
                placeholder="e.g. 1000"
                min="1"
                step="any"
                value={saleAmount}
                onChange={e => handleAmountChange(e.target.value)}
                required
              />
            </div>

            <div className="preview-box">
              <div className="preview-row">
                <span>Gross Bill Amount:</span>
                <strong>₹{(parseFloat(saleAmount) || 0).toFixed(2)}</strong>
              </div>
              <div className="preview-row">
                <span>Category Margin Deduction ({marginRate}%):</span>
                <strong style={{ color: "var(--warning)" }}>-₹{previewMargin.toFixed(2)}</strong>
              </div>
              <div className="preview-row">
                <span>Store Net Credited in Settlement:</span>
                <strong style={{ color: "var(--success)" }}>₹{previewNet.toFixed(2)}</strong>
              </div>
            </div>

            <button type="submit" className="btn-primary" disabled={recording}>
              {recording ? "Recording..." : "Record Sale & Credit Setu Kosh ✓"}
            </button>
          </form>
        </section>

        {/* Setu kosh progress bar */}
        <section className="card panel">
          <h2>Setu Kosh Buyer Progress (सेतु कोष प्रगति)</h2>
          <p style={{ fontSize: "13.5px", color: "var(--muted)", marginBottom: "14px" }}>
            Live status of buyer's accumulation towards the ₹1,000 threshold for automatic Setu Kosh node placement.
          </p>

          {!showBuyerDetails ? (
            <div className="note info">
              Record a purchase on the left to see the buyer's real-time Setu Kosh counter accumulation and generated node positions.
            </div>
          ) : (
            <div className="preview-box">
              <div className="preview-row">
                <span>Buyer Member / Card:</span>
                <strong>{buyerProgress?.memberCode || "—"}</strong>
              </div>
              <div className="preview-row">
                <span>Accumulated Balance:</span>
                <strong>{formatINR(buyerProgress?.counterPaise || 0)} / ₹1,000.00</strong>
              </div>
              <div className="progress-bar-wrap">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${Math.min(100, Math.floor(((buyerProgress?.counterPaise || 0) * 100) / 100000))}%` }}
                ></div>
              </div>
              <div className="preview-row">
                <span>Setu Kosh Nodes Created:</span>
                <strong style={{ color: "var(--teal)" }}>{buyerProgress?.idsCreated || 0} Nodes</strong>
              </div>
              <div className="preview-row">
                <span>Referred Vendor Sponsor:</span>
                <strong style={{ color: "var(--navy)" }}>{buyerProgress?.referrerName || "Bound Permanently"}</strong>
              </div>
            </div>
          )}

          {/* Settlement link */}
          <div style={{ marginTop: "20px", padding: "14px", border: "1px solid var(--border)", borderRadius: "10px", background: "#fff" }}>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--navy)", marginBottom: "4px" }}>Weekly Settlement & Payouts</div>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginBottom: "10px" }}>
              Settlements run every Monday at 00:00 UTC with automated Section 194C TDS and volume discount calculations.
            </p>
            <Link to="/vendor-settlements" className="nav-btn" style={{ display: "inline-block", textDecoration: "none" }}>
              View Settlement History & Request Early Payout →
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
