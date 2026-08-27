import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Store, ShieldAlert, ArrowLeft } from "lucide-react";

export default function VendorRegister() {
  const [name, setName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [category, setCategory] = useState("GENERAL");
  const [gstin, setGstin] = useState("");
  const [panNumber, setPanNumber] = useState("");
  const [address, setAddress] = useState("");
  const [pinCode, setPinCode] = useState("");
  const [payoutMethod, setPayoutMethod] = useState("BANK");
  const [referrerCode, setReferrerCode] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !businessName || !mobile || !password) {
      setError("Please fill in all required fields.");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/vendors/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          businessName,
          mobile,
          password,
          category,
          gstin: gstin || undefined,
          panNumber: panNumber || undefined,
          address: address || undefined,
          pinCode: pinCode || undefined,
          payoutMethod,
          referrerCode: referrerCode.trim() || undefined
        })
      });

      const data = await res.json();

      if (data.success) {
        // Automatically login on success
        const loginRes = await fetch("/api/vendors/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mobile, password })
        });
        const loginData = await loginRes.json();
        
        if (loginData.success) {
          login(loginData.data.token, "VENDOR", loginData.data.vendor, null);
          navigate("/vendor-dashboard");
        } else {
          navigate("/login");
        }
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
          <h2 style={{ fontSize: "28px", fontWeight: 800 }}>Partner Merchant Signup</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
            Register your store outlet to receive cooperative buyer traffic
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
              <label className="form-label">Owner Full Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Rahul Sen"
                value={name}
                onChange={e => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Business / Shop Name *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Sharma Grocery Store"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid-cols-2" style={{ display: "grid", gap: "16px" }}>
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
          </div>

          <div className="grid-cols-2" style={{ display: "grid", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Business Category</label>
              <select className="form-select" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="GROCERY">Grocery (7% Platform Margin)</option>
                <option value="APPAREL">Apparel (15% Platform Margin)</option>
                <option value="ELECTRONICS">Electronics (10% Platform Margin)</option>
                <option value="RESTAURANT">Restaurant (12% Platform Margin)</option>
                <option value="GENERAL">General (10% Platform Margin)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Settlement Mode</label>
              <select className="form-select" value={payoutMethod} onChange={e => setPayoutMethod(e.target.value)}>
                <option value="BANK">Direct Bank Account Payout (10% admin charge)</option>
                <option value="WALLET">Cooperative Wallet credit (5% admin charge)</option>
              </select>
            </div>
          </div>

          <div className="grid-cols-2" style={{ display: "grid", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Shop GSTIN (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="15-digit GSTIN"
                value={gstin}
                onChange={e => setGstin(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">PAN Number (Optional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="10-digit PAN"
                value={panNumber}
                onChange={e => setPanNumber(e.target.value)}
              />
            </div>
          </div>

          <div className="grid-cols-2" style={{ display: "grid", gap: "16px" }}>
            <div className="form-group">
              <label className="form-label">Store Location Address</label>
              <input
                type="text"
                className="form-input"
                placeholder="Shop address details"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Store PIN Code</label>
              <input
                type="text"
                className="form-input"
                placeholder="6-digit PIN"
                value={pinCode}
                onChange={e => setPinCode(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group" style={{ margin: "16px 0 24px 0" }}>
            <label className="form-label">Referrer Member Code / Sponsor Card</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. BB10001 (Earns them a permanent 0.25% referral reward!)"
              value={referrerCode}
              onChange={e => setReferrerCode(e.target.value)}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            <Store size={18} /> {loading ? "Registering Shop..." : "Partner Merchant Register"}
          </button>
        </form>

        <div style={{ marginTop: "24px", borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "20px", textAlign: "center", fontSize: "14px" }}>
          <span style={{ color: "var(--text-secondary)" }}>Already registered shop?</span>{" "}
          <Link to="/login" style={{ color: "var(--primary)", fontWeight: 600 }}>
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}
