import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, useNavigate } from "react-router-dom";

export default function Dashboard() {
  const { token, user, loginContext, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [placement, setPlacement] = useState<any>(null);
  const [autoPoolStats, setAutoPoolStats] = useState<any>(null);
  const [mySystemStats, setMySystemStats] = useState<any>(null);
  const [directReferrals, setDirectReferrals] = useState<number>(0);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteSide, setInviteSide] = useState<"LEFT" | "RIGHT">("LEFT");

  useEffect(() => {
    if (!token) {
      logout();
      navigate("/login");
      return;
    }

    const loadData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };

        const [profileRes, walletRes, commsRes, placementRes, apRes, msRes, refsRes] = await Promise.all([
          fetch("/api/members/profile", { headers }).then(r => r.json()),
          fetch("/api/wallet/balance", { headers }).then(r => r.json()),
          fetch("/api/wallet/commissions", { headers }).then(r => r.json()),
          fetch("/api/members/my-placement", { headers }).then(r => r.json()),
          fetch("/api/members/autopool-tree", { headers }).then(r => r.json()).catch(() => null),
          fetch("/api/members/my-system-tree", { headers }).then(r => r.json()).catch(() => null),
          fetch("/api/members/my-referrals", { headers }).then(r => r.json()).catch(() => null)
        ]);

        if (profileRes.success) setProfile(profileRes.data);
        if (walletRes.success) setWallet(walletRes.data);
        if (commsRes.success) setCommissions(commsRes.data || []);
        if (placementRes.success) setPlacement(placementRes.data);
        if (apRes && apRes.success) setAutoPoolStats(apRes);
        if (msRes && msRes.success) setMySystemStats(msRes.stats);
        if (refsRes && refsRes.success) setDirectReferrals(refsRes.directReferrals || 0);

      } catch (err) {
        console.error("Error loading dashboard data:", err);
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

  const handleWithdrawClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (loginContext?.isSubCard) {
      alert(`⚠️ Withdrawals can only be initiated when logged in as the MAIN ID (${loginContext.ownerMemberCode}). You are currently logged in as SUB card ${loginContext.cardNumber}.`);
    } else {
      navigate("/wallet");
    }
  };

  const copyReferralLink = () => {
    const memberCode = user?.memberCode || "";
    if (memberCode) {
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
      alert("Member code not available.");
    }
  };

  if (loading) {
    return <div className="loading">Loading dashboard...</div>;
  }

  const loginCtx = loginContext || (wallet?.loginContext || null);
  const activeCard = loginCtx?.cardNumber || user?.memberCode || "";
  const isSub = loginCtx?.isSubCard || false;
  const ownerCode = loginCtx?.ownerMemberCode || user?.memberCode || "";
  const balance = wallet?.balancePaise || 0;

  // Calculate total earnings
  const totalEarnings = wallet?.cardEarnings 
    ? wallet.cardEarnings.cardTotalPaise 
    : (commissions?.reduce((sum, c) => sum + c.amountPaise, 0) || 0);

  // Calculate held amount
  const heldPaise = wallet?.cardEarnings 
    ? wallet.cardEarnings.cardOnHoldPaise
    : (commissions || [])
        .filter(c => c.status === "PENDING_7_DAY" || c.status === "LOCKED_ACB")
        .reduce((s, c) => s + c.amountPaise, 0);

  const idCards = profile?.idCards || [];

  // Autopool stats
  const inProgressApLevel = autoPoolStats?.levelStatus?.find((ls: any) => !ls.complete);
  const apLevelText = inProgressApLevel
    ? `Level L${inProgressApLevel.level} · ${inProgressApLevel.filled}/${inProgressApLevel.size} filled`
    : autoPoolStats?.myStats ? "Cycle Complete ✓" : "Level —";

  return (
    <div style={{ width: "100%" }}>
      {isSub && (
        <div id="subLoginBanner" className="banner" style={{ background: "#fef3c7", border: "1px solid #f59e0b", color: "#92400e", padding: "12px 18px", borderRadius: "10px", marginBottom: "20px", fontSize: "14px", fontWeight: 500 }}>
          🔑 Viewing <strong>{activeCard}</strong>'s earnings (part of {ownerCode}'s unified wallet) — withdrawals restricted to MAIN ID.
        </div>
      )}

      <div className="banner">
        ✓ <strong>Welcome back!</strong> Your membership is active. Start referring friends to earn commissions.
      </div>

      <section className="stat-grid">
        <div className="card stat-card highlight">
          <div className="label"><span className="ico">👛</span> Wallet Balance</div>
          <div className="value">{formatINR(balance)}</div>
          <div className="sub">Available for withdrawal</div>
        </div>
        <div className="card stat-card">
          <div className="label"><span className="ico">💰</span> Total Earnings</div>
          <div className="value">{formatINR(totalEarnings)}</div>
          <div className="sub">
            {wallet?.cardEarnings 
              ? `On Hold: ${formatINR(heldPaise)} (${wallet.cardEarnings.cardNumber} slice)`
              : `On Hold: ${formatINR(heldPaise)} (7-day / ACB lock)`
            }
          </div>
        </div>
        <div className="card stat-card">
          <div className="label"><span className="ico">🆔</span> ID Cards</div>
          <div className="value">{idCards.length}</div>
          <div className="sub">MAIN + SUB + REBIRTH</div>
        </div>
        <div className="card stat-card">
          <div className="label"><span className="ico">🛡️</span> KYC Status</div>
          <div className="value" style={{ textTransform: "capitalize" }}>{profile?.kycStatus || "Pending"}</div>
          <div className="sub">Tier {profile?.kycTier || 1} (PAN Verified: {profile?.panVerified ? "Yes" : "No"})</div>
        </div>

        {/* Your Network Position Card */}
        <div className="card stat-card placement-card">
          <div className="decorative-circle"></div>
          <div className="label" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "14px", marginBottom: "12px" }}>
            <span style={{ fontSize: "18px" }}>🔗</span>
            <span style={{ fontWeight: 700, color: "var(--navy)" }}>Your Network Position</span>
          </div>
          <div className="placement-grid">
            <div className="placement-box sponsor">
              <div className="placement-label">👤 Sponsored By</div>
              <div className="placement-code">{placement?.sponsoredBy || "ROOT"}</div>
              <div className="placement-name">{placement?.sponsorName || "You are the founder"}</div>
            </div>
            <div className="placement-box placement">
              <div className="placement-label">🌳 Placed Under</div>
              <div className="placement-code">{placement?.placedUnderCard || placement?.placedUnder || "ROOT"}</div>
              <div className="placement-name">{placement?.placedUnderName || "Top of the tree"}</div>
            </div>
          </div>
          <div className="placement-footer">
            <span>Side: <strong>{placement?.side || "—"}</strong></span>
            <span>Placement Type: <strong>{placement?.placementType || "—"}</strong></span>
          </div>
        </div>
      </section>

      <section className="streams">
        <div className="card stream-card">
          <h3>Anant Samriddhi Chakra</h3>
          <div className="stream-sub">AutoPool · Global binary pool</div>
          <div className="stream-metrics">
            <div className="metric"><div className="m-label">Current Level</div><div className="m-value">{apLevelText}</div></div>
            <div className="metric"><div className="m-label">Cash Earned</div><div className="m-value">{formatINR(autoPoolStats?.myStats?.cashEarnedPaise || 0)}</div></div>
            <div className="metric"><div className="m-label">Rebirth IDs</div><div className="m-value">{autoPoolStats?.myStats?.rebirthIds || 0}</div></div>
            <div className="metric">
              <div className="m-label">Status</div>
              <div className="m-value">
                {autoPoolStats?.myStats ? (
                  <span className="badge success">ACTIVE</span>
                ) : (
                  <span className="badge pending">NO POOL ID</span>
                )}
              </div>
            </div>
          </div>
          <Link className="stream-link" to="/autopool">View Pool Tree →</Link>
        </div>

        <div className="card stream-card">
          <h3>MY SYSTEM</h3>
          <div className="stream-sub">Referral network · Binary tree</div>
          <div className="stream-metrics">
            <div className="metric"><div className="m-label">Direct Referrals</div><div className="m-value">{directReferrals}</div></div>
            <div className="metric"><div className="m-label">Network Size</div><div className="m-value">{mySystemStats?.totalNetwork || 0}</div></div>
            <div className="metric">
              <div className="m-label">Cash Earned</div>
              <div className="m-value">
                {formatINR(commissions
                  .filter(c => (c.stream || "").toUpperCase().includes("SYSTEM"))
                  .reduce((sum, c) => sum + c.amountPaise, 0)
                )}
              </div>
            </div>
            <div className="metric">
              <div className="m-label">ACB Status</div>
              <div className="m-value">
                {mySystemStats?.acbStatus ? (
                  <span className="badge success">UNLOCKED</span>
                ) : (
                  <span className="badge pending">PENDING</span>
                )}
              </div>
            </div>
          </div>
          <Link className="stream-link" to="/my-system">View My Network →</Link>
        </div>

        <div className="card stream-card">
          <h3>Setu Kosh</h3>
          <div className="stream-sub">Shopping rewards · Binary tree</div>
          <div className="stream-metrics">
            <div className="metric"><div className="m-label">Shopping Counter</div><div className="m-value">{formatINR(profile?.setuKoshCounter?.counterPaise || 0)}</div></div>
            <div className="metric"><div className="m-label">Commission</div><div className="m-value">{formatINR(commissions.filter(c => c.stream === "SETU_KOSH").reduce((sum, c) => sum + c.amountPaise, 0))}</div></div>
            <div className="metric"><div className="m-label">Status</div><div className="m-value"><span className="badge success">ACTIVE</span></div></div>
            <div className="metric"><div className="m-label">Position</div><div className="m-value">Queue</div></div>
          </div>
          <Link className="stream-link" to="/setu-kosh">View Shopping History →</Link>
        </div>
      </section>

      <section className="grid-2">
        <div className="card panel">
          <h2>Recent Commissions</h2>
          <table>
            <thead>
              <tr><th>Date</th><th>Card</th><th>Stream</th><th>Amount</th><th>Status</th></tr>
            </thead>
            <tbody>
              {commissions.length > 0 ? (
                commissions.slice(0, 10).map((c, idx) => {
                  const isSuccess = ["CONFIRMED", "WITHDRAWABLE"].includes(c.status);
                  const isLocked  = ["LOCKED_ACB", "PAY_ONCE_BLOCKED"].includes(c.status);
                  const badgeClass = isSuccess ? "success" : isLocked ? "locked" : "pending";
                  return (
                    <tr key={idx}>
                      <td>{formatDate(c.createdAt)}</td>
                      <td>
                        <strong>{c.cardNumber || "—"}</strong>{" "}
                        <span style={{ fontSize: "11px", opacity: 0.7 }}>({c.cardType || "MAIN"})</span>
                      </td>
                      <td>{c.stream} L{c.level || 1}</td>
                      <td>+{formatINR(c.amountPaise)}</td>
                      <td><span className={`badge ${badgeClass}`}>{c.status}</span></td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--muted)" }}>
                    No commissions yet. Start referring friends!
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="quick-actions">
            <button className="qa-btn" type="button" onClick={() => setInviteModalOpen(true)}>
              <strong>🔗 Refer a Friend</strong><span>Choose LEFT / RIGHT placement</span>
            </button>
            <button className="qa-btn" type="button" onClick={() => navigate("/setu-kosh")}>
              <strong>🛒 Shop & Earn</strong><span>Find partner vendors</span>
            </button>
            <button className="qa-btn" type="button" onClick={handleWithdrawClick}>
              <strong>💸 Withdraw</strong><span>Transfer to bank / wallet</span>
            </button>
          </div>
        </div>

        <div className="card panel">
          <h2>Wallet Summary</h2>
          <div className="wallet-row">
            <div>
              <div className="name">Cash Wallet</div>
              <div className="desc">Available balance</div>
            </div>
            <div className="amt">{formatINR(balance)}</div>
          </div>

          <h2 style={{ marginTop: "20px" }}>Card-wise Bifurcation</h2>
          <div>
            {wallet?.breakdown && wallet.breakdown.length > 0 ? (
              wallet.breakdown.map((card: any, idx: number) => {
                const isCurrent = card.isCurrentLogin;
                return (
                  <div key={idx} className="wallet-row" style={isCurrent ? { borderLeft: "3px solid #3b82f6", paddingLeft: "8px", background: "rgba(59,130,246,0.04)" } : {}}>
                    <div>
                      <div className="name">
                        {card.cardNumber} {isCurrent && <span className="badge" style={{ background: "#3b82f6", color: "#fff", fontSize: "10px", padding: "2px 6px", textTransform: "none" }}>Current Login</span>}
                      </div>
                      <div className="desc">{card.cardType} · Total: {formatINR(card.totalPaise)} (Hold: {formatINR(card.onHoldPaise)})</div>
                    </div>
                    <div className="amt" style={{ textAlign: "right" }}>
                      <span className={`badge ${card.acbStatus ? "success" : "pending"}`}>
                        {card.acbStatus ? "ACB" : "Pending"}
                      </span>
                      <div style={{ fontSize: "12px", color: "var(--teal)", fontWeight: 600, marginTop: "2px" }}>
                        +{formatINR(card.withdrawablePaise)}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="wallet-row">
                <div>
                  <div className="name">No ID Cards</div>
                  <div className="desc">Purchase ID cards to participate</div>
                </div>
                <div className="amt">-</div>
              </div>
            )}
          </div>

          <div className="note">
            Withdrawals are processed from your cash wallet. Complete KYC Tier 2 to unlock withdrawals.
          </div>
        </div>
      </section>

      {/* Referral Placement Modal */}
      {inviteModalOpen && (
        <div className="modal-backdrop open" onClick={() => setInviteModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>🔗 Refer a Friend</h3>
            <p style={{ color: "var(--muted)", fontSize: "13.5px" }}>
              Choose which leg of your MY SYSTEM tree the new member will join.
              This placement is <strong>locked</strong> once they register.
            </p>

            <div className="method-list">
              <label className={`method-item ${inviteSide === "LEFT" ? "selected" : ""}`} onClick={() => setInviteSide("LEFT")}>
                <input type="radio" name="refside" value="LEFT" checked={inviteSide === "LEFT"} readOnly />
                <span>
                  <span className="method-title">⬅ LEFT Leg</span>
                  <span className="method-sub">Place the new member on your LEFT side</span>
                </span>
              </label>
              <label className={`method-item ${inviteSide === "RIGHT" ? "selected" : ""}`} onClick={() => setInviteSide("RIGHT")}>
                <input type="radio" name="refside" value="RIGHT" checked={inviteSide === "RIGHT"} readOnly />
                <span>
                  <span className="method-title">➡ RIGHT Leg</span>
                  <span className="method-sub">Place the new member on your RIGHT side</span>
                </span>
              </label>
            </div>

            <div className="note" style={{ marginTop: "12px" }}>
              💡 <strong>ACB Tip:</strong> You need 1 LEFT + 1 RIGHT direct referral to unlock ACB status!
            </div>

            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setInviteModalOpen(false)} type="button">Cancel</button>
              <button className="btn-confirm" onClick={copyReferralLink} type="button">Copy Invite Link</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
