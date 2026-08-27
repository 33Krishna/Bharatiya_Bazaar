import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function AutoPool() {
  const { token, loginContext, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  
  // Data from tree endpoint
  const [autopoolData, setAutopoolData] = useState<any>(null);
  const [activeTree, setActiveTree] = useState<any>(null);
  const [viewRootNode, setViewRootNode] = useState<any>(null);
  const [globalTree, setGlobalTree] = useState<any>(null);
  const [levelStatus, setLevelStatus] = useState<any[]>([]);

  // Search/Explorer
  const [exploreInput, setExploreInput] = useState("");
  const [rootHistory, setRootHistory] = useState<any[]>([]);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  // Zoom
  const [zoom, setZoom] = useState(100);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});

  // Full Profile Modal
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [modalNode, setModalNode] = useState<any>(null);

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
      const [profileRes, poolRes] = await Promise.all([
        fetch("/api/members/profile", { headers }).then(r => r.json()),
        fetch("/api/members/autopool-tree", { headers }).then(r => r.json())
      ]);

      if (profileRes.success) setProfile(profileRes.data);
      if (poolRes.success && poolRes.myStats) {
        setAutopoolData(poolRes.myStats);
        setActiveTree(poolRes.myTree);
        setGlobalTree(poolRes.globalTree);
        setLevelStatus(poolRes.levelStatus || []);
        setSelectedNode(poolRes.myTree);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const countSubtree = (node: any): number => {
    if (!node || !node.filled) return 0;
    return 1 + countSubtree(node.children?.LEFT) + countSubtree(node.children?.RIGHT);
  };

  const findNode = (node: any, position: number): any => {
    if (!node) return null;
    if (node.position === position) return node;
    return findNode(node.children?.LEFT, position) || findNode(node.children?.RIGHT, position);
  };

  const explorePool = async (cardNumberOrPos: string, pushHistory = true) => {
    if (!cardNumberOrPos) return;
    try {
      const res = await fetch(`/api/members/autopool-explorer?root=${encodeURIComponent(cardNumberOrPos)}&depth=7`, {
        headers: { Authorization: `Bearer ${token}` }
      }).then(r => r.json());

      if (!res.success || !res.data || !res.data.tree) {
        alert(`⚠️ AutoPool node for "${cardNumberOrPos}" not found.`);
        return;
      }

      if (pushHistory && viewRootNode) {
        setRootHistory(prev => [
          ...prev,
          { position: viewRootNode.position, cardNumber: viewRootNode.cardNumber || viewRootNode.memberCode }
        ]);
      }

      setViewRootNode(res.data.rootNode);
      setActiveTree(res.data.tree);
      setSelectedNode(res.data.rootNode);
    } catch (err) {
      alert("Error searching AutoPool card.");
    }
  };

  const handleExploreSearch = () => {
    if (!exploreInput.trim()) return;
    explorePool(exploreInput.trim(), true);
  };

  const popExplorerHistory = () => {
    if (rootHistory.length === 0) {
      resetToMyPool();
      return;
    }
    const prev = rootHistory[rootHistory.length - 1];
    setRootHistory(prevList => prevList.slice(0, -1));
    explorePool(prev.cardNumber || prev.position, false);
  };

  const resetToMyPool = () => {
    setRootHistory([]);
    setViewRootNode(null);
    loadData();
  };

  const navigateToHistoryIdx = (idx: number, e: React.MouseEvent) => {
    e.preventDefault();
    const target = rootHistory[idx];
    setRootHistory(prevList => prevList.slice(0, idx));
    explorePool(target.cardNumber || target.position, false);
  };

  const formatINR = (paise: number) => {
    return "Rs." + (Number(paise) / 100).toLocaleString("en-IN", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  const toggleCollapse = (nodePos: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => ({
      ...prev,
      [nodePos]: !prev[nodePos]
    }));
  };

  const handleNodeClick = (node: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(node);
  };

  const handleOpenProfileModal = (node: any) => {
    setModalNode(node);
    setProfileModalOpen(true);
  };

  const renderNodeRecursively = (node: any, depth: number): React.ReactNode => {
    if (!node) return null;
    const isRoot = !viewRootNode ? node.position === activeTree?.position : node.position === viewRootNode?.position;
    
    if (node.filled) {
      const isMe = node.memberId === profile?.id;
      const isRebirth = node.cardType === "REBIRTH" || (node.cardNumber && node.cardNumber.startsWith("RB"));
      const isSubCard = node.cardType === "SUB" || (node.cardNumber && node.cardNumber.startsWith("SB"));
      const leftChild = node.children?.LEFT;
      const rightChild = node.children?.RIGHT;
      const hasChildren = leftChild || rightChild;
      const totalBelow = countSubtree(node) - 1;
      const isCollapsed = collapsedNodes[node.position] || false;

      let badgeHtml = "";
      if (isRebirth) badgeHtml = "🎭 REBIRTH";
      else if (isSubCard) badgeHtml = "SUB";

      const ownerLabel = (isSubCard || isRebirth) && node.memberCode
        ? `(owner ${node.memberCode})`
        : "";

      return (
        <li key={node.position} className={isCollapsed ? "collapsed" : ""}>
          <div
            className={`pool-node ${isMe || isRoot ? "me" : ""} ${isRebirth ? "rebirth" : ""} ${node.acbStatus ? "acb" : ""} ${selectedNode?.position === node.position ? "selected" : ""}`}
            onClick={(e) => handleNodeClick(node, e)}
          >
            <div className="pos">#{node.position}</div>
            <div className="name">{node.memberName}{isMe && " (You)"}</div>
            <div className="code">
              {node.cardNumber || node.memberCode}{" "}
              {badgeHtml && <span className="badge" style={{ background: isRebirth ? "#8b5cf6" : "#0f9d9d", color: "#fff", fontSize: "9px", padding: "1px 5px", textTransform: "none" }}>{badgeHtml}</span>}{" "}
              {ownerLabel && <span style={{ fontSize: "10px", opacity: 0.85, display: "block", marginTop: "2px" }}>{ownerLabel}</span>}
            </div>
            {node.sponsorCode && !isMe && <div className="sponsor">👤 {node.sponsorCode}</div>}
            {node.position > 1 && node.side ? (
              <div className={`side-tag ${node.side.toLowerCase()}`}>{node.side}</div>
            ) : (
              <div className="level">Level {node.level}</div>
            )}
            {totalBelow > 0 && <span className="hidden-count">{totalBelow} below</span>}
          </div>

          {hasChildren && (
            <span className="toggle-btn" onClick={(e) => toggleCollapse(node.position, e)}>
              {isCollapsed ? "+" : "−"}
            </span>
          )}

          {!isCollapsed && hasChildren && (
            <ul>
              {leftChild && renderNodeRecursively(leftChild, depth + 1)}
              {rightChild && renderNodeRecursively(rightChild, depth + 1)}
            </ul>
          )}
        </li>
      );
    } else {
      return (
        <li key={node.position}>
          <div className="pool-node empty">
            <div className="pos" style={{ background: "var(--muted)", color: "#fff" }}>#{node.position}</div>
            <div className="name">Waiting</div>
            {node.side && <div className={`side-tag ${node.side.toLowerCase()}`}>{node.side}</div>}
          </div>
        </li>
      );
    }
  };

  const handleZoomIn = () => setZoom(z => Math.min(150, z + 10));
  const handleZoomOut = () => setZoom(z => Math.max(30, z - 10));

  if (loading) {
    return <div className="loading">Loading the Chakra...</div>;
  }

  const activeCardCode = loginContext?.cardNumber || profile?.memberCode || "";
  const isSub = loginContext?.isSubCard || false;
  const ownerCode = loginContext?.ownerMemberCode || profile?.memberCode || "";

  const LEVEL_META: Record<number, any> = {
    1: { cash: "Rs.300", voucher: "—", rebirth: "—" },
    2: { cash: "Rs.300", voucher: "—", rebirth: "—" },
    3: { cash: "Rs.200", voucher: "—", rebirth: "—" },
    4: { cash: "—", voucher: "—", rebirth: "1 rebirth ID" },
    5: { cash: "—", voucher: "Rs.200", rebirth: "1 rebirth ID" },
    6: { cash: "—", voucher: "Rs.200", rebirth: "1 rebirth ID" },
    7: { cash: "—", voucher: "Rs.200", rebirth: "1 rebirth ID" }
  };

  return (
    <div style={{ width: "100%" }}>
      <div className="page-head">
        <h1 id="pageHeaderTitle">{isSub ? `AutoPool (${activeCardCode})` : "Anant Samriddhi Chakra — AutoPool"}</h1>
        <p id="pageHeaderSub">{isSub ? `The global 8-level binary pool for ${activeCardCode} (owner ${ownerCode})` : "The global 8-level binary pool · हर ID के लिए एक स्थान"}</p>
      </div>

      <section className="stat-grid" style={{ gridTemplateColumns: "repeat(5, 1fr)" }}>
        <div className="card stat-card highlight">
          <div className="label">📍 My Global Position</div>
          <div className="value" id="myPosition">#{autopoolData?.position || "—"}</div>
          <div className="sub" id="myLevel">Level {autopoolData?.level || "—"}</div>
        </div>
        <div className="card stat-card">
          <div className="label">🌐 Positions Filled</div>
          <div className="value" id="totalInPool">{autopoolData?.totalInPool || 0}</div>
          <div className="sub">Members in your Chakra</div>
        </div>
        <div className="card stat-card">
          <div className="label">💵 Cash Earned</div>
          <div className="value" id="cashEarned">{formatINR(autopoolData?.cashEarnedPaise || 0)}</div>
          <div className="sub">L1–L3 completions (Pay-Once)</div>
        </div>
        <div className="card stat-card">
          <div className="label">🎭 Rebirth IDs</div>
          <div className="value" id="rebirthIds">{autopoolData?.rebirthIds || 0}</div>
          <div className="sub">Unlocked at Levels 4–7</div>
        </div>
        <div className="card stat-card">
          <div className="label">🎁 Vouchers</div>
          <div className="value" id="vouchers">{formatINR(autopoolData?.vouchersPaise || 0)}</div>
          <div className="sub">Rs.200 at Levels 5, 6, 7</div>
        </div>
      </section>

      <div className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
          <div>
            <h2>My Pool Cycle · मेरा पूल</h2>
            <p className="sub" id="treeSubText" style={{ marginBottom: 0 }}>The positions below YOU in the global Chakra. Click any node for details.</p>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="text"
              id="exploreCardInput"
              placeholder="Card No. (e.g. RB10032, SB10016)"
              style={{ padding: "8px 12px", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "13px", width: "220px", outline: "none" }}
              value={exploreInput}
              onChange={e => setExploreInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleExploreSearch(); }}
            />
            <button className="topbar-btn primary" onClick={handleExploreSearch} style={{ padding: "8px 14px" }}>🔍 Explore</button>
          </div>
        </div>

        {/* Explorer breadcrumbs */}
        {(viewRootNode || rootHistory.length > 0) && (
          <div id="explorerBreadcrumbs" style={{ display: "flex", background: "#f0f7ff", border: "1px solid #cce3ff", padding: "10px 14px", borderRadius: "8px", fontSize: "13.5px", marginBottom: "14px", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px" }}>
            <div id="breadcrumbTrail" style={{ fontWeight: 600, color: "var(--navy)" }}>
              <span style={{ color: "var(--muted)", fontWeight: "normal" }}>Root: </span>
              {rootHistory.map((item, idx) => (
                <span key={idx}>
                  <a href="#" onClick={(e) => navigateToHistoryIdx(idx, e)} style={{ color: "var(--navy)", textDecoration: "underline" }}>
                    {item.cardNumber} (#{item.position})
                  </a>
                  {" > "}
                </span>
              ))}
              {viewRootNode && (
                <span style={{ color: "var(--teal-dark)" }}>
                  {viewRootNode.cardNumber || viewRootNode.memberCode} (#{viewRootNode.position})
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button className="topbar-btn amber" onClick={popExplorerHistory} style={{ padding: "4px 10px", fontSize: "12px" }}>⬅ Back to previous root</button>
              <button className="topbar-btn" onClick={resetToMyPool} style={{ padding: "4px 10px", fontSize: "12px" }}>🏠 Reset to My Pool</button>
            </div>
          </div>
        )}

        <div className="legend">
          <span><span className="dot" style={{ background: "#fff8e9", border: "2px solid var(--amber)" }}></span> You / Viewing Root</span>
          <span><span className="dot" style={{ background: "#f5f3ff", border: "2px solid #8b5cf6" }}></span> 🎭 Rebirth ID</span>
          <span><span className="dot" style={{ background: "#fff", border: "2px solid var(--success)" }}></span> ACB Unlocked</span>
          <span><span className="dot" style={{ background: "#fbfdff", border: "2px dashed var(--muted)" }}></span> Waiting</span>
        </div>

        <div className="zoom-bar">
          <div className="zoom-group">
            <button className="zoom-btn" onClick={handleZoomOut} disabled={zoom <= 30}>−</button>
            <span className="zoom-pct">{zoom}%</span>
            <button className="zoom-btn" onClick={handleZoomIn} disabled={zoom >= 150}>+</button>
          </div>
          <span className="zoom-hint">Use + / − to zoom · Click nodes for details</span>
        </div>

        <div className="tree-layout">
          <div className="tree-wrap" style={{ overflow: "auto", position: "relative" }}>
            <div className="tree-container" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
              <div className="chakra" id="myTreeContainer">
                {activeTree ? (
                  <ul>{renderNodeRecursively(activeTree, 0)}</ul>
                ) : (
                  <div className="loading">No pool position yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Details Sidebar panel */}
          <div className="node-detail">
            {selectedNode ? (
              !selectedNode.filled ? (
                <>
                  <div className="nd-head">
                    <div className="nd-avatar muted">?</div>
                    <div><h4>Vacant Position</h4><div className="nd-id">Position #{selectedNode.position}</div></div>
                  </div>
                  <div className="nd-rows">
                    <div className="nd-row"><span className="k">Status</span><span className="v" style={{ color: "var(--amber)" }}>Waiting for global queue fill</span></div>
                  </div>
                  <div className="nd-note">Positions are filled sequentially based on global member registration times.</div>
                </>
              ) : (
                <>
                  <div className="nd-head">
                    <div className={`nd-avatar ${selectedNode.memberId === profile?.id ? "navy" : "teal"}`}>
                      {(selectedNode.memberName || "M").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4>#{selectedNode.position}</h4>
                      <div className="nd-id">{selectedNode.memberName} (Owner: {selectedNode.memberCode})</div>
                    </div>
                  </div>
                  <div className="nd-rows">
                    <div className="nd-row"><span className="k">Member Code</span><span className="v">{selectedNode.memberCode}</span></div>
                    <div className="nd-row"><span className="k">Card Number</span><span className="v">{selectedNode.cardNumber}</span></div>
                    <div className="nd-row"><span className="k">Card Type</span><span className="v">{selectedNode.cardType}</span></div>
                    <div className="nd-row"><span className="k">ACB Status</span><span className={`v ${selectedNode.acbStatus ? "green" : ""}`}>{selectedNode.acbStatus ? "✓ Unlocked" : "Pending"}</span></div>
                  </div>
                  <div className="nd-actions" style={{ display: "grid", gap: "10px" }}>
                    <button className="btn btn-navy" onClick={() => handleOpenProfileModal(selectedNode)}>View Full Profile</button>
                    <button className="btn btn-outline-teal" onClick={() => explorePool(selectedNode.cardNumber || selectedNode.position)}>Explore Sub-pool</button>
                  </div>
                </>
              )
            ) : (
              <div className="loading" style={{ padding: "20px 0" }}>Select a node to inspect details.</div>
            )}
          </div>
        </div>
      </div>

      {/* Cycle level table */}
      <div className="card panel" style={{ marginTop: "20px" }}>
        <h2>Pool Cycle — Level Summary</h2>
        <table>
          <thead>
            <tr><th>Level</th><th>Positions</th><th>Status</th><th>Cash</th><th>Vouchers</th><th>Rebirth</th></tr>
          </thead>
          <tbody>
            {levelStatus.map((ls, idx) => {
              const meta = LEVEL_META[ls.level] || { cash: "—", voucher: "—", rebirth: "—" };
              const status = ls.complete
                ? <span className="badge success">COMPLETE ✓</span>
                : ls.filled > 0
                  ? <span className="badge info">FILLING · {ls.filled}/{ls.size}</span>
                  : <span className="badge pending">PENDING</span>;
              return (
                <tr key={idx}>
                  <td>L{ls.level}</td>
                  <td>{ls.size}</td>
                  <td>{status}</td>
                  <td>{meta.cash}</td>
                  <td>{meta.voucher}</td>
                  <td>{meta.rebirth}</td>
                </tr>
              );
            })}
            <tr style={{ background: "#f8fafc", fontWeight: 700 }}>
              <td>TOTAL</td>
              <td>254 + 1 root</td>
              <td>—</td>
              <td>Rs.800</td>
              <td>Rs.600</td>
              <td>4 rebirth IDs</td>
            </tr>
          </tbody>
        </table>
        <div className="note">
          <strong>Pool completion behaviour:</strong> When all 255 positions in your AutoPool subtree are filled,
          your ID stops earning AutoPool income permanently but remains a filled node in the global tree.
          Your 4 generated rebirth IDs continue independently. ACB is earned in MY SYSTEM, not AutoPool.
        </div>
      </div>

      {/* Global Tree visualization card */}
      <div className="card panel" style={{ marginTop: "20px" }}>
        <h2>Global Chakra · वैश्विक पूल</h2>
        <p className="sub">The entire world pool from Position #1. Every new member takes the next free position.</p>
        <div className="tree-wrap" style={{ overflow: "auto", maxHeight: "50vh", background: "#fafbfc" }}>
          <div className="chakra">
            {globalTree ? (
              <ul>{renderNodeRecursively(globalTree, 0)}</ul>
            ) : (
              <div className="loading">Loading Global Chakra...</div>
            )}
          </div>
        </div>
      </div>

      {/* How AutoPool works card */}
      <div className="card panel" style={{ marginTop: "20px" }}>
        <h2>How AutoPool Works</h2>
        <div style={{ display: "grid", gap: "14px", margin: "14px 0" }}>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ background: "var(--teal)", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: "700", flexShrink: 0 }}>1</div>
            <div><strong>Breadth-first auto-placement</strong><div className="muted" style={{ fontSize: "13px" }}>All IDs — purchased MAIN, SUB, and rebirth — are placed automatically in the global AutoPool using breadth-first positioning based on entry order.</div></div>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ background: "var(--teal)", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: "700", flexShrink: 0 }}>2</div>
            <div><strong>Cash at Levels 1–3</strong><div className="muted" style={{ fontSize: "13px" }}>Rs.300 + Rs.300 + Rs.200 = Rs.800 per complete pool cycle. Pay-Once Rule applies: Level 1–3 cash is paid only once per ID across AutoPool and MY SYSTEM.</div></div>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ background: "var(--teal)", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: "700", flexShrink: 0 }}>3</div>
            <div><strong>Rebirth IDs at Levels 4–7</strong><div className="muted" style={{ fontSize: "13px" }}>Each of Levels 4, 5, 6, and 7 generates 1 rebirth ID when complete. Rebirth IDs join the next free global position — they do NOT create a separate tree.</div></div>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <div style={{ background: "var(--teal)", color: "#fff", width: "24px", height: "24px", borderRadius: "50%", display: "grid", placeItems: "center", fontWeight: "700", flexShrink: 0 }}>4</div>
            <div><strong>Product vouchers at Levels 5–7</strong><div className="muted" style={{ fontSize: "13px" }}>Rs.200 voucher at each of Levels 5, 6, and 7. Total Rs.600 in vouchers per pool cycle.</div></div>
          </div>
        </div>
      </div>

      {/* Member Profile Modal */}
      {profileModalOpen && modalNode && (
        <div className="modal-backdrop open" onClick={() => setProfileModalOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>👤 Member Profile</h3>
            <div className="nd-head" style={{ marginTop: "14px" }}>
              <div className="nd-avatar navy">{(modalNode.memberName || "M").charAt(0).toUpperCase()}</div>
              <div>
                <h4>{modalNode.cardNumber || modalNode.memberCode}</h4>
                <div className="nd-id">{modalNode.memberName} (Owner: {modalNode.memberCode})</div>
              </div>
            </div>
            <div className="nd-rows" style={{ margin: "20px 0" }}>
              <div className="nd-row"><span className="k">Member Code</span><span className="v">{modalNode.memberCode}</span></div>
              <div className="nd-row"><span className="k">Card Number</span><span className="v">{modalNode.cardNumber}</span></div>
              <div className="nd-row"><span className="k">Card Type</span><span className="v">{modalNode.cardType}</span></div>
              <div className="nd-row"><span className="k">AutoPool Position</span><span className="v">#{modalNode.position}</span></div>
              <div className="nd-row"><span className="k">AutoPool Level</span><span className="v">L{modalNode.level}</span></div>
              <div className="nd-row"><span className="k">Left Children</span><span className="v">{modalNode.children?.LEFT?.filled ? "Filled" : "Empty"}</span></div>
              <div className="nd-row"><span className="k">Right Children</span><span className="v">{modalNode.children?.RIGHT?.filled ? "Filled" : "Empty"}</span></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-navy" onClick={() => setProfileModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
