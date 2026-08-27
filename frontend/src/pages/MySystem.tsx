import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate, Link } from "react-router-dom";

export default function MySystem() {
  const { token, loginContext, logout } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [treeData, setTreeData] = useState<any>(null);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [viewRootId, setViewRootId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [collapsedNodes, setCollapsedNodes] = useState<Record<string, boolean>>({});
  
  // Full profile modal
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [modalNode, setModalNode] = useState<any>(null);

  useEffect(() => {
    if (!token) {
      logout();
      navigate("/login");
      return;
    }

    const loadData = async () => {
      try {
        const headers = { Authorization: `Bearer ${token}` };
        const [profileRes, treeRes] = await Promise.all([
          fetch("/api/members/profile", { headers }).then(r => r.json()),
          fetch("/api/members/my-system-tree", { headers }).then(r => r.json())
        ]);

        if (profileRes.success) setProfile(profileRes.data);
        if (treeRes.success && treeRes.data) {
          setTreeData(treeRes.data);
          // Auto select root node
          setSelectedNode(treeRes.data.tree);
        }
      } catch (err) {
        console.error("Error loading tree data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [token]);

  const countSubtree = (node: any): number => {
    if (!node) return 0;
    return 1 + countSubtree(node.children?.LEFT) + countSubtree(node.children?.RIGHT);
  };

  const findNode = (node: any, id: string): any => {
    if (!node) return null;
    if (node.id === id) return node;
    return findNode(node.children?.LEFT, id) || findNode(node.children?.RIGHT, id);
  };

  const activeCard = loginContext?.cardNumber || profile?.memberCode || "";
  const isSub = loginContext?.isSubCard || false;
  const ownerCode = loginContext?.ownerMemberCode || profile?.memberCode || "";
  
  // Check if Rebirth card
  const isRebirth = loginContext?.cardType === "REBIRTH" || profile?.activeCard?.type === "REBIRTH";

  if (loading) {
    return <div className="loading">Loading tree network...</div>;
  }

  if (isRebirth) {
    return (
      <div style={{ width: "100%" }}>
        <div className="card panel" style={{ padding: "40px", textAlign: "center" }}>
          <div style={{ fontSize: "36px", marginBottom: "12px" }}>🌀</div>
          <h3 style={{ marginBottom: "8px", color: "var(--navy)", fontSize: "18px" }}>Rebirth IDs participate exclusively in AutoPool</h3>
          <p style={{ color: "var(--muted)", marginBottom: "16px", fontSize: "14px" }}>Rebirth IDs do not have a binary referral tree in MY SYSTEM.</p>
          <Link to="/autopool" className="topbar-btn primary" style={{ display: "inline-block", textDecoration: "none", padding: "8px 18px", borderRadius: "8px" }}>
            View your AutoPool journey →
          </Link>
        </div>
      </div>
    );
  }

  const { tree, stats } = treeData || {};

  const handleZoomIn = () => setZoom(z => Math.min(150, z + 10));
  const handleZoomOut = () => setZoom(z => Math.max(30, z - 10));

  const toggleCollapse = (nodeId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes(prev => ({
      ...prev,
      [nodeId]: !prev[nodeId]
    }));
  };

  const handleNodeClick = (node: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode(node);
  };

  const handleEmptyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedNode({ isEmptySlot: true });
  };

  const handleViewSubtree = (nodeId: string) => {
    setViewRootId(nodeId);
    const target = findNode(tree, nodeId);
    if (target) setSelectedNode(target);
  };

  const handleBackToFullTree = () => {
    setViewRootId(null);
    setSelectedNode(tree);
  };

  const handleOpenProfileModal = (node: any) => {
    setModalNode(node);
    setProfileModalOpen(true);
  };

  const renderTreeRecursively = (node: any, depth: number): React.ReactNode => {
    if (!node) return null;
    const isRoot = !viewRootId ? node.id === tree.id : node.id === viewRootId;
    const leftChild = node.children?.LEFT;
    const rightChild = node.children?.RIGHT;
    const hasAnyChild = leftChild || rightChild;
    const totalBelow = countSubtree(leftChild) + countSubtree(rightChild);
    const isCollapsed = collapsedNodes[node.id] || false;

    const isSubCardNode = node.cardType ? node.cardType !== "MAIN" : (node.cardNumber && node.memberCode && node.cardNumber !== node.memberCode);

    return (
      <li key={node.id} className={isCollapsed ? "collapsed" : ""}>
        <div
          className={`t-node ${isRoot ? "self" : ""} ${node.acbStatus ? "acb" : ""} ${selectedNode?.id === node.id ? "selected" : ""}`}
          onClick={(e) => handleNodeClick(node, e)}
        >
          {node.side && (
            <span className={`side-badge ${node.side.toLowerCase()}`}>{node.side}</span>
          )}
          <div className="t-name">{node.memberName}{node.memberCode === profile?.memberCode ? " (You)" : ""}</div>
          <div className="t-code">
            {node.cardNumber || node.memberCode}
            {isSubCardNode && <span className="t-owner" style={{ fontSize: "11px", opacity: 0.85, display: "block", marginTop: "2px" }}>(owner {node.memberCode})</span>}
          </div>
          {node.memberCode !== profile?.memberCode && node.sponsorCode && (
            <div className="t-sponsor">👤 Sponsored by: {node.sponsorCode}</div>
          )}
          <div className="t-type">{node.cardType}{node.acbStatus ? " · ✓ ACB" : ""}</div>
          {hasAnyChild && totalBelow > 0 && (
            <span className="hidden-count">{totalBelow} below</span>
          )}
        </div>

        {hasAnyChild && depth < 4 && (
          <span className="toggle-btn" onClick={(e) => toggleCollapse(node.id, e)}>
            {isCollapsed ? "+" : "−"}
          </span>
        )}

        {depth < 4 && !isCollapsed && (
          <ul>
            {leftChild ? (
              renderTreeRecursively(leftChild, depth + 1)
            ) : (
              <li>
                <div className="t-node empty" onClick={handleEmptyClick}>
                  <div className="t-name">Empty</div>
                  <div className="t-type">LEFT slot</div>
                </div>
              </li>
            )}
            {rightChild ? (
              renderTreeRecursively(rightChild, depth + 1)
            ) : (
              <li>
                <div className="t-node empty" onClick={handleEmptyClick}>
                  <div className="t-name">Empty</div>
                  <div className="t-type">RIGHT slot</div>
                </div>
              </li>
            )}
          </ul>
        )}
      </li>
    );
  };

  const currentRootNode = viewRootId ? findNode(tree, viewRootId) : tree;

  return (
    <div style={{ width: "100%" }}>
      <div className="page-head">
        <h1 id="pageHeaderTitle">{isSub ? `My Network (${activeCard})` : "My Network"}</h1>
        <p id="pageHeaderSub">{isSub ? `Viewing binary referral subtree rooted at ${activeCard} (owner ${ownerCode})` : "Explore your binary referral structure and qualifications."}</p>
      </div>

      <section className="stat-grid">
        <div className="card stat-card">
          <div className="label">⬅ LEFT Leg</div>
          <div className="value" id="statLeft">{stats?.leftLegSize || 0}</div>
          <div className="sub" id="statLeftDirect">Direct: {stats?.hasDirectLeft ? "✓ Filled" : "— Empty"}</div>
        </div>
        <div className="card stat-card">
          <div className="label">➡ RIGHT Leg</div>
          <div className="value" id="statRight">{stats?.rightLegSize || 0}</div>
          <div className="sub" id="statRightDirect">Direct: {stats?.hasDirectRight ? "✓ Filled" : "— Empty"}</div>
        </div>
        <div className="card stat-card">
          <div className="label">🌐 Total Network</div>
          <div className="value" id="statTotal">{stats?.totalNetwork || 0}</div>
          <div className="sub">All members below you</div>
        </div>
        <div className={`card stat-card ${stats?.acbStatus ? "acb-yes" : "acb-no"}`} id="acbCard">
          <div className="label">🛡️ ACB Status</div>
          <div className="value" style={{ color: stats?.acbStatus ? "var(--success)" : "var(--warning)" }} id="statAcb">
            {stats?.acbStatus ? "✓ Unlocked" : "Pending"}
          </div>
          <div className="sub">Needs 1 LEFT + 1 RIGHT direct</div>
        </div>
      </section>

      <div className="card panel">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <h2>Your MY SYSTEM Tree</h2>
          {viewRootId && (
            <button className="topbar-btn primary" onClick={handleBackToFullTree} id="backToTreeBtn">
              ⬅ Full Tree
            </button>
          )}
        </div>
        <p className="sub" id="treeSubText">
          {viewRootId ? (
            <span>🔍 Viewing sub-tree of <strong>{currentRootNode?.cardNumber || currentRootNode?.memberCode}</strong></span>
          ) : (
            <span>Click nodes to view details. Use <strong>+/-</strong> buttons to expand/collapse branches.</span>
          )}
        </p>

        <div className="legend">
          <span><span className="dot" style={{ background: "#fff8e9", border: "2px solid var(--amber)" }}></span> You / Viewing Root</span>
          <span><span className="dot" style={{ background: "#fff", border: "2px solid var(--success)" }}></span> ACB Unlocked</span>
          <span><span className="dot" style={{ background: "#f8fafc", border: "2px dashed var(--border)" }}></span> Empty Slot</span>
        </div>

        <div className="zoom-bar">
          <div className="zoom-group">
            <button className="zoom-btn" onClick={handleZoomOut} disabled={zoom <= 30}>−</button>
            <span className="zoom-pct">{zoom}%</span>
            <button className="zoom-btn" onClick={handleZoomIn} disabled={zoom >= 150}>+</button>
          </div>
          <span className="zoom-hint">Use + / − to zoom · Scroll to see all nodes</span>
        </div>

        <div className="tree-layout">
          <div className="tree-wrap" style={{ overflow: "auto", position: "relative" }}>
            <div className="tree-container" style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}>
              <div className="tree">
                {currentRootNode ? (
                  <ul>{renderTreeRecursively(currentRootNode, 0)}</ul>
                ) : (
                  <div className="loading">No network data yet.</div>
                )}
              </div>
            </div>
          </div>

          {/* Details Sidebar panel */}
          <div className="node-detail">
            {selectedNode ? (
              selectedNode.isEmptySlot ? (
                <>
                  <div className="nd-head">
                    <div className="nd-avatar muted">+</div>
                    <div><h4>Open Position</h4><div className="nd-id">Empty Slot</div></div>
                  </div>
                  <div className="nd-empty-box">
                    <div className="eb-title">Place a member here</div>
                    <div className="eb-sub">Use your referral link to invite someone</div>
                  </div>
                  <div className="nd-rows">
                    <div className="nd-row"><span className="k">Status</span><span className="v" style={{ color: "var(--amber)" }}>Vacant</span></div>
                  </div>
                  <div className="nd-actions">
                    <button className="btn btn-teal" onClick={() => alert("Copy invitation referral link from top bar!")}>Copy Referral Link</button>
                  </div>
                  <div className="nd-note">Refer a friend to fill this position</div>
                </>
              ) : (
                <>
                  <div className="nd-head">
                    <div className={`nd-avatar ${selectedNode.memberCode === profile?.memberCode ? "navy" : "teal"}`}>
                      {(selectedNode.memberName || "M").charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h4>{selectedNode.cardNumber || selectedNode.memberCode}</h4>
                      <div className="nd-id">{selectedNode.memberName} (Owner: {selectedNode.memberCode || "—"})</div>
                    </div>
                  </div>
                  {selectedNode.acbStatus && (
                    <div style={{ marginBottom: "12px" }}>
                      <span style={{ background: "rgba(26,107,90,.12)", color: "var(--teal)", padding: "4px 11px", borderRadius: "999px", fontSize: "11px", fontWeight: 600 }}>
                        ✓ ACB Member
                      </span>
                    </div>
                  )}
                  <div className="nd-rows">
                    <div className="nd-row"><span className="k">Member Code</span><span className="v">{selectedNode.memberCode}</span></div>
                    <div className="nd-row"><span className="k">Card Number</span><span className="v">{selectedNode.cardNumber}</span></div>
                    <div className="nd-row"><span className="k">Card Type</span><span className="v">{selectedNode.cardType}</span></div>
                    <div className="nd-row"><span className="k">Placement</span><span className="v">{selectedNode.side || "ROOT"}</span></div>
                    {selectedNode.memberCode !== profile?.memberCode && selectedNode.sponsorCode && (
                      <div className="nd-row"><span className="k">Sponsored by</span><span className="v green">{selectedNode.sponsorCode}</span></div>
                    )}
                    <div className="nd-row"><span className="k">ACB Status</span><span className={`v ${selectedNode.acbStatus ? "green" : ""}`}>{selectedNode.acbStatus ? "✓ Unlocked" : "Pending"}</span></div>
                  </div>
                  <div className="nd-actions" style={{ display: "grid", gap: "10px" }}>
                    <button className="btn btn-navy" onClick={() => handleOpenProfileModal(selectedNode)}>View Full Profile</button>
                    <button className="btn btn-outline-teal" onClick={() => handleViewSubtree(selectedNode.id)}>View Sub-tree</button>
                  </div>
                </>
              )
            ) : (
              <div className="loading" style={{ padding: "20px 0" }}>Select a node to inspect details.</div>
            )}
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
              <div className="nd-row"><span className="k">Joined</span><span className="v">{new Date(modalNode.joinedAt || Date.now()).toLocaleDateString()}</span></div>
              <div className="nd-row"><span className="k">Sponsored by</span><span className="v green">{modalNode.sponsorCode || "— (Root)"}</span></div>
              <div className="nd-row"><span className="k">Placement</span><span className="v">{modalNode.side || "ROOT"}</span></div>
              <div className="nd-row"><span className="k">ACB Status</span><span className={`v ${modalNode.acbStatus ? "green" : ""}`}>{modalNode.acbStatus ? "✓ Unlocked" : "Pending"}</span></div>
              <div className="nd-row"><span className="k">⬅ LEFT Leg Size</span><span className="v">{countSubtree(modalNode.children?.LEFT)}</span></div>
              <div className="nd-row"><span className="k">➡ RIGHT Leg Size</span><span className="v">{countSubtree(modalNode.children?.RIGHT)}</span></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline-teal" onClick={() => { setProfileModalOpen(false); handleViewSubtree(modalNode.id); }}>
                🌳 View Their Sub-tree
              </button>
              <button className="btn btn-navy" onClick={() => setProfileModalOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
