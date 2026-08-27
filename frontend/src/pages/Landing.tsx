import React from "react";
import { Link } from "react-router-dom";

export default function Landing() {
  const css = `
    .landing-body {
      font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif;
      background: #F8F9FA;
      color: #1f2a3a;
      line-height: 1.6;
      margin: 0;
      padding: 0;
    }
    
    /* Top Utility Bar */
    .utility-bar {
      background: #12294c;
      color: #fff;
      font-size: 13px;
      padding: 6px 16px;
    }
    .utility-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    .utility-links { display: flex; gap: 14px; align-items: center; }
    .utility-links a { color: rgba(255,255,255,0.85); transition: color 0.15s; text-decoration: none; }
    .utility-links a:hover { color: #fff; text-decoration: underline; }

    /* Main Navigation */
    .header {
      position: sticky;
      top: 0;
      z-index: 50;
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(8px);
      border-bottom: 1px solid #e4e9f0;
    }
    .nav-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 800;
      font-size: 18px;
      color: #1B3A6B;
      text-decoration: none;
    }
    .brand-badge {
      width: 36px; height: 36px; border-radius: 50%;
      background: radial-gradient(circle at center, #B8860B 0 26%, #1A6B5A 27% 54%, #1B3A6B 55% 100%);
      flex-shrink: 0;
    }
    .nav-menu {
      display: flex;
      gap: 18px;
      align-items: center;
      font-size: 14.5px;
      font-weight: 600;
    }
    .nav-menu a { color: #1B3A6B; transition: color 0.15s; text-decoration: none; }
    .nav-menu a:hover { color: #1A6B5A; }

    .nav-actions { display: flex; gap: 8px; align-items: center; }
    
    .btn-landing {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
      border: 1px solid transparent;
      text-decoration: none;
    }
    .btn-landing-primary { background: #1A6B5A; color: #fff; }
    .btn-landing-primary:hover { background: #135241; }
    .btn-landing-secondary { background: #1B3A6B; color: #fff; }
    .btn-landing-secondary:hover { background: #12294c; }
    .btn-landing-outline { border-color: #e4e9f0; background: #fff; color: #1B3A6B; }
    .btn-landing-outline:hover { background: #f1f5f9; }

    /* Hero Section */
    .hero {
      background: linear-gradient(135deg, #1B3A6B 0%, #12294c 100%);
      color: #fff;
      padding: 70px 16px 60px;
      text-align: center;
    }
    .hero-container { max-width: 900px; margin: 0 auto; }
    .hero h1 { font-family: 'Poppins', sans-serif; font-size: clamp(28px, 4.5vw, 46px); font-weight: 800; margin-bottom: 16px; line-height: 1.2; }
    .hero p { font-size: clamp(15px, 2vw, 18px); color: rgba(255,255,255,0.9); margin-bottom: 28px; line-height: 1.6; }
    .hero-cta { display: flex; justify-content: center; gap: 14px; flex-wrap: wrap; }

    /* Feature Pillars */
    .section { padding: 60px 16px; }
    .container { max-width: 1200px; margin: 0 auto; }
    .section-head { text-align: center; max-width: 700px; margin: 0 auto 40px; }
    .section-head h2 { font-family: 'Poppins', sans-serif; font-size: clamp(24px, 3vw, 32px); color: #1B3A6B; margin-bottom: 8px; line-height: 1.2; }
    .section-head p { color: #5b6b7f; font-size: 15px; }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 20px;
    }
    .card-landing {
      background: #ffffff;
      border: 1px solid #e4e9f0;
      border-radius: 12px;
      padding: 26px;
      box-shadow: 0 10px 30px rgba(27,58,107,.10);
    }
    .card-landing h3 { font-family: 'Poppins', sans-serif; font-size: 18px; color: #1B3A6B; margin-bottom: 8px; line-height: 1.2; }
    .card-landing p { font-size: 14px; color: #5b6b7f; line-height: 1.5; margin-bottom: 14px; }

    /* Footer */
    .footer {
      background: #12294c;
      color: #fff;
      padding: 40px 16px 20px;
      font-size: 13.5px;
    }
    .footer-inner {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 24px;
      margin-bottom: 30px;
    }
    .footer-col h4 { font-family: 'Poppins', sans-serif; font-size: 15px; margin-bottom: 12px; color: #B8860B; line-height: 1.2; }
    .footer-col ul { list-style: none; display: grid; gap: 6px; padding: 0; margin: 0; }
    .footer-col a { color: rgba(255,255,255,0.8); text-decoration: none; }
    .footer-col a:hover { color: #fff; text-decoration: underline; }
    .footer-bottom {
      max-width: 1200px;
      margin: 0 auto;
      padding-top: 16px;
      border-top: 1px solid rgba(255,255,255,0.1);
      text-align: center;
      color: rgba(255,255,255,0.6);
      font-size: 12px;
    }

    @media (max-width: 860px) {
      .grid-3 { grid-template-columns: 1fr; }
      .footer-inner { grid-template-columns: repeat(2, 1fr); }
      .nav-menu { display: none; }
    }
  `;

  return (
    <div className="landing-body">
      <style dangerouslySetInnerHTML={{ __html: css }} />

      {/* TOP UTILITY BAR */}
      <div className="utility-bar">
        <div className="utility-inner">
          <div>🇮🇳 स्वदेशी सामुदायिक मंच · Bharatiya Bazaar Commerce Network</div>
          <div className="utility-links">
            <Link to="/login">हिंदी पोर्टल (Hindi)</Link>
            <span>·</span>
            <Link to="/wallet?guest=true">कैलकुलेटर</Link>
            <span>·</span>
            <Link to="/login">प्रशासक लॉगिन (Admin)</Link>
          </div>
        </div>
      </div>

      {/* MAIN HEADER */}
      <header className="header">
        <div className="nav-container">
          <Link to="/" className="brand">
            <span className="brand-badge"></span>
            <span>Bharatiya Bazaar</span>
          </Link>
          <nav className="nav-menu">
            <Link to="/dashboard">Member Portal</Link>
            <Link to="/setu-kosh">Setu Kosh</Link>
            <Link to="/wallet?guest=true">Calculator</Link>
            <Link to="/dashboard">Notifications</Link>
            <Link to="/vendor-register">Merchant Onboarding</Link>
          </nav>
          <div className="nav-actions">
            <Link to="/register" className="btn-landing btn-landing-primary">Join as Member</Link>
            <Link to="/login" className="btn-landing btn-landing-outline">Sign In</Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION */}
      <section className="hero">
        <div className="hero-container">
          <h1>Shop Local. Refer Friends. Earn Together.</h1>
          <p>
            भारतीय बाज़ार — A revolutionary tri-stream community commerce engine. Earn non-working AutoPool payouts, 10-level MY SYSTEM binary team commissions, and shopping margin rewards through Setu Kosh!
          </p>
          <div className="hero-cta">
            <Link to="/register" className="btn-landing btn-landing-primary" style={{ fontSize: "16px", padding: "12px 24px" }}>Start Earning (Member Registration) →</Link>
            <Link to="/vendor-register" className="btn-landing btn-landing-secondary" style={{ fontSize: "16px", padding: "12px 24px" }}>Register as Merchant (दुकानदार पंजीकरण)</Link>
          </div>
        </div>
      </section>

      {/* THREE INCOME PILLARS */}
      <section className="section">
        <div className="container">
          <div className="section-head">
            <h2>Three Synergistic Income Streams</h2>
            <p>A unified mathematical model built for statutory compliance, fast weekly settlements, and sustainable growth.</p>
          </div>

          <div className="grid-3">
            {/* Pillar 1 */}
            <div className="card-landing">
              <h3>1. AutoPool Global (2x2 BFS)</h3>
              <p>National auto-filling binary matrix providing up to 6 cycles of payouts and automated rebirth sub-IDs.</p>
              <Link to="/autopool" className="btn-landing btn-landing-outline" style={{ width: "100%" }}>Explore AutoPool →</Link>
            </div>

            {/* Pillar 2 */}
            <div className="card-landing">
              <h3>2. MY SYSTEM (10-Level)</h3>
              <p>Direct sponsorship tree rewarding your personal team growth with 10-level direct referral commissions.</p>
              <Link to="/my-system" className="btn-landing btn-landing-outline" style={{ width: "100%" }}>Inspect MY SYSTEM →</Link>
            </div>

            {/* Pillar 3 */}
            <div className="card-landing">
              <h3>3. Setu Kosh (Shopping Rewards)</h3>
              <p>Every purchase at local verified merchants accumulates margin towards free sub-IDs and binary tree payouts.</p>
              <Link to="/setu-kosh" className="btn-landing btn-landing-outline" style={{ width: "100%" }}>Setu Kosh Rewards →</Link>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="footer">
        <div className="footer-inner">
          <div className="footer-col">
            <h4>Bharatiya Bazaar</h4>
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", marginBottom: "8px" }}>
              Empowering local commerce through transparent, mathematical community commission distribution.
            </p>
          </div>
          <div className="footer-col">
            <h4>Member Portals</h4>
            <ul>
              <li><Link to="/register">Member Registration</Link></li>
              <li><Link to="/login">Member Login &amp; Wallet</Link></li>
              <li><Link to="/login">हिंदी डैशबोर्ड (Hindi Portal)</Link></li>
              <li><Link to="/wallet?guest=true">TDS &amp; Withdrawal Calculator</Link></li>
              <li><Link to="/dashboard">Notifications Center</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Merchant &amp; Operations</h4>
            <ul>
              <li><Link to="/vendor-register">Merchant Onboarding</Link></li>
              <li><Link to="/vendor-dashboard">Merchant Dashboard</Link></li>
              <li><Link to="/vendor-settlements">Settlements Explorer</Link></li>
              <li><Link to="/login">Admin Governance Portal</Link></li>
            </ul>
          </div>
          <div className="footer-col">
            <h4>Compliance &amp; Legal</h4>
            <ul>
              <li><Link to="/wallet?guest=true">Section 194H / 194R / 194C TDS</Link></li>
              <li><Link to="/login">Component Design System</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          &copy; 2026 Bharatiya Bazaar (भारतीय बाज़ार). All Rights Reserved. Fully compliant with Indian Income Tax &amp; GST regulations.
        </div>
      </footer>
    </div>
  );
}
