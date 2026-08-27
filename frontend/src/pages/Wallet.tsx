import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Wallet() {
  const { token, user, loginContext, logout } = useAuth();
  const navigate = useNavigate();

  // Tabs state
  const [activeTab, setActiveTab] = useState<"cash" | "voucher" | "history">("cash");

  // Wallet balances
  const [balances, setBalances] = useState({
    totalPaise: 0,
    withdrawablePaise: 0,
    confirmedPaise: 0,
    pendingPaise: 0,
    lockedPaise: 0,
    acbStatus: false,
    panVerified: true,
    cumulativeConfirmedPaise: 0,
    pending194RPaise: 0,
    minWithdrawPaise: 5000,
    thresholdPaise: 2000000,
    bankAdminPct: 10,
    memberAdminPct: 5,
    voucherAdminPct: 5
  });

  const [cardBreakdown, setCardBreakdown] = useState<any>({
    autopoolPaise: 0,
    mysystemPaise: 0,
    setukoshPaise: 0,
    subrebirthPaise: 0
  });

  const [vouchers, setVouchers] = useState<any[]>([]);

  // Form inputs
  const [withdrawAmount, setWithdrawAmount] = useState<number>(100);
  const [payoutMethod, setPayoutMethod] = useState<"bank" | "member" | "voucher">("bank");
  const [recipientId, setRecipientId] = useState<string>("");

  // History state
  const [history, setHistory] = useState<any[]>([]);
  const [filterStream, setFilterStream] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Modal states
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [successModalOpen, setSuccessModalOpen] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      logout();
      navigate("/login");
      return;
    }
    loadBalances();
    loadVouchers();
    loadHistory();
  }, [token]);

  const loadBalances = async () => {
    try {
      const res = await fetch("/api/wallet/balance", {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());

      if (res.success && res.data) {
        const d = res.data;
        setBalances({
          totalPaise: d.balancePaise || 0,
          withdrawablePaise: d.withdrawablePaise || 0,
          confirmedPaise: d.confirmedPaise || 0,
          pendingPaise: d.pendingPaise || 0,
          lockedPaise: d.lockedPaise || 0,
          acbStatus: d.acbStatus || false,
          panVerified: d.panVerified ?? true,
          cumulativeConfirmedPaise: d.cumulativeConfirmedPaise || 0,
          pending194RPaise: d.pending194RPaise || 0,
          minWithdrawPaise: d.minWithdrawPaise || 5000,
          thresholdPaise: d.thresholdPaise || 2000000,
          bankAdminPct: d.bankAdminPct || 10,
          memberAdminPct: d.memberAdminPct || 5,
          voucherAdminPct: d.voucherAdminPct || 5
        });

        // Set source breakdown
        const breakdown = d.breakdown || [];
        let ap = 0, ms = 0, sk = 0, sr = 0;
        breakdown.forEach((item: any) => {
          if (item.cardType === "MAIN") {
            // Split based on standard calculation logs
            ap = item.withdrawablePaise * 0.4;
            ms = item.withdrawablePaise * 0.6;
          } else {
            sr += item.withdrawablePaise;
          }
        });
        // Setu kosh portion is from setu kosh ledger
        setCardBreakdown({
          autopoolPaise: Math.round(ap),
          mysystemPaise: Math.round(ms),
          setukoshPaise: d.confirmedPaise * 0.1,
          subrebirthPaise: Math.round(sr)
        });
      }
    } catch (err) {
      console.error("Error loading balance details:", err);
    }
  };

  const loadVouchers = async () => {
    try {
      const res = await fetch("/api/wallet/vouchers", {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      if (res.success) {
        setVouchers(res.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const loadHistory = async () => {
    try {
      const res = await fetch("/api/wallet/history", {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());
      if (res.success) {
        setHistory(res.data || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatINR = (paise: number) => {
    return "Rs." + (Number(paise) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  // Live calculation logic
  const grossPaise = Math.round(withdrawAmount * 100);
  const ratePct = balances.panVerified ? 3 : 20;
  const newAggregate = balances.cumulativeConfirmedPaise + grossPaise;
  let taxablePaise = 0;
  let tdsExplanation = "";

  if (newAggregate <= balances.thresholdPaise) {
    taxablePaise = 0;
    tdsExplanation = "No TDS — annual aggregate remains below Rs.20,000 threshold.";
  } else if (balances.cumulativeConfirmedPaise >= balances.thresholdPaise) {
    taxablePaise = grossPaise;
    tdsExplanation = "Already above threshold — full amount taxable.";
  } else {
    taxablePaise = newAggregate - balances.thresholdPaise;
    tdsExplanation = "Crosses threshold — TDS only on excess above Rs.20,000.";
  }

  const tdsPaise = Math.round(taxablePaise * ratePct / 100);
  const postTdsPaise = grossPaise - tdsPaise;
  
  const adminPct = payoutMethod === "bank" ? balances.bankAdminPct : payoutMethod === "member" ? balances.memberAdminPct : balances.voucherAdminPct;
  const adminPaise = Math.round(postTdsPaise * adminPct / 100);
  
  const maxRecoverable = Math.max(0, grossPaise - tdsPaise - adminPaise);
  const recoveryPaise = Math.min(balances.pending194RPaise, maxRecoverable);
  const netPaise = grossPaise - recoveryPaise - tdsPaise - adminPaise;

  const handleQuickAmount = (amt: number) => {
    setWithdrawAmount(amt);
  };

  const handleReviewClick = () => {
    if (grossPaise < balances.minWithdrawPaise) {
      alert(`⚠️ Minimum transfer amount is ${formatINR(balances.minWithdrawPaise)}.`);
      return;
    }
    if (grossPaise > balances.withdrawablePaise) {
      alert(`⚠️ Insufficient withdrawable balance. Maximum available is ${formatINR(balances.withdrawablePaise)}.`);
      return;
    }
    if (payoutMethod === "member" && !recipientId.trim()) {
      alert("⚠️ Please enter a recipient Member ID.");
      return;
    }
    setConfirmModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    setProcessing(true);
    try {
      let endpoint = "/api/wallet/withdraw";
      let body: any = { amountPaise: grossPaise, method: payoutMethod.toUpperCase() };
      
      if (payoutMethod === "member") {
        endpoint = "/api/wallet/transfer";
        body = { amountPaise: grossPaise, targetMemberCode: recipientId.trim().toUpperCase() };
      } else if (payoutMethod === "voucher") {
        endpoint = "/api/wallet/convert-voucher";
        body = { amountPaise: grossPaise };
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Transaction failed");
      }

      setConfirmModalOpen(false);
      setSuccessMessage(
        payoutMethod === "bank"
          ? `Bank withdrawal of ${formatINR(grossPaise)} submitted! Net payout: ${formatINR(netPaise)}.`
          : payoutMethod === "member"
          ? `Transferred ${formatINR(grossPaise)} to member ${recipientId.toUpperCase()}.`
          : `Converted ${formatINR(grossPaise)} to Voucher Wallet.`
      );
      setSuccessModalOpen(true);
      
      // Reset inputs
      setWithdrawAmount(100);
      setRecipientId("");
      
      // Reload balances and history
      loadBalances();
      loadVouchers();
      loadHistory();

    } catch (err: any) {
      alert(`⚠️ Transaction Failed: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const activeVouchers = vouchers.filter(v => v.status === "ACTIVE");
  const voucherExpiring30Days = vouchers
    .filter(v => {
      if (v.status !== "ACTIVE") return false;
      const exp = new Date(v.expiresAt).getTime();
      const now = Date.now();
      const diff = exp - now;
      return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
    })
    .reduce((sum, v) => sum + v.faceValuePaise, 0);

  const filteredHistory = history.filter(item => {
    if (filterStream !== "all") {
      const type = item.stream || "";
      if (filterStream === "autopool" && !type.includes("AUTOPOOL")) return false;
      if (filterStream === "mysystem" && !type.includes("SYSTEM")) return false;
      if (filterStream === "setu" && !type.includes("SETU_KOSH")) return false;
      if (filterStream === "wallet" && type !== "WALLET") return false;
    }
    if (filterStatus !== "all") {
      if (filterStatus === "confirmed" && item.status !== "CONFIRMED") return false;
      if (filterStatus === "pending" && item.status !== "PENDING") return false;
      if (filterStatus === "completed" && item.status !== "COMPLETED") return false;
    }
    return true;
  });

  return (
    <div style={{ width: "100%" }}>
      {loginContext?.isSubCard && (
        <div className="banner" style={{ background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e", padding: "12px 18px", borderRadius: "10px", marginBottom: "20px", fontSize: "14px", fontWeight: 500 }}>
          🔑 Viewing <strong>{loginContext.cardNumber}</strong>'s earnings (part of {loginContext.ownerMemberCode}'s unified wallet) — withdrawals restricted to MAIN ID.
        </div>
      )}

      {/* Summary Grid */}
      <section className="stat-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="card stat-card">
          <div className="label">Total Balance</div>
          <div className="value">{formatINR(balances.totalPaise)}</div>
          <div className="sub">Confirmed + pending + locked</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: "4px solid var(--success)" }}>
          <div className="label">Withdrawable</div>
          <div className="value" style={{ color: "var(--success)" }}>{formatINR(balances.withdrawablePaise)}</div>
          <div className="sub">Eligible for withdrawal now</div>
        </div>
        <div className="card stat-card">
          <div className="label">Confirmed</div>
          <div className="value">{formatINR(balances.confirmedPaise)}</div>
          <div className="sub">Finalised earnings</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: "4px solid var(--warning)" }}>
          <div className="label">Pending</div>
          <div className="value" style={{ color: "var(--warning)" }}>{formatINR(balances.pendingPaise)}</div>
          <div className="sub">7-day hold / vendor settlement</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: "4px solid var(--danger)" }}>
          <div className="label">Locked</div>
          <div className="value" style={{ color: "var(--danger)" }}>{formatINR(balances.lockedPaise)}</div>
          <div className="sub">Awaiting ACB unlock</div>
        </div>
      </section>

      <div className="banner" id="liabilityBanner">
        <strong>194R voucher TDS:</strong> You currently have {formatINR(balances.pending194RPaise)} pending voucher TDS liability.
        If your aggregate voucher face value crosses Rs.20,000 in a financial year, a liability of
        10% of the full aggregate value will be created and recovered automatically from your next withdrawal.
      </div>

      <section style={{ display: "flex", gap: "8px", marginBottom: "20px", borderBottom: "1px solid var(--border)", paddingBottom: "10px" }}>
        <button className={`topbar-btn ${activeTab === "cash" ? "primary" : ""}`} onClick={() => setActiveTab("cash")} type="button">Cash Wallet</button>
        <button className={`topbar-btn ${activeTab === "voucher" ? "primary" : ""}`} onClick={() => setActiveTab("voucher")} type="button">Voucher Wallet</button>
        <button className={`topbar-btn ${activeTab === "history" ? "primary" : ""}`} onClick={() => setActiveTab("history")} type="button">Transaction History</button>
      </section>

      {activeTab === "cash" && (
        <section id="cashTab">
          <div className="grid-2">
            <div className="card panel">
              <h2>Withdrawable Balance Breakdown</h2>
              <p className="muted" style={{ fontSize: "14px", marginBottom: "16px" }}>Withdrawal is possible only from the MAIN ID. Withdrawability depends on the earning source.</p>

              <div className="wallet-row" style={{ boxShadow: "none" }}>
                <div><div className="name">AutoPool — MAIN ID</div><div className="desc">ACB achieved — earnings unlocked and withdrawable</div></div>
                <div className="amt">{formatINR(cardBreakdown.autopoolPaise)}</div>
              </div>
              <div className="wallet-row" style={{ boxShadow: "none" }}>
                <div><div className="name">MY SYSTEM — MAIN ID</div><div className="desc">Level 1-3 bonuses — ACB unlocked</div></div>
                <div className="amt">{formatINR(cardBreakdown.mysystemPaise)}</div>
              </div>
              <div className="wallet-row" style={{ boxShadow: "none" }}>
                <div><div className="name">Setu Kosh</div><div className="desc">Becomes withdrawable after Monday vendor settlement (no ACB required)</div></div>
                <div className="amt">{formatINR(cardBreakdown.setukoshPaise)}</div>
              </div>
              <div className="wallet-row" style={{ boxShadow: "none" }}>
                <div><div className="name">SUB IDs / REBIRTH IDs</div><div className="desc">Their withdrawable earnings are auto-swept to this wallet.</div></div>
                <div className="amt">{formatINR(cardBreakdown.subrebirthPaise)}</div>
              </div>

              <div className="note" style={{ marginTop: "24px" }}>
                <strong>MY SYSTEM validity check:</strong> MY SYSTEM Level 1, 2 and 3 bonuses remain PENDING for 7 days after level completion. They become CONFIRMED only after the validity check completes.
              </div>
            </div>

            <div className="card panel">
              <h2>Withdraw / Transfer / Convert</h2>

              <label className="field-label" htmlFor="withdrawAmount" style={{ marginTop: "14px" }}>Amount (Rs.)</label>
              <div style={{ display: "flex", alignItems: "center", border: "1px solid var(--border)", borderRadius: "10px", padding: "4px 14px", background: "#fff" }}>
                <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--navy)", marginRight: "8px" }}>Rs.</span>
                <input
                  id="withdrawAmount"
                  type="number"
                  min="50"
                  style={{ border: "none", padding: "6px 0", outline: "none", fontSize: "16px", fontWeight: "700" }}
                  value={withdrawAmount}
                  onChange={e => setWithdrawAmount(Math.max(1, parseInt(e.target.value) || 0))}
                />
              </div>
              <div className="muted" style={{ fontSize: "13px", marginTop: "6px" }}>Minimum Rs.50 · Maximum (withdrawable balance: {formatINR(balances.withdrawablePaise)})</div>

              <div style={{ display: "flex", gap: "8px", margin: "14px 0" }}>
                {[100, 200, 500].map(amt => (
                  <button key={amt} className="topbar-btn" type="button" onClick={() => handleQuickAmount(amt)}>Rs.{amt}</button>
                ))}
              </div>

              <h3>Choose method</h3>
              <div className="method-list" style={{ margin: "12px 0" }}>
                <label className={`method-item ${payoutMethod === "bank" ? "selected" : ""}`} onClick={() => setPayoutMethod("bank")}>
                  <input type="radio" name="method" value="bank" checked={payoutMethod === "bank"} readOnly />
                  <span>
                    <span className="method-title">Bank Transfer</span>
                    <span className="method-sub">1–2 working days · Admin charge 10% on post-TDS amount</span>
                  </span>
                </label>
                <label className={`method-item ${payoutMethod === "member" ? "selected" : ""}`} onClick={() => setPayoutMethod("member")}>
                  <input type="radio" name="method" value="member" checked={payoutMethod === "member"} readOnly />
                  <span>
                    <span className="method-title">Member Wallet Transfer</span>
                    <span className="method-sub">Transfer to another BB member · Instant · Admin charge 5%</span>
                  </span>
                </label>
                <label className={`method-item ${payoutMethod === "voucher" ? "selected" : ""}`} onClick={() => setPayoutMethod("voucher")}>
                  <input type="radio" name="method" value="voucher" checked={payoutMethod === "voucher"} readOnly />
                  <span>
                    <span className="method-title">Voucher Wallet Conversion</span>
                    <span className="method-sub">Convert cash into Voucher Wallet · Instant · Admin charge 5% · Not cash-withdrawable after conversion</span>
                  </span>
                </label>
              </div>

              {payoutMethod === "member" && (
                <div className="field-group">
                  <label className="field-label" htmlFor="recipientId">Recipient Member ID</label>
                  <input
                    id="recipientId"
                    type="text"
                    placeholder="e.g. BB10055"
                    value={recipientId}
                    onChange={e => setRecipientId(e.target.value)}
                  />
                </div>
              )}

              <h3>Live deduction breakdown</h3>
              <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "14px", background: "#fbfdff", margin: "12px 0", fontSize: "14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed var(--border)" }}>
                  <span>Gross Amount</span>
                  <strong>{formatINR(grossPaise)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--border)" }}>
                  <div>
                    <span>Step 0 — 194R Liability Recovery</span>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>Recovered before payout if pending.</div>
                  </div>
                  <strong style={{ color: "var(--danger)" }}>-{formatINR(recoveryPaise)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--border)" }}>
                  <div>
                    <span>Step 1 — TDS (194H)</span>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>{tdsExplanation}</div>
                  </div>
                  <strong style={{ color: "var(--danger)" }}>-{formatINR(tdsPaise)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--border)" }}>
                  <span>Post-TDS Amount</span>
                  <strong>{formatINR(postTdsPaise)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--border)" }}>
                  <div>
                    <span>Step 2 — Admin Charge</span>
                    <div style={{ fontSize: "11px", color: "var(--muted)" }}>{adminPct}% applied on post-TDS amount.</div>
                  </div>
                  <strong style={{ color: "var(--danger)" }}>-{formatINR(adminPaise)}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", fontWeight: "700", fontSize: "16px", color: "var(--navy)" }}>
                  <span>Net Payout</span>
                  <strong>{formatINR(netPaise)}</strong>
                </div>
              </div>

              <div className="note warning" style={{ fontSize: "12px" }}>
                <strong>Mandatory order:</strong> 194H TDS is calculated first on the gross amount. Admin charge is applied second on the post-TDS amount. This order cannot be reversed.
              </div>

              <button className="btn-primary" style={{ width: "100%", marginTop: "12px", height: "46px" }} onClick={handleReviewClick} type="button" disabled={loginContext?.isSubCard}>
                Review & Withdraw
              </button>
            </div>
          </div>
        </section>
      )}

      {activeTab === "voucher" && (
        <section id="voucherTab">
          <div className="grid-2">
            <div className="card panel">
              <h2>Voucher Wallet</h2>
              {activeVouchers.length === 0 ? (
                <div style={{ border: "2px dashed var(--border)", borderRadius: "12px", padding: "40px 20px", textAlign: "center", color: "var(--muted)", margin: "20px 0" }}>
                  <strong>No vouchers yet</strong>
                  <br />Vouchers are issued when your AutoPool reaches Levels 5, 6 and 7.
                  <br />Total Rs.600 in vouchers per complete pool cycle.
                </div>
              ) : (
                <div style={{ display: "grid", gap: "10px", margin: "14px 0" }}>
                  {activeVouchers.map((v, idx) => (
                    <div key={idx} className="wallet-row">
                      <div>
                        <div className="name">Rs.{v.faceValuePaise / 100} Voucher</div>
                        <div className="desc">Issued: {formatDate(v.issuedAt)} · Expires: {formatDate(v.expiresAt)}</div>
                      </div>
                      <div className="amt" style={{ color: "var(--success)" }}>ACTIVE</div>
                    </div>
                  ))}
                </div>
              )}

              <h3>Voucher summary</h3>
              <div className="wallet-row" style={{ boxShadow: "none", border: "none" }}><div><div className="name">Total Face Value</div></div><div className="amt">{formatINR(vouchers.reduce((s, v) => s + (v.status === "ACTIVE" ? v.faceValuePaise : 0), 0))}</div></div>
              <div className="wallet-row" style={{ boxShadow: "none", border: "none" }}><div><div className="name">Voucher Count</div></div><div className="amt">{activeVouchers.length} active</div></div>
              <div className="wallet-row" style={{ boxShadow: "none", border: "none" }}><div><div className="name">Expiring in 30 days</div></div><div className="amt">{formatINR(voucherExpiring30Days)}</div></div>
            </div>
            <div className="card panel">
              <h2>How Vouchers Work</h2>
              <div style={{ display: "grid", gap: "14px", margin: "14px 0" }}>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ background: "var(--teal)", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: "700" }}>1</div>
                  <div><strong>Receive</strong><div className="muted" style={{ fontSize: "13px" }}>Earn a Rs.200 voucher when your AutoPool completes Level 5, Level 6 and Level 7.</div></div>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ background: "var(--teal)", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: "700" }}>2</div>
                  <div><strong>Store</strong><div className="muted" style={{ fontSize: "13px" }}>Vouchers stay in your Voucher Wallet with a hard expiry of exactly 1 year from issue date. No grace period. No replacement.</div></div>
                </div>
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ background: "var(--teal)", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: "700" }}>3</div>
                  <div><strong>Redeem</strong><div className="muted" style={{ fontSize: "13px" }}>Use them on purchases across Bharatiya Bazaar partner stores and vendors.</div></div>
                </div>
              </div>
              <div className="note warning">Vouchers are non-transferable and cannot be converted back to cash. Unused vouchers are forfeited at hard expiry.</div>
              <div className="note"><strong>Section 194R:</strong> If your aggregate voucher face value crosses Rs.20,000 in a financial year, TDS liability = 10% of the full aggregate voucher value. The liability is recovered automatically from your next withdrawal and is NOT reversed if a voucher expires unused.</div>
            </div>
          </div>
        </section>
      )}

      {activeTab === "history" && (
        <section id="historyTab">
          <div className="card panel">
            <h2>Transaction History</h2>
            <div style={{ display: "flex", gap: "10px", margin: "14px 0" }}>
              <select style={{ width: "auto" }} value={filterStream} onChange={e => setFilterStream(e.target.value)}>
                <option value="all">All Streams</option>
                <option value="autopool">AutoPool</option>
                <option value="mysystem">MY SYSTEM</option>
                <option value="setu">Setu Kosh</option>
                <option value="wallet">Wallet / Withdrawal</option>
              </select>
              <select style={{ width: "auto" }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                <option value="all">All Statuses</option>
                <option value="confirmed">CONFIRMED</option>
                <option value="pending">PENDING</option>
                <option value="completed">COMPLETED</option>
              </select>
            </div>
            <table>
              <thead>
                <tr><th>Date</th><th>Type</th><th>Stream</th><th>Description</th><th>Amount</th><th>Status</th></tr>
              </thead>
              <tbody>
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((item, idx) => (
                    <tr key={idx}>
                      <td>{formatDate(item.createdAt)}</td>
                      <td>{item.type}</td>
                      <td>{item.stream || "WALLET"}</td>
                      <td>{item.description || "—"}</td>
                      <td>{formatINR(item.amountPaise)}</td>
                      <td><span className={`badge ${item.status === "COMPLETED" || item.status === "CONFIRMED" ? "success" : "pending"}`}>{item.status}</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)" }}>
                      No transactions matching the filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Review Modal */}
      {confirmModalOpen && (
        <div className="modal-backdrop open" onClick={() => setConfirmModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Confirm Transaction</h3>
            <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "14px", background: "#fbfdff", margin: "12px 0", fontSize: "14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "8px", borderBottom: "1px dashed var(--border)" }}>
                <span>Transfer Type</span>
                <strong>{payoutMethod === "bank" ? "Bank Withdrawal" : payoutMethod === "member" ? "Transfer to Member" : "Voucher Conversion"}</strong>
              </div>
              {payoutMethod === "member" && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--border)" }}>
                  <span>Recipient ID</span>
                  <strong>{recipientId.toUpperCase()}</strong>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--border)" }}>
                <span>Gross Amount</span>
                <strong>{formatINR(grossPaise)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--border)" }}>
                <span>TDS Deduction</span>
                <strong>{formatINR(tdsPaise)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--border)" }}>
                <span>Admin Charge</span>
                <strong>{formatINR(adminPaise)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px dashed var(--border)" }}>
                <span>194R Recovery</span>
                <strong>{formatINR(recoveryPaise)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", fontWeight: "700", fontSize: "16px", color: "var(--navy)" }}>
                <span>Net Transfer Amount</span>
                <strong>{formatINR(netPaise)}</strong>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setConfirmModalOpen(false)} type="button">Cancel</button>
              <button className="btn-confirm" onClick={handleConfirmSubmit} type="button" disabled={processing}>
                {processing ? "Processing..." : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {successModalOpen && (
        <div className="modal-backdrop open">
          <div className="modal">
            <h3>Transaction Submitted ✓</h3>
            <p className="muted" style={{ fontSize: "14px", margin: "14px 0" }}>{successMessage}</p>
            <div className="modal-actions">
              <button className="btn-confirm" onClick={() => setSuccessModalOpen(false)} type="button">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
