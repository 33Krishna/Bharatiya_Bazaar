import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";

export default function Commissions() {
  const { token, loginContext, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [filterStream, setFilterStream] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    if (!token) {
      logout();
      navigate("/login");
      return;
    }

    const loadData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [profileRes, commsRes] = await Promise.all([
          fetch("/api/members/profile", { headers }).then(r => r.json()),
          fetch("/api/wallet/commissions?limit=200", { headers }).then(r => r.json())
        ]);

        if (profileRes.success) setProfile(profileRes.data);
        if (commsRes.success) setCommissions(commsRes.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  const formatINR = (paise: number) => {
    return "Rs." + (Number(paise) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  if (loading) {
    return <div className="loading">Loading commissions...</div>;
  }

  const activeCard = loginContext?.cardNumber || profile?.memberCode || "";
  const isSub = loginContext?.isSubCard || false;
  const ownerCode = loginContext?.ownerMemberCode || profile?.memberCode || "";

  // Summary figures
  const total = commissions.reduce((s, c) => s + c.amountPaise, 0);
  const confirmed = commissions.filter(c => ["CONFIRMED", "WITHDRAWABLE"].includes(c.status)).reduce((s, c) => s + c.amountPaise, 0);
  const pending = commissions.filter(c => ["PENDING", "PENDING_7_DAY", "LOCKED_ACB"].includes(c.status)).reduce((s, c) => s + c.amountPaise, 0);
  const setuKosh = commissions.filter(c => c.stream === "SETU_KOSH").reduce((s, c) => s + c.amountPaise, 0);

  // Status mapping
  const STATUS_GROUPS: any = {
    confirmed: ["CONFIRMED", "WITHDRAWABLE"],
    pending: ["PENDING_7_DAY", "LOCKED_ACB"],
    blocked: ["PAY_ONCE_BLOCKED"]
  };

  const STATUS_LABEL: any = {
    CONFIRMED: "CONFIRMED ✓",
    WITHDRAWABLE: "CONFIRMED ✓",
    PENDING_7_DAY: "PENDING (7-DAY)",
    LOCKED_ACB: "LOCKED (ACB)",
    PAY_ONCE_BLOCKED: "PAY-ONCE BLOCKED"
  };

  const badgeFor = (status: string) => {
    if (["CONFIRMED", "WITHDRAWABLE"].includes(status)) return "success";
    if (status === "PAY_ONCE_BLOCKED") return "blocked";
    if (status === "LOCKED_ACB") return "danger";
    return "pending";
  };

  const filteredComms = commissions.filter(c => {
    if (filterStream !== "all" && c.stream !== filterStream) return false;
    if (filterStatus !== "all") {
      const group = STATUS_GROUPS[filterStatus] || [filterStatus];
      if (!group.includes(c.status)) return false;
    }
    return true;
  });

  return (
    <div style={{ width: "100%" }}>
      <div className="page-head">
        <h1 id="pageHeaderTitle">{isSub ? `Commissions (${activeCard})` : "Commissions"}</h1>
        <p id="pageHeaderSub">{isSub ? `Earning streams for ${activeCard} (owner ${ownerCode})` : "Overview of all your cooperative income streams."}</p>
      </div>

      {/* Summary Row */}
      <section className="stat-grid">
        <div className="card stat-card">
          <div className="label">Total Earned</div>
          <div className="value" id="totalEarned">{formatINR(total)}</div>
          <div className="sub">All time earnings</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: "4px solid var(--success)" }}>
          <div className="label">Confirmed</div>
          <div className="value" style={{ color: "var(--success)" }} id="confirmedEarned">{formatINR(confirmed)}</div>
          <div className="sub">Cleared for withdrawal</div>
        </div>
        <div className="card stat-card" style={{ borderLeft: "4px solid var(--warning)" }}>
          <div className="label">Pending Hold</div>
          <div className="value" style={{ color: "var(--warning)" }} id="pendingEarned">{formatINR(pending)}</div>
          <div className="sub">Locked / 7-Day Hold</div>
        </div>
        <div className="card stat-card">
          <div className="label">Vouchers Earned</div>
          <div className="value" id="voucherEarned">Rs.0.00</div>
          <div className="sub">AutoPool Level 5-7 rewards</div>
        </div>
      </section>

      {/* Main Table Panel */}
      <div className="card panel">
        <h2>Income Statement</h2>
        <div style={{ display: "flex", gap: "10px", margin: "14px 0" }}>
          <select style={{ width: "auto" }} value={filterStream} onChange={e => setFilterStream(e.target.value)} id="filterStream">
            <option value="all">All Streams</option>
            <option value="AUTOPOOL">AutoPool</option>
            <option value="MY_SYSTEM">MY SYSTEM</option>
            <option value="SETU_KOSH">Setu Kosh</option>
          </select>
          <select style={{ width: "auto" }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)} id="filterStatus">
            <option value="all">All Statuses</option>
            <option value="confirmed">CONFIRMED (incl. Withdrawable)</option>
            <option value="pending">PENDING (7-Day / Locked)</option>
            <option value="blocked">PAY-ONCE BLOCKED</option>
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr><th>Date</th><th>Stream</th><th>Level</th><th>Description</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody id="commissionTableBody">
              {filteredComms.length > 0 ? (
                filteredComms.map((c, idx) => (
                  <tr key={idx}>
                    <td>{formatDate(c.createdAt)}</td>
                    <td>{c.stream}</td>
                    <td>Level {c.level || "—"}</td>
                    <td>{c.description || `${c.stream} commission`}</td>
                    <td>+{formatINR(c.amountPaise)}</td>
                    <td><span className={`badge ${badgeFor(c.status)}`}>{STATUS_LABEL[c.status] || c.status}</span></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--muted)", padding: "32px" }}>
                    No commissions generated for this ID yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* AutoPool stream metrics card */}
      <div className="card panel" style={{ marginTop: "20px" }}>
        <h3>Anant Samriddhi Chakra</h3>
        <p className="muted" style={{ fontSize: "13px", marginBottom: "14px" }}>Company AutoPool · 8-level global binary pool · Stream 1</p>
        <table>
          <thead>
            <tr><th>Level</th><th>Trigger</th><th>Cash</th><th>Status</th><th>Notes</th></tr>
          </thead>
          <tbody>
            <tr><td>L0</td><td>Root</td><td>—</td><td><span className="badge success">ACTIVE</span></td><td>Your position in global pool</td></tr>
            <tr><td>L1</td><td>2 IDs</td><td>Rs.300</td><td><span className="badge info">FILLING</span></td><td>Pay-Once via AutoPool</td></tr>
            <tr><td>L2</td><td>4 IDs</td><td>Rs.300</td><td><span className="badge info">FILLING</span></td><td>Cash bonus</td></tr>
            <tr><td>L3</td><td>8 IDs</td><td>Rs.200</td><td><span className="badge info">FILLING</span></td><td>Cash bonus</td></tr>
            <tr><td>L4</td><td>16 IDs</td><td>—</td><td><span className="badge info">LOCKED</span></td><td>Rebirth ID on completion</td></tr>
            <tr><td>L5</td><td>32 IDs</td><td>—</td><td><span className="badge info">LOCKED</span></td><td>Rebirth + Rs.200 voucher</td></tr>
            <tr><td>L6</td><td>64 IDs</td><td>—</td><td><span className="badge info">LOCKED</span></td><td>Rebirth + Rs.200 voucher</td></tr>
            <tr><td>L7</td><td>128 IDs</td><td>—</td><td><span className="badge info">LOCKED</span></td><td>Rebirth + Rs.200 voucher</td></tr>
          </tbody>
        </table>
        <div className="note" style={{ marginTop: "14px" }}>
          <strong>Rebirth ID earnings:</strong> Rebirth IDs generate the same AutoPool economics as purchased IDs,
          but do NOT get MY SYSTEM or ACB status. Rebirth ID earnings become withdrawable only when the owner's
          MAIN ID achieves ACB status.
        </div>
      </div>

      {/* MY SYSTEM stream metrics card */}
      <div className="card panel" style={{ marginTop: "20px" }}>
        <h3>MY SYSTEM</h3>
        <p className="muted" style={{ fontSize: "13px", marginBottom: "14px" }}>Your binary referral tree · Levels 1–3 pay cash · Stream 2</p>
        <table>
          <thead>
            <tr><th>Level</th><th>Members</th><th>Cash</th><th>Status</th><th>Notes</th></tr>
          </thead>
          <tbody>
            <tr><td>L1</td><td>2 (1L + 1R)</td><td>Rs.300</td><td><span className="badge success">ACB UNLOCK</span></td><td>Pay-Once applies</td></tr>
            <tr><td>L2</td><td>4</td><td>Rs.300</td><td><span className="badge info">PENDING</span></td><td>7-day hold after completion</td></tr>
            <tr><td>L3</td><td>8</td><td>Rs.200</td><td><span className="badge info">LOCKED</span></td><td>7-day hold after completion</td></tr>
            <tr><td>L4–L7</td><td>—</td><td>—</td><td><span className="badge danger">INACTIVE</span></td><td>MY SYSTEM ends at L3</td></tr>
          </tbody>
        </table>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px", marginTop: "14px" }}>
          <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "14px", background: "#f8fafc" }}>
            <h4>Pay-Once Rule</h4>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "6px" }}>
              Level 1 cash (Rs.300) is paid only ONCE per ID across AutoPool and MY SYSTEM combined.
              If AutoPool paid it first, MY SYSTEM will NOT pay it again when Level 1 completes.
            </p>
          </div>
          <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "14px", background: "#f8fafc" }}>
            <h4>ACB Unlock Event</h4>
            <p style={{ fontSize: "13px", color: "var(--muted)", marginTop: "6px" }}>
              Completing MY SYSTEM Level 1 (1 LEFT + 1 RIGHT direct referral) triggers ACB status unlock.
            </p>
            <ul style={{ fontSize: "12px", color: "var(--muted)", paddingLeft: "14px", marginTop: "6px" }}>
              <li>1. ACB status unlocked ✓</li>
              <li>2. All locked AutoPool earnings become withdrawable ✓</li>
              <li>3. Rebirth ID earnings become withdrawable ✓</li>
            </ul>
          </div>
        </div>

        <div className="note warning" style={{ marginTop: "14px" }}>
          <strong>7-Day Validity Hold:</strong> MY SYSTEM Level 1, 2 and 3 commissions remain PENDING for 7 days
          after level completion. They become CONFIRMED only after the validity check completes. During this
          period, commissions may be reversed if fraud, dispute, or invalid referral is detected.
        </div>
      </div>

      {/* Setu Kosh stream metrics card */}
      <div className="card panel" style={{ marginTop: "20px" }}>
        <h3>Setu Kosh</h3>
        <p className="muted" style={{ fontSize: "13px", marginBottom: "14px" }}>Shopping commissions from your referral network · Stream 3</p>
        <div className="grid-2">
          <div>
            <h3>Commission Formula</h3>
            <div className="note info" style={{ fontSize: "13px" }}>
              <strong>Base level rate</strong> = vendor margin × 0.071428
              <br /><br />
              <strong>Level structure:</strong>
              <br />L1, L2, L3 = full rate
              <br />L4 = half rate
              <br />L5, L6 = full rate
              <br />L7 = half rate
              <br />L8, L9, L10 = full rate
              <br /><br />
              <strong>Referral bonus</strong> = 0.25% of purchase amount
              <br /><strong>Cap:</strong> Total payout cannot exceed vendor margin from that purchase.
            </div>
            <div className="note" style={{ marginTop: "12px" }}>
              <strong>Settlement:</strong> Setu Kosh commissions are PENDING until Monday vendor settlement,
              then become CONFIRMED. No ACB required for withdrawal of Setu Kosh earnings.
            </div>
          </div>
          <div>
            <h3>Shopping Summary</h3>
            <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", background: "#fbfdff", marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Total Shopping (this cycle)</strong>
                <strong>Rs.0</strong>
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>Tracked across all partner vendors</div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", background: "#fbfdff", marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Commissions Earned</strong>
                <strong id="setuKoshTotal">{formatINR(setuKosh)}</strong>
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>Total from referral shopping</div>
            </div>
            <div style={{ border: "1px solid var(--border)", borderRadius: "10px", padding: "12px", background: "#fbfdff", marginBottom: "8px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>Setu Kosh IDs</strong>
                <strong>0</strong>
              </div>
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>Earn more to unlock Setu Kosh IDs</div>
            </div>

            <h3 style={{ marginTop: "20px" }}>Recent Setu Kosh Activity</h3>
            <div id="setuKoshRecent" style={{ color: "var(--muted)", fontSize: "13px", padding: "12px" }}>
              No Setu Kosh commissions yet. Shopping from your referral network will appear here.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
