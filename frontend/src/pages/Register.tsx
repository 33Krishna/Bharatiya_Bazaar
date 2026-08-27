import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Register() {
  const { login, token } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // View state: "register" | "login"
  const [view, setView] = useState<"register" | "login">("register");

  // Stepper state
  const [step, setStep] = useState(1);

  // Eligibility checkboxes
  const [elig1, setElig1] = useState(false);
  const [elig2, setElig2] = useState(false);
  const [elig3, setElig3] = useState(false);
  const [step1Error, setStep1Error] = useState(false);

  // Registration fields
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [step2Error, setStep2Error] = useState<string | null>(null);

  // Sponsor fields
  const [referralCode, setReferralCode] = useState("");
  const [side, setSide] = useState<"LEFT" | "RIGHT">("LEFT");
  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [validatingSponsor, setValidatingSponsor] = useState(false);
  const [sponsorError, setSponsorError] = useState<string | null>(null);
  const [hasReferralFromUrl, setHasReferralFromUrl] = useState(false);

  // Login fields
  const [loginMobile, setLoginMobile] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Quantity stepper
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Created IDs results (Step 5)
  const [createdMember, setCreatedMember] = useState<any>(null);
  const [allCreatedCards, setAllCreatedCards] = useState<any[]>([]);

  // Parse sponsor info from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const ref = urlParams.get("ref") || urlParams.get("sponsor") || urlParams.get("sponsorCode");
    const sideParam = (urlParams.get("side") || "LEFT").toUpperCase();

    if (ref) {
      setSide(sideParam === "RIGHT" ? "RIGHT" : "LEFT");
      setReferralCode(ref.trim().toUpperCase());
      setHasReferralFromUrl(true);
      autoVerifySponsor(ref.trim().toUpperCase());
    }
  }, [location.search]);

  const autoVerifySponsor = async (code: string) => {
    setValidatingSponsor(true);
    setSponsorError(null);
    try {
      const res = await fetch(`/api/auth/validate-referral?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSponsorName(data.data.name);
      } else {
        setSponsorError("Invalid sponsor code. Please check manual input.");
        setHasReferralFromUrl(false);
      }
    } catch (e) {
      setSponsorError("Error checking sponsor code.");
      setHasReferralFromUrl(false);
    } finally {
      setValidatingSponsor(false);
    }
  };

  const handleManualVerifySponsor = async () => {
    if (!referralCode.trim()) return;
    setValidatingSponsor(true);
    setSponsorError(null);
    setSponsorName(null);
    try {
      const res = await fetch(`/api/auth/validate-referral?code=${encodeURIComponent(referralCode.trim().toUpperCase())}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setSponsorName(data.data.name);
        alert(`Sponsor found: ${data.data.name}`);
      } else {
        setSponsorError("Sponsor not found.");
      }
    } catch (e) {
      setSponsorError("Network error checking sponsor.");
    } finally {
      setValidatingSponsor(false);
    }
  };

  // Step transitions validation
  const handleGoToStep = (targetStep: number) => {
    if (targetStep > step) {
      if (step === 1) {
        if (!elig1 || !elig2 || !elig3) {
          setStep1Error(true);
          return;
        }
        setStep1Error(false);
      }
      if (step === 2) {
        if (name.trim().length < 2) {
          setStep2Error("Name must be at least 2 characters.");
          return;
        }
        if (mobile.replace(/\D/g, "").length !== 10) {
          setStep2Error("Mobile must be exactly 10 digits.");
          return;
        }
        if (!password || password.length < 6) {
          setStep2Error("Password must be at least 6 characters.");
          return;
        }
        if (password !== confirmPassword) {
          setStep2Error("Passwords do not match.");
          return;
        }
        setStep2Error(null);
      }
    }
    setStep(targetStep);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Login handler
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    if (!loginMobile || !loginPassword) {
      setLoginError("Please enter mobile/member code and password.");
      return;
    }

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile: loginMobile.trim(), password: loginPassword })
      });
      const data = await res.json();
      if (res.ok && data.data?.token) {
        login(data.data.token, "MEMBER", data.data.member, data.data.loginContext);
        navigate("/dashboard");
      } else {
        setLoginError(data.error?.message || "Invalid credentials");
      }
    } catch (err) {
      setLoginError("Network connection error. Is the server online?");
    }
  };

  // Submit registration checkout
  const handleRegisterSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);

    const payload = {
      name: name.trim(),
      mobile: mobile.replace(/\D/g, ""),
      email: email.trim() || undefined,
      address: address.trim() || undefined,
      pinCode: pinCode.trim() || undefined,
      password,
      referralCode: referralCode.trim().toUpperCase() || undefined,
      side
    };

    try {
      // Step 1: Create Main ID account
      const regRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const regData = await regRes.json();

      if (!regRes.ok || !regData.success) {
        throw new Error(regData.error?.message || "Registration checkout failed.");
      }

      const mainToken = regData.data.token;
      const mainMember = regData.data.member || {};

      // Initialize auth status in React Context
      login(mainToken, "MEMBER", mainMember, regData.data.loginContext);

      setCreatedMember(mainMember);

      // Add main card to table output
      const mainCard = (mainMember.idCards || []).find((c: any) => c.type === "MAIN");
      const cardsList: any[] = [];
      if (mainCard) {
        cardsList.push({
          cardNumber: mainCard.cardNumber,
          type: "MAIN",
          placedUnder: "ROOT",
          side,
          poolPosition: null
        });
      }

      // Step 2: Purchase extra Sub ID cards if qty > 1
      if (qty > 1) {
        try {
          const subRes = await fetch("/api/id-cards/purchase-additional", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${mainToken}`
            },
            body: JSON.stringify({ count: qty - 1 })
          });
          const subData = await subRes.json();
          if (subRes.ok && subData.success && Array.isArray(subData.data.cards)) {
            subData.data.cards.forEach((c: any) => {
              cardsList.push({
                cardNumber: c.cardNumber,
                type: c.type || "SUB",
                placedUnder: c.placedUnder || "ROOT",
                side: c.side || "-",
                poolPosition: c.poolPosition
              });
            });
          }
        } catch (subErr) {
          console.warn("Sub IDs creation had minor issues:", subErr);
        }
      }

      setAllCreatedCards(cardsList);
      handleGoToStep(5);

    } catch (err: any) {
      setSubmitError(err.message || "Failed to finalize registration.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleQtyChange = (val: number) => {
    setQty(Math.min(10, Math.max(1, val)));
  };

  // Stepper CSS
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

    .brand { display: flex; align-items: center; gap: 10px; font-weight: 700; }
    .brand-badge {
      width: 34px; height: 34px; border-radius: 50%;
      background: radial-gradient(circle at center, var(--amber) 0 26%, var(--teal) 27% 54%, var(--navy-2) 55% 100%);
    }

    .container { width: min(680px, calc(100% - 32px)); margin: 24px auto 40px; }

    .card {
      background: var(--card); border: 1px solid var(--border);
      border-radius: var(--radius-card); box-shadow: var(--shadow);
    }

    .panel { padding: 22px; }
    .panel h2 { font-size: 20px; color: var(--navy); margin-bottom: 6px; }
    .panel .subtitle { color: var(--muted); font-size: 14px; margin-bottom: 16px; }

    .stepper {
      display: flex; gap: 6px; margin-bottom: 20px; flex-wrap: wrap;
    }
    .step-dot {
      display: flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 700;
      color: var(--muted); padding: 6px 10px; border-radius: 999px; border: 1px solid var(--border);
    }
    .step-dot.active { background: var(--navy); color: #fff; border-color: var(--navy); }
    .step-dot.done { background: #e8f8ee; color: var(--success); border-color: #b7e4c7; }

    .field-label { display: block; font-size: 13px; font-weight: 700; color: var(--navy); margin: 14px 0 6px; }
    .field-label .hindi { font-weight: 400; color: var(--muted); }

    input, select {
      width: 100%; border: 1px solid var(--border); border-radius: 10px;
      padding: 12px; font-size: 15px; color: var(--navy); background: #fff; outline: none;
    }
    input:focus, select:focus { border-color: var(--teal); }

    .radio-group { display: grid; gap: 10px; margin-top: 8px; }
    .radio-item {
      border: 1px solid var(--border); border-radius: 10px; padding: 12px;
      display: flex; gap: 10px; align-items: flex-start; cursor: pointer;
    }
    .radio-item input { width: auto; margin-top: 3px; accent-color: var(--teal); }
    .radio-item.selected { border-color: var(--teal); background: #f3fbfb; }

    .btn-primary {
      width: 100%; margin-top: 16px; background: var(--teal); color: #fff; border: none;
      padding: 14px 16px; border-radius: var(--radius-btn); font-size: 15px; font-weight: 700; cursor: pointer;
    }
    .btn-primary:hover { background: var(--teal-dark); }
    .btn-primary:disabled { background: #94a3b8; cursor: not-allowed; }

    .btn-ghost {
      width: 100%; margin-top: 10px; background: #fff; color: var(--navy);
      border: 1px solid var(--border); padding: 12px; border-radius: var(--radius-btn);
      font-size: 14px; font-weight: 700; cursor: pointer;
    }

    .note {
      border-left: 4px solid var(--teal); background: #f3fbfb; color: #155e5e;
      padding: 11px 12px; border-radius: 8px; font-size: 13px; margin-top: 14px;
    }
    .note.warning { border-left-color: var(--warning); background: #fff8e9; color: #7c4a03; }
    .note.info { border-left-color: var(--info); background: #e8f4fd; color: #0c4a6e; }
    .note.error { border-left-color: var(--danger); background: #fee2e2; color: #991b1b; }

    .confirm-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 14px; }
    .confirm-item {
      border: 1px solid var(--border); border-radius: 10px; padding: 12px; background: #fbfdff;
    }
    .confirm-item .label { font-size: 12px; color: var(--muted); }
    .confirm-item .value { font-size: 15px; font-weight: 700; color: var(--navy); margin-top: 3px; }

    .badge { display: inline-flex; padding: 3px 9px; border-radius: 999px; font-size: 11.5px; font-weight: 700; }
    .badge.success { background: #e8f8ee; color: var(--success); }
    .badge.info { background: #e8f6ff; color: var(--info); }

    .toggle-link { text-align: center; margin-top: 12px; font-size: 13px; }
    .toggle-link a { color: var(--teal); text-decoration: none; font-weight: 700; }

    .qty-stepper {
      display: flex; align-items: center; gap: 16px;
      margin: 16px 0 12px; padding: 14px; border: 1px dashed var(--border);
      border-radius: 10px; background: #fbfdff;
    }
    .qty-stepper .label { font-size: 13px; color: var(--navy); font-weight: 600; flex: 1; text-align: left; }
    .qty-stepper .label .hindi { display: block; color: var(--muted); font-weight: 400; font-size: 11.5px; margin-top: 2px; }
    .qty-controls { display: flex; align-items: center; gap: 10px; }
    .qty-btn {
      width: 36px; height: 36px; border-radius: 10px; border: 1px solid var(--border);
      background: #fff; font-size: 18px; font-weight: 800; color: var(--navy);
      cursor: pointer; display: grid; place-items: center; line-height: 1;
    }
    .qty-btn:hover { background: var(--navy); color: #fff; }
    .qty-btn:disabled { opacity: 0.4; cursor: default; }
    .qty-val { font-size: 24px; font-weight: 800; color: var(--navy); min-width: 32px; text-align: center; }

    .kit-list { margin-top: 14px; display: grid; gap: 8px; }
    .kit-item {
      display: flex; align-items: center; gap: 10px;
      padding: 10px 12px; background: #fbfdff; border: 1px solid var(--border);
      border-radius: 10px; font-size: 14px; color: var(--navy);
    }
    .kit-check { color: var(--success); font-weight: 800; }

    .price-row {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 14px; padding: 14px 16px;
      border: 1px solid var(--border); border-radius: 10px; background: #fff;
    }
    .price-row .plabel { color: var(--muted); font-size: 13px; text-align: left; }
    .price-row .ptotal { font-size: 22px; font-weight: 800; color: var(--navy); }

    .result-table { width: 100%; border-collapse: collapse; margin-top: 14px; }
    .result-table th, .result-table td {
      border: 1px solid var(--border); padding: 9px 10px; text-align: left; font-size: 13px;
    }
    .result-table th { background: #f8fafc; color: var(--navy); font-weight: 700; }
    .result-table .type-main { background: #e8f8ee; color: var(--success); padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
    .result-table .type-sub { background: #e8f6ff; color: var(--info); padding: 2px 8px; border-radius: 999px; font-size: 11px; font-weight: 700; }
  `;

  return (
    <div style={{ background: "linear-gradient(180deg, #f8fbff 0%, var(--bg) 100%)", minHeight: "100vh" }}>
      <style dangerouslySetInnerHTML={{ __html: styles }} />
      
      {/* Top Header */}
      <header className="topbar">
        <div className="brand"><span className="brand-badge"></span><span>Bharatiya Bazaar · भारतीय बाज़ार</span></div>
        <Link to="/" style={{ color: "#fff", textDecoration: "none", fontSize: "14px" }}>← Home</Link>
      </header>

      <main className="container" style={{ padding: "20px 0" }}>
        
          {/* REGISTER TABS */}
          <div>
            <div className="stepper">
              <span className={`step-dot ${step === 1 ? "active" : step > 1 ? "done" : ""}`}>1 Eligibility</span>
              <span className={`step-dot ${step === 2 ? "active" : step > 2 ? "done" : ""}`}>2 Basic Info</span>
              <span className={`step-dot ${step === 3 ? "active" : step > 3 ? "done" : ""}`}>3 Sponsor</span>
              <span className={`step-dot ${step === 4 ? "active" : step > 4 ? "done" : ""}`}>4 Payment</span>
              <span className={`step-dot ${step === 5 ? "active" : step > 5 ? "done" : ""}`}>5 Confirm</span>
            </div>

            {/* STEP 1: ELIGIBILITY CHECK */}
            {step === 1 && (
              <section className="card panel">
                <h2>Let's confirm you're eligible</h2>
                <p className="subtitle">Three quick questions · पात्रता जाँच</p>

                <div className="radio-group">
                  <label className="radio-item">
                    <input type="checkbox" checked={elig1} onChange={e => setElig1(e.target.checked)} />
                    I am an Indian citizen aged 18+
                  </label>
                  <label className="radio-item">
                    <input type="checkbox" checked={elig2} onChange={e => setElig2(e.target.checked)} />
                    I agree to the Terms & Conditions
                  </label>
                  <label className="radio-item">
                    <input type="checkbox" checked={elig3} onChange={e => setElig3(e.target.checked)} />
                    I understand this is a business opportunity
                  </label>
                </div>

                {step1Error && <div className="note error">Please check all boxes to continue.</div>}

                <button className="btn-primary" onClick={() => handleGoToStep(2)}>Continue</button>

                <div className="toggle-link">
                  Already a member? <Link to="/login">Login Here</Link>
                </div>
              </section>
            )}

            {/* STEP 2: PROFILE PROFILE DETAILS */}
            {step === 2 && (
              <section className="card panel">
                <h2>Tell us about yourself</h2>
                <p className="subtitle">All fields are mandatory · अपनी जानकारी दें</p>

                <label className="field-label">Full Name <span className="hindi">पूरा नाम</span></label>
                <input type="text" placeholder="e.g. Amit Shah" value={name} onChange={e => setName(e.target.value)} required />

                <label className="field-label">Mobile Number (10 digits) <span className="hindi">मोबाइल नंबर</span></label>
                <input type="tel" placeholder="9876543210" maxLength={10} value={mobile} onChange={e => setMobile(e.target.value)} required />

                <label className="field-label">Email Address (Optional) <span className="hindi">ईमेल पता</span></label>
                <input type="email" placeholder="your@email.com" value={email} onChange={e => setEmail(e.target.value)} />

                <label className="field-label">Address (Optional) <span className="hindi">पता</span></label>
                <input type="text" placeholder="House no, street, area" value={address} onChange={e => setAddress(e.target.value)} />

                <label className="field-label">PIN Code (Optional) <span className="hindi">पिन कोड</span></label>
                <input type="text" placeholder="e.g. 401303" maxLength={6} value={pinCode} onChange={e => setPinCode(e.target.value)} />

                <label className="field-label">Create Password <span className="hindi">पासवर्ड बनाएं</span></label>
                <input type="password" placeholder="Min 6 characters" value={password} onChange={e => setPassword(e.target.value)} required />

                <label className="field-label">Confirm Password</label>
                <input type="password" placeholder="Re-enter password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required />

                {step2Error && <div className="note error">{step2Error}</div>}

                <button className="btn-primary" onClick={() => handleGoToStep(3)}>Continue</button>
                <button className="btn-ghost" onClick={() => handleGoToStep(1)}>Back</button>
              </section>
            )}

            {/* STEP 3: SPONSOR SELECTION */}
            {step === 3 && (
              <section className="card panel">
                <h2>Who invited you?</h2>
                <p className="subtitle">Confirm your sponsor and placement</p>

                {validatingSponsor && <div className="note info">Validating sponsor...</div>}
                {sponsorError && <div className="note error">{sponsorError}</div>}

                {sponsorName ? (
                  <div>
                    <div className="confirm-item" style={{ padding: "14px", borderStyle: "dashed" }}>
                      <div className="label">Sponsor</div>
                      <div className="value" style={{ color: "var(--teal)", fontSize: "16px" }}>{sponsorName}</div>
                      <div className="value" style={{ fontSize: "13px", opacity: 0.8 }}>Code: {referralCode}</div>
                    </div>

                    <label className="field-label" style={{ marginTop: "18px" }}>Your Placement <span className="hindi">आपका प्लेसमेंट</span></label>
                    <div className="confirm-item" style={{ padding: "14px", borderStyle: "dashed" }}>
                      <div className="value" style={{ color: "var(--navy)" }}>
                        {side === "RIGHT" ? "➡ RIGHT LEG" : "⬅ LEFT LEG"}
                      </div>
                      <div className="label" style={{ marginTop: "4px" }}>Locked by your sponsor. Cannot be changed.</div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="field-label">Sponsor ID (Optional)</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input
                        type="text"
                        placeholder="e.g. BB10005"
                        value={referralCode}
                        onChange={e => setReferralCode(e.target.value.toUpperCase())}
                      />
                      <button type="button" className="topbar-btn primary" onClick={handleManualVerifySponsor} style={{ padding: "8px 16px" }}>
                        Verify
                      </button>
                    </div>
                  </div>
                )}

                <button className="btn-primary" onClick={() => handleGoToStep(4)} style={{ marginTop: "20px" }}>Continue</button>
                <button className="btn-ghost" onClick={() => handleGoToStep(2)}>Back</button>
              </section>
            )}

            {/* STEP 4: PAYMENT SELECTION */}
            {step === 4 && (
              <section className="card panel">
                <h2>Activate your membership</h2>
                <p className="subtitle">Joining kit · सदस्यता सक्रिय करें</p>

                <div className="kit-list">
                  <div className="kit-item"><span className="kit-check">✓</span> 1 MAIN ID · ACB eligibility · Sponsor bonuses</div>
                  <div className="kit-item"><span className="kit-check">✓</span> AutoPool entry for every ID created</div>
                  <div className="kit-item"><span className="kit-check">✓</span> Auto-placed in MY SYSTEM tree</div>
                </div>

                {/* Quantity Stepper */}
                <div className="qty-stepper">
                  <div className="label">
                    How many IDs?
                    <span className="hindi">कितने ID खरीदना चाहते हैं?</span>
                  </div>
                  <div className="qty-controls">
                    <button className="qty-btn" type="button" onClick={() => handleQtyChange(qty - 1)} disabled={qty <= 1}>−</button>
                    <span className="qty-val">{qty}</span>
                    <button className="qty-btn" type="button" onClick={() => handleQtyChange(qty + 1)} disabled={qty >= 10}>+</button>
                  </div>
                </div>

                <div className="price-row">
                  <div>
                    <div className="plabel">₹600 × {qty} ID(s)</div>
                    <div className="plabel muted" style={{ fontSize: "11.5px", marginTop: "2px" }}>1 MAIN + {qty - 1} SUB</div>
                  </div>
                  <div className="ptotal">₹{(600 * qty).toFixed(2)}</div>
                </div>

                {submitError && <div className="note error">{submitError}</div>}

                <button className="btn-primary" onClick={handleRegisterSubmit} disabled={submitting}>
                  {submitting ? "Processing Activation..." : qty === 1 ? "Pay ₹600 & Activate" : `Pay ₹${(600 * qty).toLocaleString()} & Create ${qty} IDs`}
                </button>
                <button className="btn-ghost" onClick={() => handleGoToStep(3)}>Back</button>

                <div className="note" style={{ marginTop: "14px" }}>
                  <strong>💡 Why buy more?</strong> Each extra SUB ID earns independently in AutoPool and strengthens your MY SYSTEM legs. ACB belongs to your MAIN ID only.
                </div>
              </section>
            )}

            {/* STEP 5: REGISTRATION COMPLETE CONFIRMATION */}
            {step === 5 && (
              <section className="card panel">
                <h2>Welcome to Bharatiya Bazaar! 🎉</h2>
                <p className="subtitle">Your membership is active.</p>

                <div className="confirm-grid">
                  <div className="confirm-item">
                    <div className="label">Your MAIN ID</div>
                    <div className="value">{createdMember?.memberCode || "—"}</div>
                  </div>
                  <div className="confirm-item">
                    <div className="label">Your Name</div>
                    <div className="value">{createdMember?.name || "—"}</div>
                  </div>
                  <div className="confirm-item">
                    <div className="label">Mobile</div>
                    <div className="value">{createdMember?.mobile || "—"}</div>
                  </div>
                  <div className="confirm-item">
                    <div className="label">Total IDs Created</div>
                    <div className="value">
                      {allCreatedCards.length} <span className="badge success">Live</span>
                    </div>
                  </div>
                </div>

                {allCreatedCards.length > 0 && (
                  <div style={{ marginTop: "18px" }}>
                    <h3 style={{ color: "var(--navy)", fontSize: "16px", marginBottom: "4px" }}>All Your ID Cards</h3>
                    <p className="subtitle" style={{ fontSize: "12.5px" }}>Every ID is placed automatically in MY SYSTEM and AutoPool.</p>
                    <table className="result-table">
                      <thead>
                        <tr>
                          <th>Card Number</th>
                          <th>Type</th>
                          <th>Placed Under (MY SYSTEM)</th>
                          <th>AutoPool Pos.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allCreatedCards.map((c, idx) => (
                          <tr key={idx}>
                            <td><strong>{c.cardNumber}</strong></td>
                            <td><span className={c.type === "MAIN" ? "type-main" : "type-sub"}>{c.type}</span></td>
                            <td>{c.placedUnder} ({c.side})</td>
                            <td>{c.poolPosition ? `#${c.poolPosition}` : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                <button className="btn-primary" onClick={() => navigate("/dashboard")} style={{ marginTop: "20px" }}>
                  Go to My Dashboard →
                </button>
              </section>
            )}
          </div>
      </main>
    </div>
  );
}
