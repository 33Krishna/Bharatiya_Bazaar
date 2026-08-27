import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

export default function VendorRegister() {
  const navigate = useNavigate();

  // Stepper state
  const [step, setStep] = useState(1);

  // Error/Alert banner message
  const [alertMessage, setAlertMessage] = useState<string | null>(null);

  // Form Fields
  const [ownerName, setOwnerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [address, setAddress] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [category, setCategory] = useState("GROCERY");
  const [entityType, setEntityType] = useState("INDIVIDUAL");
  const [panNumber, setPanNumber] = useState("");
  const [gstin, setGstin] = useState("");
  const [referrerCode, setReferrerCode] = useState("");

  const [agreeTerms, setAgreeTerms] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Success details from response
  const [createdVendor, setCreatedVendor] = useState<any>(null);

  const marginRates: Record<string, number> = {
    GROCERY: 7.0,
    APPAREL: 15.0,
    ELECTRONICS: 10.0,
    RESTAURANT: 12.0,
    HEALTHCARE: 10.0,
    SERVICES: 20.0,
    GENERAL: 10.0
  };

  const handleGoToStep = (targetStep: number) => {
    setAlertMessage(null);
    if (targetStep > step) {
      if (step === 1) {
        if (!ownerName.trim() || ownerName.trim().length < 2) {
          setAlertMessage("Please enter a valid owner name (min. 2 characters).");
          return;
        }
        if (!/^\d{10}$/.test(mobile.trim())) {
          setAlertMessage("Please enter a valid 10-digit mobile number.");
          return;
        }
        if (!password || password.length < 6) {
          setAlertMessage("Password must be at least 6 characters.");
          return;
        }
        if (!/^\d{6}$/.test(pinCode.trim())) {
          setAlertMessage("Please enter a valid 6-digit postal PIN code.");
          return;
        }
      }
      if (step === 2) {
        if (!businessName.trim() || businessName.trim().length < 2) {
          setAlertMessage("Please enter your store/business name.");
          return;
        }
        if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(panNumber.trim().toUpperCase())) {
          setAlertMessage("Please enter a valid 10-character PAN number (e.g. ABCDE1234F).");
          return;
        }
      }
    }
    setStep(targetStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const submitVendorRegistration = async () => {
    setAlertMessage(null);
    if (!agreeTerms) {
      setAlertMessage("Please accept the Vendor Partnership Terms & Conditions to proceed.");
      return;
    }

    setSubmitting(true);

    const payload = {
      name: ownerName.trim(),
      businessName: businessName.trim(),
      mobile: mobile.trim(),
      password,
      pinCode: pinCode.trim(),
      address: address.trim(),
      category,
      entityType,
      panNumber: panNumber.trim().toUpperCase(),
      gstin: gstin.trim().toUpperCase() || undefined,
      referrerCode: referrerCode.trim() || undefined,
      payoutMethod: "BANK"
    };

    try {
      const res = await fetch("/api/vendors/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error?.message || "Registration failed. Please verify details.");
      }

      setCreatedVendor(data.data.vendor);
      handleGoToStep(4);
    } catch (err: any) {
      setAlertMessage(err.message || "Network error during registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const categoryMargin = marginRates[category] || 10.0;

  const styles = `
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
      display: flex; justify-content: space-between; align-items: center; gap: 12px;
    }

    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; text-decoration: none; color: #fff; }
    .brand-badge {
      width: 34px; height: 34px; border-radius: 50%;
      background: radial-gradient(circle at center, var(--amber) 0 26%, var(--teal) 27% 54%, var(--navy-2) 55% 100%);
    }

    .container { width: min(800px, calc(100% - 32px)); margin: 24px auto 40px; }

    .page-head { margin-bottom: 20px; text-align: center; }
    .page-head h1 { font-size: clamp(24px, 3vw, 32px); color: var(--navy); margin-bottom: 4px; }
    .page-head p { color: var(--muted); font-size: 14.5px; }

    .card {
      background: var(--card); border: 1px solid var(--border);
      border-radius: var(--radius-card); box-shadow: var(--shadow);
    }

    .panel { padding: 26px; margin-bottom: 16px; text-align: left; }
    .panel h2 { font-size: 19px; color: var(--navy); margin-bottom: 6px; }
    .panel p.sub { font-size: 13.5px; color: var(--muted); margin-bottom: 16px; }

    .stepper { display: flex; gap: 8px; margin-bottom: 24px; flex-wrap: wrap; justify-content: center; }
    .step-dot {
      display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700;
      color: var(--muted); padding: 7px 14px; border-radius: 999px; border: 1px solid var(--border);
      background: #fff;
    }
    .step-dot.active { background: var(--navy); color: #fff; border-color: var(--navy); }
    .step-dot.done { background: #e8f8ee; color: var(--success); border-color: #b7e4c7; }

    .badge { display: inline-flex; padding: 4px 10px; border-radius: 999px; font-size: 12px; font-weight: 700; }
    .badge.success { background: #e8f8ee; color: var(--success); }
    .badge.warning { background: #fff4e0; color: var(--warning); }
    .badge.info { background: #e8f6ff; color: var(--info); }

    .note {
      border-left: 4px solid var(--teal); background: #f3fbfb; color: #155e5e;
      padding: 12px 14px; border-radius: 8px; font-size: 13px; margin: 14px 0;
    }
    .note.warning { border-left-color: var(--warning); background: #fff8e9; color: #7c4a03; }
    .note.info { border-left-color: var(--info); background: #e8f4fd; color: #0c4a6e; }
    .note.danger { border-left-color: var(--danger); background: #fee2e2; color: #991b1b; }
    .note.success { border-left-color: var(--success); background: #ecfdf5; color: #065f46; }

    .field-group { margin-bottom: 16px; }
    .field-label { display: block; font-size: 13.5px; font-weight: 700; color: var(--navy); margin-bottom: 6px; }
    .field-label .hindi { font-weight: 400; color: var(--muted); font-size: 12px; margin-left: 4px; }

    input, select, textarea {
      width: 100%; border: 1px solid var(--border); border-radius: 10px;
      padding: 11px 14px; font-size: 14.5px; color: var(--navy); background: #fff; outline: none;
      transition: border-color 0.2s ease;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--teal); box-shadow: 0 0 0 3px rgba(15, 157, 157, 0.12); }

    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }

    .btn-group { display: flex; gap: 12px; margin-top: 22px; }
    .btn-primary {
      flex: 1; background: var(--teal); color: #fff; border: none;
      padding: 13px 18px; border-radius: var(--radius-btn); font-size: 15px; font-weight: 700; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      transition: background 0.2s ease;
    }
    .btn-primary:hover { background: var(--teal-dark); }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }

    .btn-ghost {
      background: transparent; color: var(--navy); border: 1px solid var(--border);
      padding: 13px 18px; border-radius: var(--radius-btn); font-size: 14px; font-weight: 600; cursor: pointer;
    }
    .btn-ghost:hover { background: #f1f5f9; }

    .agreement-section {
      border: 1px solid var(--border); border-radius: 10px; padding: 14px;
      background: #fafcff; margin-bottom: 12px;
    }
    .agreement-section h4 { font-size: 14px; color: var(--navy); margin-bottom: 6px; }
    .agreement-section ul { padding-left: 20px; font-size: 13px; color: var(--muted); }
    .agreement-section li { margin-bottom: 4px; }

    @media (max-width: 640px) {
      .grid-2 { grid-template-columns: 1fr; }
      .btn-group { flex-direction: column-reverse; }
    }
  `;

  return (
    <div style={{ background: "linear-gradient(180deg, #f8fbff 0%, #f4f7fb 100%)", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-badge"></span>
          <span>Bharatiya Bazaar · भारतीय बाज़ार</span>
        </Link>
        <div>
          <Link to="/login" style={{ color: "#fff", textDecoration: "none", fontSize: "13.5px", fontWeight: 600, padding: "6px 12px", border: "1px solid rgba(255,255,255,0.3)", borderRadius: "6px" }}>
            Vendor Login →
          </Link>
        </div>
      </header>

      <main className="container">
        <section className="page-head">
          <h1>Partner Vendor Onboarding</h1>
          <p>विक्रेता पंजीकरण · Join our verified local commerce network</p>
        </section>

        {/* STEP PROGRESS BAR */}
        <div className="stepper">
          <div className={`step-dot ${step === 1 ? "active" : step > 1 ? "done" : ""}`}>
            <span>1</span> Basic Details
          </div>
          <div className={`step-dot ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>
            <span>2</span> Business Info
          </div>
          <div className={`step-dot ${step === 3 ? "active" : step > 3 ? "done" : ""}`}>
            <span>3</span> Agreement & Deposit
          </div>
          <div className={`step-dot ${step === 4 ? "active" : step > 4 ? "done" : ""}`}>
            <span>4</span> Success & Activation
          </div>
        </div>

        {/* ALERT BOX BANNER */}
        {alertMessage && <div className="note danger">{alertMessage}</div>}

        {/* STEP 1: OWNER & CONTACT DETAILS */}
        {step === 1 && (
          <section className="card panel">
            <h2>Step 1 — Owner & Contact Details</h2>
            <p className="sub">मालिक एवं संपर्क विवरण · Enter your personal and contact information</p>

            <div className="grid-2">
              <div className="field-group">
                <label className="field-label">Owner Full Name <span className="hindi">(मालिक का नाम)</span> *</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar Sharma"
                  value={ownerName}
                  onChange={e => setOwnerName(e.target.value)}
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label">Mobile Number <span className="hindi">(मोबाइल नंबर)</span> *</label>
                <input
                  type="tel"
                  placeholder="10-digit mobile number"
                  maxLength={10}
                  value={mobile}
                  onChange={e => setMobile(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="field-group">
                <label className="field-label">Account Password <span className="hindi">(पासवर्ड)</span> *</label>
                <input
                  type="password"
                  placeholder="Min. 6 characters"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label">Store PIN Code <span className="hindi">(पिन कोड)</span> *</label>
                <input
                  type="text"
                  placeholder="6-digit postal PIN"
                  maxLength={6}
                  value={pinCode}
                  onChange={e => setPinCode(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Full Store Address <span className="hindi">(दुकान का पूरा पता)</span></label>
              <textarea
                rows={2}
                placeholder="Shop/Building No., Street, Area, City, State"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <div className="btn-group">
              <button type="button" className="btn-primary" onClick={() => handleGoToStep(2)}>
                Continue to Business Info →
              </button>
            </div>
          </section>
        )}

        {/* STEP 2: BUSINESS & CATEGORIES */}
        {step === 2 && (
          <section className="card panel">
            <h2>Step 2 — Business & Category Details</h2>
            <p className="sub">व्यापार एवं श्रेणी विवरण · Set your business category and commission margin</p>

            <div className="field-group">
              <label className="field-label">Store / Business Name <span className="hindi">(दुकान / व्यापार का नाम)</span> *</label>
              <input
                type="text"
                placeholder="e.g. Sharma Kirana & General Store"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                required
              />
            </div>

            <div className="grid-2">
              <div className="field-group">
                <label className="field-label">Business Category <span className="hindi">(व्यापार श्रेणी)</span> *</label>
                <select value={category} onChange={e => setCategory(e.target.value)}>
                  <option value="GROCERY">Grocery (किराना / राशन) — 7.0% Margin</option>
                  <option value="APPAREL">Apparel / Clothing (कपड़ा / परिधान) — 15.0% Margin</option>
                  <option value="ELECTRONICS">Electronics & Mobile (इलेक्ट्रॉनिक्स) — 10.0% Margin</option>
                  <option value="RESTAURANT">Restaurant & Cafe (खान-पान) — 12.0% Margin</option>
                  <option value="HEALTHCARE">Healthcare & Pharmacy (दवाइयां) — 10.0% Margin</option>
                  <option value="SERVICES">Services (सेवाएं) — 20.0% Margin</option>
                  <option value="GENERAL">General Retail (सामान्य खुदरा) — 10.0% Margin</option>
                </select>
              </div>

              <div className="field-group">
                <label className="field-label">Entity Type <span className="hindi">(इकाई प्रकार)</span> *</label>
                <select value={entityType} onChange={e => setEntityType(e.target.value)}>
                  <option value="INDIVIDUAL">Individual / Proprietorship (व्यक्तिगत)</option>
                  <option value="COMPANY">Company / Partnership / LLP (कंपनी)</option>
                </select>
              </div>
            </div>

            <div className="note info">
              <strong>Category Margin Rate: {categoryMargin.toFixed(1)}%</strong><br />
              Customer purchases fund Setu Kosh commissions through this unified category margin.
            </div>

            <div className="grid-2">
              <div className="field-group">
                <label className="field-label">PAN Number <span className="hindi">(पैन नंबर)</span> *</label>
                <input
                  type="text"
                  placeholder="e.g. ABCDE1234F"
                  maxLength={10}
                  style={{ textTransform: "uppercase" }}
                  value={panNumber}
                  onChange={e => setPanNumber(e.target.value.toUpperCase())}
                  required
                />
              </div>
              <div className="field-group">
                <label className="field-label">GSTIN <span className="hindi">(जीएसटीआईएन - वैकल्पिक)</span></label>
                <input
                  type="text"
                  placeholder="15-digit GSTIN (optional)"
                  maxLength={15}
                  style={{ textTransform: "uppercase" }}
                  value={gstin}
                  onChange={e => setGstin(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="field-group">
              <label className="field-label">Referrer Member Code <span className="hindi">(रेफरल सदस्य कोड - वैकल्पिक)</span></label>
              <input
                type="text"
                placeholder="Enter Member Code (e.g. M10012) who introduced you"
                value={referrerCode}
                onChange={e => setReferrerCode(e.target.value)}
              />
              <div style={{ fontSize: "12px", color: "var(--muted)", marginTop: "4px" }}>
                The referring member earns a permanent 0.25% referral bonus on all your store sales (First-referrer-wins).
              </div>
            </div>

            <div className="btn-group">
              <button type="button" className="btn-ghost" onClick={() => handleGoToStep(1)}>← Back</button>
              <button type="button" className="btn-primary" onClick={() => handleGoToStep(3)}>
                Continue to Terms & Deposit →
              </button>
            </div>
          </section>
        )}

        {/* STEP 3: AGREEMENT POLICY DETAILS */}
        {step === 3 && (
          <section className="card panel">
            <h2>Step 3 — Vendor Terms & Security Deposit</h2>
            <p className="sub">शर्तें एवं सुरक्षा जमा · Review operational guidelines and confirm registration</p>

            <div className="agreement-section">
              <h4>1. Security Deposit Mode & Policy</h4>
              <ul>
                <li><strong>Mandatory Refundable Deposit:</strong> ₹5,000 (500,000 paise) recorded at platform onboarding.</li>
                <li><strong>Deposit Protection:</strong> Protects member commissions and covers settlement reconciliation.</li>
                <li><strong>Freeze Threshold:</strong> If your settlement wallet falls below ₹500, deposit freeze state is engaged until replenished.</li>
              </ul>
            </div>

            <div className="agreement-section">
              <h4>2. Settlement Cycle & TDS Compliance</h4>
              <ul>
                <li><strong>Weekly Settlement:</strong> Every Monday at 00:00 UTC for previous week's cleared sales.</li>
                <li><strong>TDS Section 194C:</strong> 1% (Individual) / 2% (Company) on gross sales exceeding ₹30k single or ₹1L aggregate.</li>
                <li><strong>On-Demand Early Settlement:</strong> Available at any time with flat ₹250 administrative fee.</li>
              </ul>
            </div>

            <div className="agreement-section">
              <h4>3. Inactivity Lifecycle</h4>
              <ul>
                <li><strong>31 Days Inactive:</strong> Account marked INACTIVE if no sales recorded.</li>
                <li><strong>91 Days Inactive:</strong> Account marked FROZEN; settlements halted.</li>
                <li><strong>181 Days Inactive:</strong> Account permanently CLOSED.</li>
              </ul>
            </div>

            <div style={{ margin: "16px 0" }}>
              <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", fontSize: "13.5px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  style={{ width: "auto", marginTop: "3px" }}
                  checked={agreeTerms}
                  onChange={e => setAgreeTerms(e.target.checked)}
                />
                <span>I have read, understood, and agree to the Bharatiya Bazaar Vendor Partnership Terms & Conditions.</span>
              </label>
            </div>

            <div className="btn-group">
              <button type="button" className="btn-ghost" onClick={() => handleGoToStep(2)}>← Back</button>
              <button
                type="button"
                className="btn-primary"
                onClick={submitVendorRegistration}
                disabled={submitting}
              >
                {submitting ? "Processing Registration..." : "Confirm & Complete Registration (₹5,000 Deposit) ✓"}
              </button>
            </div>
          </section>
        )}

        {/* STEP 4: SUCCESS PROFILE CONFIRMATION */}
        {step === 4 && (
          <section className="card panel" style={{ textAlign: "center" }}>
            <div style={{ width: "64px", height: "64px", borderRadius: "50%", background: "#e8f8ee", color: "var(--success)", fontSize: "32px", display: "grid", placeItems: "center", margin: "0 auto 16px" }}>
              ✓
            </div>
            <h2>Vendor Registration Complete!</h2>
            <p className="sub">आपका विक्रेता खाता सफलतापूर्वक पंजीकृत हो गया है</p>

            <div className="note success" style={{ textAlign: "left", margin: "16px 0" }}>
              <strong>Registration Details:</strong><br />
              • <strong>Store:</strong> {createdVendor?.businessName || "—"}<br />
              • <strong>Vendor ID / Code:</strong> <span style={{ fontFamily: "monospace", fontWeight: 700 }}>{createdVendor?.id || createdVendor?._id || "—"}</span><br />
              • <strong>Category Margin:</strong> {createdVendor?.marginRatePct}% ({createdVendor?.category})<br />
              • <strong>Security Deposit:</strong> ₹5,000.00 (Recorded & Confirmed)<br />
              • <strong>Account Status:</strong> <span className="badge success">ACTIVE</span>
            </div>

            <p style={{ fontSize: "13.5px", color: "var(--muted)", marginBottom: "20px" }}>
              You can now log in to your Vendor Dashboard to record member purchases, track Setu Kosh counter progress, and view weekly settlements.
            </p>

            <div className="btn-group">
              <Link to="/login" className="btn-primary" style={{ textDecoration: "none" }}>
                Go to Vendor Login →
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
