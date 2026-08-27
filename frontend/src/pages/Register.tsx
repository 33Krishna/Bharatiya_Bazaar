import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { UserPlus, ShieldAlert, ArrowLeft, CheckCircle2, Search } from "lucide-react";

export default function Register() {
  const [name, setName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState("");
  const [side, setSide] = useState<"LEFT" | "RIGHT">("LEFT");
  
  const [sponsorName, setSponsorName] = useState<string | null>(null);
  const [validatingSponsor, setValidatingSponsor] = useState(false);
  const [sponsorError, setSponsorError] = useState<string | null>(null);
  
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleValidateSponsor = async () => {
    if (!referralCode.trim()) {
      setSponsorError("Please enter a sponsor code first.");
      return;
    }
    setValidatingSponsor(true);
    setSponsorError(null);
    setSponsorName(null);

    try {
      const res = await fetch(`/api/auth/validate-referral?code=${referralCode.trim()}`);
      const data = await res.json();
      if (data.success) {
        setSponsorName(data.data.name);
      } else {
        setSponsorError(data.error?.message || "Sponsor not found or invalid.");
      }
    } catch (e) {
      setSponsorError("Error connecting to verification service.");
    } finally {
      setValidatingSponsor(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !mobile || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    if (referralCode.trim() && !sponsorName) {
      setError("Please validate the sponsor code before submitting.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mobile,
          email: email || undefined,
          address: address || undefined,
          pinCode: pinCode || undefined,
          password,
          referralCode: referralCode.trim() || undefined,
          side
        })
      });

      const data = await res.json();

      if (data.success) {
        login(data.data.token, "MEMBER", data.data.member, data.data.loginContext);
        navigate("/dashboard");
      } else {
        setError(data.error?.message || "Registration failed. Please check inputs.");
      }
    } catch (err) {
      console.error(err);
      setError("Server connection failure. Please verify backend state.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: "560px", margin: "40px auto", padding: "0 20px" }}>
      <div style={{ marginBottom: "24px" }}>
        <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "var(--text-secondary)" }}>
          <ArrowLeft size={16} /> Back to home
        </Link>
      </div>

      <div className="glass-card">
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <h2 style={{ fontSize: "28px", fontWeight: 800 }}>Member Registration</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Purchase a main ID card to join the cooperative network
          </p>
        </div>

        {error && (
          <div className="alert-box alert-danger">
            <ShieldAlert size={18} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister}>
          <div className="grid-cols-2" style={{ display: "grid", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="e.g. Rahul Sharma"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Mobile Number *</label>
              <input
                type="text"
                className="form-input"
                placeholder="10-digit number"
                value={mobile}
                onChange={e => setMobile(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid-cols-2" style={{ display: "grid", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Email Address (Optional)</label>
              <input
                type="email"
                className="form-input"
                placeholder="name@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">PIN Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="6-digit PIN"
                value={pinCode}
                onChange={e => setPinCode(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Residential Address</label>
            <input
              type="text"
              className="form-input"
              placeholder="House, Street, Area details"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">Select Password *</label>
            <input
              type="password"
              className="form-input"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Sponsor Section */}
          <div
            style={{
              background: "rgba(255,255,255,0.01)",
              border: "1px solid rgba(255,255,255,0.05)",
              borderRadius: "var(--radius-sm)",
              padding: "16px",
              margin: "24px 0"
            }}
          >
            <h4 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>Sponsor & Tree Placement</h4>
            
            <div className="form-group">
              <label className="form-label">Sponsor ID Card / Member Code</label>
              <div style={{ display: "flex", gap: "8px" }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="e.g. BB10001"
                  value={referralCode}
                  onChange={e => {
                    setReferralCode(e.target.value);
                    setSponsorName(null);
                  }}
                />
                <button
                  type="button"
                  onClick={handleValidateSponsor}
                  className="btn btn-secondary"
                  disabled={validatingSponsor}
                >
                  <Search size={16} /> Verify
                </button>
              </div>
            </div>

            {sponsorName && (
              <div style={{ color: "var(--success)", fontSize: "13px", fontWeight: 600, display: "flex", alignItems: "center", gap: "6px", margin: "8px 0" }}>
                <CheckCircle2 size={16} /> Verified Sponsor: {sponsorName}
              </div>
            )}

            {sponsorError && (
              <div style={{ color: "var(--error)", fontSize: "13px", fontWeight: 600, margin: "8px 0" }}>
                ⚠️ {sponsorError}
              </div>
            )}

            <div className="form-group" style={{ marginTop: "12px", marginBottom: 0 }}>
              <label className="form-label">Tree Placement Side</label>
              <select
                className="form-select"
                value={side}
                onChange={e => setSide(e.target.value as "LEFT" | "RIGHT")}
              >
                <option value="LEFT">LEFT Leg (Outer edge descent)</option>
                <option value="RIGHT">RIGHT Leg (Outer edge descent)</option>
              </select>
            </div>
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            <UserPlus size={18} /> {loading ? "Creating Account..." : "Register & Purchase ID"}
          </button>
        </form>

        <div style={{ marginTop: "24px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "20px", textAlign: "center", fontSize: "14px" }}>
          <span style={{ color: "var(--text-secondary)" }}>Already registered?</span>{" "}
          <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
