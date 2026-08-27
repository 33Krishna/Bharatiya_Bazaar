import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Calculator() {
  const { token, logout } = useAuth();
  const navigate = useNavigate();
  
  // Member profile state
  const [profile, setProfile] = useState<any>(null);
  const [isGuest, setIsGuest] = useState(true);

  // Inputs
  const [grossRupees, setGrossRupees] = useState("600");
  const [method, setMethod] = useState("BANK");

  // Server-computed breakdown states
  const [breakdown, setBreakdown] = useState<any>({
    grossPaise: 60000,
    recovered194RPaise: 0,
    taxableBasePaise: 60000,
    appliedTdsRatePct: 3.0,
    estimatedTdsPaise: 1800,
    postTdsPaise: 58200,
    adminChargeRatePct: 10.0,
    estimatedAdminChargePaise: 5820,
    netPayablePaise: 52380
  });

  useEffect(() => {
    checkMemberSession();
  }, [token]);

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchPreview();
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [grossRupees, method]);

  const checkMemberSession = async () => {
    if (!token) {
      setIsGuest(true);
      return;
    }
    try {
      const res = await fetch("/api/members/profile", {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());

      if (res.success) {
        setProfile(res.data);
        setIsGuest(false);
      } else {
        setIsGuest(true);
      }
    } catch (e) {
      setIsGuest(true);
    }
  };

  const fetchPreview = async () => {
    const rupees = parseFloat(grossRupees) || 0;
    const paise = Math.round(rupees * 100);
    if (paise < 10000) return; // Minimum ₹100

    const headers: Record<string, string> = {};
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`/api/withdrawals/tds-preview?amountPaise=${paise}&method=${method}`, { headers });
      const data = await res.json();
      if (res.ok && data.success) {
        setBreakdown(data.data);
      }
    } catch (err) {
      console.error("Preview error:", err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const formatINR = (paise: number) => {
    return "₹" + (Number(paise || 0) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  };

  const activeCard = profile?.activeCard || profile?.idCards?.[0];

  const css = `
    :root {
      --navy: #0d1b2a;
      --navy-2: #14263b;
      --teal: #0f9d9d;
      --teal-dark: #0b7c7c;
      --amber: #f5a623;
      --bg: #f4f7fb;
      --card: #ffffff;
      --text: #17233a;
      --muted: #64748b;
      --border: #dbe4ef;
      --success: #16a34a;
      --warning: #d97706;
      --danger: #dc2626;
      --info: #0369a1;
      --radius-card: 12px;
      --radius-btn: 8px;
      --shadow: 0 10px 30px rgba(13, 27, 42, 0.08);
    }

    .topbar {
      background: var(--navy); color: #fff; padding: 14px 22px;
      display: flex; justify-content: space-between; align-items: center;
      gap: 12px; position: sticky; top: 0; z-index: 20;
    }

    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; text-decoration: none; color: #fff; }
    .brand-badge {
      width: 34px; height: 34px; border-radius: 50%;
      background: radial-gradient(circle at center, var(--amber) 0 26%, var(--teal) 27% 54%, var(--navy-2) 55% 100%);
    }

    .member-chip { display: flex; align-items: center; gap: 10px; font-size: 14px; color: rgba(255,255,255,0.92); }
    .avatar {
      width: 34px; height: 34px; border-radius: 50%; background: var(--teal);
      display: grid; place-items: center; font-weight: 700; color: #fff;
    }

    .container { width: min(1000px, calc(100% - 32px)); margin: 24px auto 40px; }

    .page-head { margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 12px; }
    .page-head h1 { font-size: clamp(24px, 3vw, 32px); color: var(--navy); margin-bottom: 4px; }
    .page-head p { color: var(--muted); font-size: 14.5px; }

    .nav-links { display: flex; gap: 8px; flex-wrap: wrap; }
    .nav-btn {
      padding: 8px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-decoration: none;
      background: #fff; color: var(--navy); border: 1px solid var(--border);
    }
    .nav-btn.active { background: var(--navy); color: #fff; border-color: var(--navy); }

    .card {
      background: var(--card); border: 1px solid var(--border);
      border-radius: var(--radius-card); box-shadow: var(--shadow);
    }

    .panel { padding: 24px; margin-bottom: 20px; }
    .panel h2 { font-size: 18px; color: var(--navy); margin-bottom: 14px; }

    .badge { display: inline-flex; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .badge.success { background: #e8f8ee; color: var(--success); }
    .badge.warning { background: #fff4e0; color: var(--warning); }
    .badge.info { background: #e0f2fe; color: var(--info); }
    .badge.danger { background: #fee2e2; color: var(--danger); }

    .note {
      border-left: 4px solid var(--teal); background: #f3fbfb; color: #155e5e;
      padding: 12px 14px; border-radius: 8px; font-size: 13.5px; margin-bottom: 16px;
    }
    .note.warning { border-left-color: var(--warning); background: #fff8e9; color: #7c4a03; }

    .field-group { margin-bottom: 16px; }
    .field-label { display: block; font-size: 13.5px; font-weight: 700; color: var(--navy); margin-bottom: 6px; }

    input, select {
      width: 100%; border: 1px solid var(--border); border-radius: 10px;
      padding: 12px 14px; font-size: 15px; color: var(--navy); background: #fff; outline: none;
    }
    input:focus, select:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(15, 157, 157, 0.12); }

    .calc-layout { display: grid; grid-template-columns: 1fr 1.2fr; gap: 20px; }

    .result-box {
      border: 1px solid var(--border); border-radius: 12px; padding: 20px;
      background: #fafcff;
    }

    .step-card {
      border-bottom: 1px solid var(--border); padding: 10px 0; display: flex; justify-content: space-between; align-items: center;
      font-size: 13.5px;
    }
    .step-card:last-child { border-bottom: none; }
    .step-label { color: var(--muted); }
    .step-val { font-weight: 700; color: var(--navy); }

    .net-hero {
      background: #e8f8ee; border-radius: 10px; padding: 14px; text-align: center; margin-top: 14px;
    }
    .net-hero .lbl { font-size: 12.5px; color: #14532d; font-weight: 600; margin-bottom: 4px; }
    .net-hero .val { font-size: 26px; font-weight: 800; color: var(--success); }

    .btn-ghost {
      background: transparent; color: #fff; border: 1px solid rgba(255,255,255,0.3);
      padding: 6px 12px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;
    }

    @media (max-width: 768px) {
      .calc-layout { grid-template-columns: 1fr; }
    }
  `;

  return (
    <div style={{ background: "linear-gradient(180deg, #f8fbff 0%, #f4f7fb 100%)", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* TOPBAR */}
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-badge"></span>
          <span>Bharatiya Bazaar · Withdrawal Calculator</span>
        </Link>
        {!isGuest && profile ? (
          <div className="member-chip">
            <span>{profile.name}</span>
            <span className="badge info">{activeCard?.cardNumber || "MAIN"}</span>
            <button className="btn-ghost" onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <Link to="/" style={{ color: "#fff", textDecoration: "none", fontSize: "14px" }}>← Home</Link>
        )}
      </header>

      <main className="container">
        <section className="page-head" style={{ marginBottom: "20px" }}>
          <div>
            <h1>Interactive Withdrawal &amp; TDS Calculator</h1>
            <p>निकासी कैलकुलेटर · Real-time Steps 0–3 calculation computed directly by the central backend engine</p>
          </div>
          <div className="nav-links">
            <Link to={isGuest ? "/login" : "/dashboard"} className="nav-btn">← Dashboard</Link>
            <Link to={isGuest ? "/login" : "/setu-kosh"} className="nav-btn">Setu Kosh</Link>
            <Link to="/calculator" className="nav-btn active">Calculator</Link>
            <Link to={isGuest ? "/login" : "/dashboard"} className="nav-btn">Notifications</Link>
          </div>
        </section>

        {/* GUEST NOTICE WARNING */}
        {isGuest && (
          <div className="note warning">
            <strong>⚠️ Guest Mode Preview:</strong> You are currently calculating as a guest (zero prior FY aggregates &amp; standard 3% TDS rate).{" "}
            <Link to="/login" style={{ fontWeight: 700, color: "inherit", textDecoration: "underline" }}>
              Log in to your member account
            </Link>{" "}
            for exact FY threshold progress, verified PAN rates, and Section 194R voucher recovery amounts.
          </div>
        )}

        <div className="calc-layout">
          {/* INPUT FORM PANEL */}
          <section className="card panel">
            <h2>Payout Parameters</h2>
            <div className="field-group">
              <label className="field-label">Gross Withdrawal Amount (₹) *</label>
              <input
                type="number"
                min="100"
                step="1"
                value={grossRupees}
                onChange={e => setGrossRupees(e.target.value)}
                required
              />
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>Minimum withdrawal is ₹100.00</div>
            </div>

            <div className="field-group">
              <label className="field-label">Payout Method *</label>
              <select value={method} onChange={e => setMethod(e.target.value)}>
                <option value="BANK">Bank Transfer (10% Admin Charge)</option>
                <option value="MEMBER_WALLET">Member Wallet Transfer (5% Admin Charge)</option>
                <option value="VOUCHER_CONVERSION">Reward Voucher Conversion (5% Admin Charge)</option>
              </select>
            </div>
          </section>

          {/* CALCULATIONS OUTPUT PANEL */}
          <section className="card panel">
            <h2>Step 0–3 Statutory Breakdown</h2>
            <div className="result-box">
              <div className="step-card">
                <span className="step-label">Gross Requested Amount</span>
                <span className="step-val">{formatINR(breakdown.grossPaise || 60000)}</span>
              </div>
              <div className="step-card">
                <span className="step-label">Step 0: 194R Voucher Recovery</span>
                <span className="step-val" style={{ color: "var(--danger)" }}>
                  {breakdown.recovered194RPaise > 0 ? `- ${formatINR(breakdown.recovered194RPaise)}` : "₹0.00"}
                </span>
              </div>
              <div className="step-card">
                <span className="step-label">Taxable Base for 194H</span>
                <span className="step-val">{formatINR(breakdown.taxableBasePaise || 60000)}</span>
              </div>
              <div className="step-card">
                <span className="step-label">Step 1: 194H TDS ({(breakdown.appliedTdsRatePct || 3).toFixed(1)}%)</span>
                <span className="step-val" style={{ color: "var(--danger)" }}>
                  {breakdown.estimatedTdsPaise > 0 ? `- ${formatINR(breakdown.estimatedTdsPaise)}` : "₹0.00"}
                </span>
              </div>
              <div className="step-card">
                <span className="step-label">Post-TDS Amount</span>
                <span className="step-val">{formatINR(breakdown.postTdsPaise || 60000)}</span>
              </div>
              <div className="step-card">
                <span className="step-label">Step 2: Admin Charge ({(breakdown.adminChargeRatePct || 10).toFixed(1)}%)</span>
                <span className="step-val" style={{ color: "var(--danger)" }}>
                  - {formatINR(breakdown.estimatedAdminChargePaise || 6000)}
                </span>
              </div>

              <div className="net-hero">
                <div className="lbl">Step 3: Net Payout Credited</div>
                <div className="val">{formatINR(breakdown.netPayablePaise || 54000)}</div>
              </div>
            </div>

            <div style={{ fontSize: "11.5px", color: "var(--muted)", marginTop: "12px", textAlign: "center" }}>
              Math Invariant: Gross (₹) = 194R Recovery + 194H TDS + Admin Charge + Net Payout
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
