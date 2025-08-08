import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

const SusRolls = () => {
  const [s, setS] = useState({
    chars: [], coll: [], view: "roll", rolling: false, count: 0, claimed: null,
    menu: false, sort: "level", revealed: [], showing: false, rolls: 10,
    idx: 0, timer: "", user: "", login: false, newUser: "", users: {},
    friend: false, code: "", myCode: "", viewing: ""
  });

  const refs = { req: useRef(0), cnt: useRef(0), tmr: useRef(null), aud: useRef(null) };
  
  // Mock storage for Claude.ai compatibility
  const stor = useMemo(() => ({
    data: {},
    get: function(k) { return this.data[k] || null; },
    set: function(k, v) { this.data[k] = v; return true; }
  }), []);

  const up = useCallback(u => setS(p => ({...p, ...u})), []);

  const getNext = () => { const n = new Date(); n.setHours(n.getHours() + 1, 0, 0, 0); return n; };
  const shouldReset = t => !t || new Date().getHours() !== new Date(t).getHours();

  const saveAll = useCallback(u => stor.set('susRolls_allUsers', JSON.stringify(u)), [stor]);
  const saveUser = useCallback(u => {
    if (!s.user) return;
    const nu = {...s.users, [s.user]: {...s.users[s.user], ...u}};
    up({users: nu}); saveAll(nu);
  }, [s.user, s.users, up, saveAll]);

  const getAud = useCallback(() => {
    if (!refs.aud.current) try { refs.aud.current = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
    if (refs.aud.current.state === 'suspended') refs.aud.current.resume().catch(() => {});
    return refs.aud.current;
  }, []);

  const snd = useCallback(t => {
    const a = getAud(); if (!a) return;
    const tone = (f, d, w = 'sine', v = 0.15) => {
      try {
        const o = a.createOscillator(), g = a.createGain();
        o.connect(g); g.connect(a.destination);
        o.frequency.setValueAtTime(f, a.currentTime); o.type = w;
        g.gain.setValueAtTime(0, a.currentTime);
        g.gain.linearRampToValueAtTime(v, a.currentTime + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + d);
        o.start(a.currentTime); o.stop(a.currentTime + d);
      } catch {}
    };
    const sounds = {
      start: () => [440, 554, 659].forEach((f, i) => setTimeout(() => tone(f, 0.8, 'sine', 0.12), i * 50)),
      reveal: () => { tone(800, 0.15, 'triangle', 0.15); setTimeout(() => tone(1000, 0.15), 80); setTimeout(() => tone(1200, 0.2), 160); },
      rare: () => [[880, 1100, 1320], [1100, 1320, 1580], [1320, 1580, 1880]].forEach((fs, i) => 
        setTimeout(() => fs.forEach((f, j) => setTimeout(() => tone(f, 0.4 + i * 0.1, 'sine', 0.15 - i * 0.025), j * 50)), i * 200)),
      claim: () => [659, 784, 988].forEach((f, i) => setTimeout(() => tone(f, 0.2 + i * 0.05), i * 100)),
      whoosh: () => { for(let i = 0; i < 5; i++) setTimeout(() => tone(400 + i * 100, 0.3, 'sawtooth', 0.08), i * 80); }
    };
    sounds[t]?.();
  }, [getAud]);

  const getRar = useCallback(c => {
    const f = c.favourites || 0;
    return f >= 10000 ? "legendary" : f >= 3000 ? "epic" : f >= 800 ? "uncommon" : "common";
  }, []);

  const getCol = useCallback(r => ({ legendary: "#ffd700", epic: "#9d4edd", uncommon: "#20c997", common: "#6c757d" })[r], []);

  const updateTimer = useCallback(() => {
    const now = new Date(), next = getNext(), diff = next - now;
    if (diff <= 0) {
      if (s.user) {
        const reset = { rolls: 10, chars: [], idx: 0, claimed: null, lastReset: new Date().toISOString() };
        saveUser(reset); 
        up({...reset, revealed: [], showing: false});
      }
      return;
    }
    const m = Math.floor(diff / 60000), sec = Math.floor((diff % 60000) / 1000);
    up({ timer: `${m}:${sec.toString().padStart(2, '0')}` });
  }, [s.user, saveUser, up]);

  const loadUser = useCallback((user, users = s.users) => {
    if (!users[user]) return;
    const u = users[user], base = { coll: u.collection || [], count: u.rollCount || 0 };
    if (shouldReset(u.lastReset)) {
      const reset = { rolls: 10, chars: [], idx: 0, claimed: null, revealed: [], showing: false };
      up({...base, ...reset}); 
      saveUser({...reset, lastReset: new Date().toISOString()});
    } else {
      const currentIdx = u.idx || 0;
      const roll = { 
        rolls: u.rolls ?? 10, 
        chars: u.chars || [], 
        idx: currentIdx, 
        claimed: u.claimed || null,
        revealed: Array.from({length: currentIdx}, (_, i) => i), 
        showing: (u.chars || []).length > 0 
      };
      up({...base, ...roll});
    }
  }, [s.users, up, saveUser]);

  const wait = useCallback(async (d = 500) => {
    const now = Date.now(), since = now - refs.req.current;
    if (since > 60000) refs.cnt.current = 0;
    if (refs.cnt.current > 10) d = 2000; else if (refs.cnt.current > 5) d = 1000;
    if (since < d) await new Promise(r => setTimeout(r, d - since));
    refs.req.current = Date.now(); refs.cnt.current++;
  }, []);

  const roll = useCallback(async () => {
    if (!s.user) return alert("Please login first!");
    if (s.rolls <= 0) return alert("No rolls remaining!");
    if (s.rolling) return;
    
    up({rolling: true}); 
    snd('start');
    
    const q = `query ($page: Int, $perPage: Int) { Page(page: $page, perPage: $perPage) { characters {
      id name { full } image { large } age siteUrl favourites media(perPage: 3, sort: [POPULARITY_DESC]) { nodes { title { romaji } popularity }}}}}`;

    try {
      let char = null, att = 0;
      while (!char && att < 10) {
        try {
          const page = Math.floor(Math.random() * 5000) + 1;
          await wait(600);
          const res = await fetch("https://graphql.anilist.co", {
            method: "POST", headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ query: q, variables: { page, perPage: 25 }})
          });
          if (!res.ok) { att++; continue; }
          const data = await res.json(), chars = data.data?.Page?.characters || [];
          const valid = chars.filter(c => c?.name?.full && c?.image?.large && (!c.age || parseInt(c.age) >= 18));
          if (valid.length === 0) { att++; continue; }
          char = valid[Math.floor(Math.random() * valid.length)];
        } catch { att++; }
      }
      if (!char) {
        up({rolling: false});
        return alert("Unable to fetch character.");
      }
      
      const newChars = [...s.chars, char];
      const newRolls = s.rolls - 1;
      const newIdx = s.idx;
      
      up({ chars: newChars, rolls: newRolls, showing: true, idx: newIdx + 1 });
      saveUser({ rolls: newRolls, chars: newChars, count: s.count + 1, idx: newIdx + 1 });
      
      snd('whoosh');
      
      // Reveal the card after a delay
      setTimeout(() => {
        const rar = getRar(char);
        snd(rar === 'legendary' ? 'rare' : 'reveal');
        
        up(prevState => ({
          ...prevState,
          revealed: [...prevState.revealed, newIdx]
        }));
        
      }, 1000);
      
    } catch (error) {
      console.error('Roll error:', error);
      alert("Rolling failed.");
    } finally { 
      up({rolling: false}); 
    }
  }, [s, up, saveUser, snd, getRar, wait]);

  const claim = useCallback(char => {
    if (s.claimed) return alert("Already claimed!");
    snd('claim');
    const newColl = [...s.coll], ex = newColl.find(c => c.id === char.id);
    if (ex) ex.level = (ex.level || 1) + 1; else newColl.push({...char, level: 1});
    up({ coll: newColl, claimed: char.id });
    saveUser({ collection: newColl, claimed: char.id });
  }, [s.claimed, s.coll, up, saveUser, snd]);

  const create = useCallback(() => {
    if (!s.newUser.trim()) return;
    if (s.users[s.newUser]) return alert("Username exists!");
    const nu = {...s.users, [s.newUser]: { 
      collection: [], rollCount: 0, friends: [], rolls: 10,
      chars: [], idx: 0, claimed: null, lastReset: new Date().toISOString() 
    }};
    up({ 
      users: nu, user: s.newUser, coll: [], count: 0, rolls: 10, chars: [], idx: 0,
      claimed: null, login: false, newUser: "", revealed: [], showing: false 
    });
    saveAll(nu); 
    stor.set('susRolls_currentUser', s.newUser);
  }, [s.newUser, s.users, up, saveAll, stor]);

  useEffect(() => {
    updateTimer(); 
    refs.tmr.current = setInterval(updateTimer, 1000);
    return () => clearInterval(refs.tmr.current);
  }, [updateTimer]);

  useEffect(() => {
    const saved = stor.get('susRolls_allUsers'), curr = stor.get('susRolls_currentUser');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        up({ users: parsed });
        if (curr && parsed[curr]) {
          up({ user: curr, login: false });
          loadUser(curr, parsed);
        } else up({ login: true });
      } catch { up({ login: true }); }
    } else up({ login: true });
  }, [stor, up, loadUser]);

  useEffect(() => {
    const handleKey = e => {
      if (e.code === 'Space' && !s.login && !s.friend && !s.menu && s.view === "roll" && !s.viewing) {
        e.preventDefault(); roll();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [s.login, s.friend, s.menu, s.view, s.viewing, roll]);

  useEffect(() => {
    if (s.user) {
      const code = btoa(s.user).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
      up({ myCode: code });
    }
  }, [s.user, up]);

  const getColl = () => s.viewing && s.users[s.viewing] ? s.users[s.viewing].collection || [] : s.coll;
  const getUser = () => s.viewing || s.user;
  const getSorted = () => {
    const coll = getColl(), sorted = [...coll];
    const sorters = {
      name: (a, b) => a.name.full.localeCompare(b.name.full),
      series: (a, b) => (a.media?.nodes[0]?.title?.romaji || "Unknown").localeCompare(b.media?.nodes[0]?.title?.romaji || "Unknown"),
      age: (a, b) => (parseInt(b.age) || 0) - (parseInt(a.age) || 0),
      favorites: (a, b) => (b.favourites || 0) - (a.favourites || 0),
      level: (a, b) => (b.level || 1) - (a.level || 1)
    };
    return sorted.sort(sorters[s.sort] || sorters.level);
  };

  const Frog = ({ size = 48 }) => (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <path d="M32 52C44.1503 52 54 42.1503 54 30C54 17.8497 44.1503 8 32 8C19.8497 8 10 17.8497 10 30C10 42.1503 19.8497 52 32 52Z" fill="#4ECDC4" stroke="#2D7D77" strokeWidth="2"/>
      <circle cx="25" cy="26" r="3" fill="#fff"/>
      <circle cx="39" cy="26" r="3" fill="#fff"/>
      <circle cx="25" cy="26" r="1.5" fill="#000"/>
      <circle cx="39" cy="26" r="1.5" fill="#000"/>
      <path d="M20 36C20 38 24 40 32 40C40 40 44 38 44 36" stroke="#2D7D77" strokeWidth="2" strokeLinecap="round"/>
      <path d="M16 22C16 18 12 16 8 18C4 20 4 26 8 28" stroke="#4ECDC4" strokeWidth="3" strokeLinecap="round"/>
      <path d="M48 22C48 18 52 16 56 18C60 20 60 26 56 28" stroke="#4ECDC4" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );

  const st = {
    app: { fontFamily: "'Arial', sans-serif", backgroundColor: "#0a0f1c", color: "#e8eaed", minHeight: "100vh", padding: "2rem", fontSize: "14px" },
    header: { textAlign: "center", marginBottom: "3rem", position: "relative" },
    logo: { display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "1.5rem" },
    title: { fontSize: "4rem", margin: "0", color: "#4ecdc4", letterSpacing: "0.1em", textShadow: "0 0 20px rgba(78, 205, 196, 0.3)" },
    info: { display: "flex", alignItems: "center", justifyContent: "center", gap: "2rem", marginBottom: "1rem", flexWrap: "wrap" },
    user: { fontSize: "1.1rem", color: "#4ecdc4", fontWeight: "600" },
    stats: { display: "flex", justifyContent: "center", gap: "3rem", fontSize: "0.9rem", color: "#9aa0a6", marginBottom: "1rem" },
    status: { display: "flex", alignItems: "center", gap: "1.5rem", fontSize: "0.95rem", color: "#9aa0a6" },
    rolls: { color: "#4ecdc4", fontWeight: "600" },
    timer: { color: "#ff6b6b", fontWeight: "600" },
    claimed: { color: "#34d399", fontWeight: "600" },
    menu: { position: "absolute", top: "0", right: "0", background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#e8eaed", padding: "0.75rem 1rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "500", transition: "all 0.2s ease" },
    dropdown: { position: "absolute", top: "calc(100% + 0.5rem)", right: "0", backgroundColor: "#1a1f2e", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "8px", minWidth: "180px", boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)", zIndex: 1000, overflow: "hidden" },
    dropItem: { width: "100%", background: "none", border: "none", color: "#e8eaed", padding: "0.875rem 1rem", textAlign: "left", cursor: "pointer", fontSize: "0.9rem", transition: "background-color 0.2s ease" },
    btn: { padding: "0.875rem 1.75rem", fontSize: "0.95rem", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "600", transition: "all 0.2s ease" },
    rollBtn: { background: "linear-gradient(135deg, #6366f1, #8b5cf6)", color: "white", boxShadow: "0 4px 16px rgba(99, 102, 241, 0.3)" },
    viewBtn: { background: "linear-gradient(135deg, #10b981, #14b8a6)", color: "white", boxShadow: "0 4px 16px rgba(16, 185, 129, 0.3)" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "1.5rem", maxWidth: "1600px", margin: "2rem auto 0" },
    card: { backgroundColor: "#1a1f2e", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "12px", padding: "1.5rem", position: "relative", display: "flex", flexDirection: "column", transition: "all 0.2s ease", minHeight: "420px" },
    back: { backgroundColor: "#1a1f2e", border: "2px solid #4ecdc4", borderRadius: "12px", minHeight: "420px", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #1a1f2e 0%, #0f1419 100%)" },
    img: { width: "100%", height: "280px", objectFit: "cover", borderRadius: "8px", cursor: "pointer", marginBottom: "1rem" },
    rare: { position: "absolute", top: "1rem", right: "1rem", padding: "0.25rem 0.75rem", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "700", color: "white", textTransform: "uppercase", letterSpacing: "0.05em" },
    level: { position: "absolute", top: "1rem", left: "1rem", padding: "0.25rem 0.75rem", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "700", backgroundColor: "#fbbf24", color: "#000" },
    owned: { position: "absolute", top: "1rem", left: "1rem", padding: "0.25rem 0.75rem", borderRadius: "6px", fontSize: "0.7rem", fontWeight: "700", backgroundColor: "#10b981", color: "white" },
    claimBtn: { background: "linear-gradient(135deg, #10b981, #14b8a6)", color: "white", border: "none", padding: "0.75rem 1.25rem", borderRadius: "8px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "600", marginTop: "auto", transition: "all 0.2s ease" },
    claimedBtn: { background: "linear-gradient(135deg, #fbbf24, #f59e0b)", color: "#000", fontWeight: "700" },
    disabled: { background: "#374151", cursor: "not-allowed", opacity: 0.6 },
    overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000, backdropFilter: "blur(4px)" },
    modal: { backgroundColor: "#1a1f2e", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "16px", padding: "2.5rem", textAlign: "center", maxWidth: "480px", width: "90%", boxShadow: "0 20px 64px rgba(0, 0, 0, 0.5)" },
    input: { padding: "1rem 1.25rem", fontSize: "1rem", border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "8px", backgroundColor: "#0f1419", color: "#e8eaed", outline: "none", width: "100%" },
    loginBtn: { background: "linear-gradient(135deg, #4ecdc4, #45b7d1)", color: "white", border: "none", padding: "1rem 2rem", borderRadius: "8px", fontSize: "1rem", fontWeight: "600", cursor: "pointer", width: "100%" },
    existBtn: { background: "rgba(255, 255, 255, 0.05)", border: "1px solid rgba(255, 255, 255, 0.1)", color: "#e8eaed", padding: "0.75rem 1rem", borderRadius: "8px", cursor: "pointer", width: "100%", textAlign: "left" },
    panel: { backgroundColor: "rgba(78, 205, 196, 0.1)", border: "1px solid rgba(78, 205, 196, 0.3)", borderRadius: "12px", padding: "1.5rem", marginBottom: "2rem", textAlign: "center" },
    sort: { display: "flex", alignItems: "center", gap: "0.75rem" },
    select: { background: "#1a1f2e", color: "#e8eaed", border: "1px solid rgba(255, 255, 255, 0.2)", borderRadius: "6px", padding: "0.5rem 0.75rem", fontSize: "0.9rem", cursor: "pointer" },
    remove: { background: "#dc2626", color: "white", border: "none", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", fontSize: "0.8rem", marginTop: "0.75rem", transition: "all 0.2s ease" },
    name: { margin: "0 0 0.5rem 0", fontSize: "1.1rem", fontWeight: "600", lineHeight: "1.3" },
    link: { color: "#4ecdc4", textDecoration: "none", transition: "color 0.2s ease" },
    detail: { margin: "0.25rem 0", fontSize: "0.85rem", color: "#9aa0a6", lineHeight: "1.4" },
    spacer: { fontSize: "0.85rem", color: "#9aa0a6", fontStyle: "italic", marginTop: "0.5rem" },
    collHead: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" },
    collTitle: { margin: "0", fontSize: "2rem", color: "#4ecdc4", letterSpacing: "0.05em" },
    empty: { fontSize: "1.1rem", color: "#6b7280", marginTop: "4rem", textAlign: "center" },
    btnGroup: { display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" },
    rollCont: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }
  };

  return (
    <div style={st.app}>
      {s.login && (
        <div style={st.overlay}>
          <div style={st.modal}>
            <div style={st.logo}>
              <Frog size={56} />
              <h2 style={{ fontSize: "2.5rem", margin: "0", color: "#4ecdc4" }}>Sus Rolls</h2>
            </div>
            <p style={{ fontSize: "1rem", color: "#9aa0a6", marginBottom: "2rem" }}>Create an account or login to start collecting anime characters</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
              <input
                type="text" placeholder="Enter username" value={s.newUser}
                onChange={e => up({ newUser: e.target.value })} style={st.input}
                onKeyPress={e => e.key === 'Enter' && create()}
              />
              <button onClick={create} style={st.loginBtn}>Create Account</button>
            </div>
            
            {Object.keys(s.users).length > 0 && (
              <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "1.5rem" }}>
                <p style={{ fontSize: "0.9rem", color: "#9aa0a6", marginBottom: "1rem" }}>Or login as existing user</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {Object.keys(s.users).map(u => (
                    <button key={u} onClick={() => {
                      up({ user: u, login: false });
                      loadUser(u);
                      stor.set('susRolls_currentUser', u);
                    }} style={st.existBtn}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontWeight: "600" }}>{u}</span>
                        <span style={{ fontSize: "0.8rem", color: "#9aa0a6" }}>
                          {s.users[u]?.collection?.length || 0} cards
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={st.header}>
        <div style={st.logo}>
          <Frog size={64} />
          <h1 style={st.title}>Sus Rolls</h1>
        </div>
        
        <div style={st.info}>
          <span style={st.user}>{getUser()}</span>
          {!s.viewing && (
            <div style={st.status}>
              <span style={st.rolls}>Rolls: {s.rolls}/10</span>
              <span style={st.timer}>Reset: {s.timer}</span>
              {s.claimed && <span style={st.claimed}>Claimed</span>}
            </div>
          )}
        </div>
        
        <div style={st.stats}>
          <span>Total Rolls: {s.viewing ? (s.users[s.viewing]?.rollCount || 0) : s.count}</span>
          <span>Collection: {getColl().length}</span>
        </div>
        
        <div style={{ position: "relative" }}>
          <button 
            onClick={() => up({ menu: !s.menu })} 
            style={{...st.menu, backgroundColor: s.menu ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0.05)"}}
          >
            Menu
          </button>
          {s.menu && (
            <div style={st.dropdown}>
              <button 
                onClick={() => {
                  up({ menu: false, login: true });
                }} 
                style={{...st.dropItem, ":hover": {backgroundColor: "rgba(255, 255, 255, 0.1)"}}}
                onMouseEnter={e => e.target.style.backgroundColor = "rgba(255, 255, 255, 0.1)"}
                onMouseLeave={e => e.target.style.backgroundColor = "transparent"}
              >
                Switch Account
              </button>
              <button 
                onClick={() => { 
                  if (window.confirm("Are you sure you want to clear all data?")) {
                    stor.set('susRolls_allUsers', '');
                    stor.set('susRolls_currentUser', '');
                    setS({ 
                      chars: [], coll: [], view: "roll", rolling: false, count: 0, claimed: null,
                      menu: false, sort: "level", revealed: [], showing: false, rolls: 10,
                      idx: 0, timer: "", user: "", login: true, newUser: "", users: {},
                      friend: false, code: "", myCode: "", viewing: "" 
                    });
                  }
                  up({ menu: false });
                }} 
                style={{...st.dropItem, color: "#ef4444"}}
                onMouseEnter={e => e.target.style.backgroundColor = "rgba(239, 68, 68, 0.1)"}
                onMouseLeave={e => e.target.style.backgroundColor = "transparent"}
              >
                Clear All Data
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={st.btnGroup}>
        {s.view === "roll" && !s.viewing && (
          <div style={st.rollCont}>
            <button onClick={roll} disabled={s.rolling || s.rolls <= 0}
              style={{...st.btn, ...st.rollBtn, ...(s.rolling || s.rolls <= 0 ? st.disabled : {})}}>
              {s.rolling ? "Rolling..." : `Roll Character (${s.rolls} left)`}
            </button>
            {s.rolls > 0 && !s.rolling && <p style={st.spacer}>Press SPACEBAR to roll</p>}
          </div>
        )}
        
        {getColl().length > 0 && (
          <button onClick={() => up({ view: s.view === "roll" ? "collection" : "roll" })}
            style={{...st.btn, ...st.viewBtn}}>
            {s.view === "roll" ? "View Collection" : "Back to Roll"}
          </button>
        )}
      </div>

      {s.view === "roll" && !s.rolling && s.showing && s.chars.length > 0 && (
        <div>
          <div style={st.panel}>
            <h3 style={{ fontSize: "1.5rem", color: "#4ecdc4", margin: "0 0 1rem 0" }}>
              Your Rolled Characters ({s.chars.length}/10)
            </h3>
            {s.claimed ? 
              <p style={{ fontSize: "1rem", color: "#34d399", margin: "0", fontWeight: "600" }}>
                You have claimed your character for this hour
              </p> :
              <p style={{ fontSize: "1rem", color: "#fbbf24", margin: "0", fontWeight: "600" }}>
                Click "Claim" on ONE character to add it to your collection
              </p>
            }
          </div>
          
          <div style={st.grid}>
            {s.chars.map((char, i) => {
              const rar = getRar(char), owned = s.coll.find(c => c.id === char.id);
              const revealed = s.revealed.includes(i), claimed = s.claimed === char.id;
              
              return (
                <div key={`${char.id}-${i}`}>
                  {!revealed ? (
                    <div style={st.back}>
                      <div style={{ textAlign: "center" }}>
                        <Frog size={80} />
                        <div style={{ fontSize: "1.5rem", fontWeight: "600", color: "#4ecdc4", marginTop: "1rem" }}>Sus Rolls</div>
                        <div style={{ fontSize: "0.9rem", color: "#9aa0a6", marginTop: "0.5rem" }}>Character Card</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ ...st.card, borderColor: getCol(rar), borderWidth: '2px', boxShadow: `0 8px 32px ${getCol(rar)}20` }}>
                      <div style={{ ...st.rare, backgroundColor: getCol(rar) }}>{rar.toUpperCase()}</div>
                      {owned && <div style={st.owned}>OWNED LV.{owned.level}</div>}
                      <img src={char.image.large} alt={char.name.full} style={st.img}
                        onClick={() => {
                          const m = document.createElement('div');
                          m.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); display: flex; align-items: center; justify-content: center; z-index: 10000; cursor: pointer; backdrop-filter: blur(4px);`;
                          const img = document.createElement('img');
                          img.src = char.image.large;
                          img.style.cssText = `max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 12px; box-shadow: 0 0 50px rgba(255, 255, 255, 0.3);`;
                          m.appendChild(img);
                          document.body.appendChild(m);
                          m.onclick = () => document.body.removeChild(m);
                        }}
                      />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                        <div>
                          <h3 style={st.name}>
                            <a href={char.siteUrl} target="_blank" rel="noopener noreferrer" style={st.link}>
                              {char.name.full}
                            </a>
                          </h3>
                          <p style={st.detail}><strong>Series:</strong> {char.media.nodes[0]?.title?.romaji || "Unknown"}</p>
                          <p style={st.detail}><strong>Age:</strong> {char.age || "Unknown"}</p>
                          <p style={st.detail}><strong>Favorites:</strong> {(char.favourites || 0).toLocaleString()}</p>
                        </div>
                        <button onClick={() => claim(char)} disabled={s.claimed !== null}
                          style={{...st.claimBtn, ...(claimed ? st.claimedBtn : {}), ...(s.claimed !== null && !claimed ? st.disabled : {})}}>
                          {claimed ? "Claimed!" : (s.claimed !== null ? "Cannot Claim" : "Claim")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {s.view === "collection" && (
        <div>
          <div style={st.collHead}>
            <h2 style={st.collTitle}>
              {s.viewing ? `${s.viewing}'s Collection` : 'My Collection'} ({getColl().length})
            </h2>
            
            <div style={st.sort}>
              <label style={{ fontSize: "0.9rem", color: "#9aa0a6", fontWeight: "600" }}>Sort by:</label>
              <select value={s.sort} onChange={e => up({ sort: e.target.value })} style={st.select}>
                <option value="level">Level (High to Low)</option>
                <option value="favorites">Favorites (High to Low)</option>
                <option value="name">Name (A-Z)</option>
                <option value="series">Series (A-Z)</option>
                <option value="age">Age (High to Low)</option>
              </select>
            </div>
          </div>
          
          <div style={st.grid}>
            {getSorted().map(char => {
              const rar = getRar(char);
              
              return (
                <div key={char.id} style={{ ...st.card, borderColor: getCol(rar), borderWidth: '2px', boxShadow: `0 8px 32px ${getCol(rar)}20` }}>
                  <div style={{ ...st.rare, backgroundColor: getCol(rar) }}>{rar.toUpperCase()}</div>
                  <div style={st.level}>LV.{char.level || 1}</div>
                  <img src={char.image.large} alt={char.name.full} style={st.img}
                    onClick={() => {
                      const m = document.createElement('div');
                      m.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); display: flex; align-items: center; justify-content: center; z-index: 10000; cursor: pointer; backdrop-filter: blur(4px);`;
                      const img = document.createElement('img');
                      img.src = char.image.large;
                      img.style.cssText = `max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 12px; box-shadow: 0 0 50px rgba(255, 255, 255, 0.3);`;
                      m.appendChild(img);
                      document.body.appendChild(m);
                      m.onclick = () => document.body.removeChild(m);
                    }}
                  />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                    <div>
                      <h3 style={st.name}>
                        <a href={char.siteUrl} target="_blank" rel="noreferrer" style={st.link}>
                          {char.name.full}
                        </a>
                      </h3>
                      {char.age && <p style={st.detail}>Age: {char.age}</p>}
                      {char.media?.nodes[0]?.title?.romaji && <p style={st.detail}>From: {char.media.nodes[0].title.romaji}</p>}
                      <p style={st.detail}>Favorites: {(char.favourites || 0).toLocaleString()}</p>
                    </div>
                    {!s.viewing && (
                      <button onClick={() => {
                        if (window.confirm(`Remove ${char.name.full}?`)) {
                          const newColl = s.coll.filter(c => c.id !== char.id);
                          up({ coll: newColl });
                          saveUser({ collection: newColl });
                        }
                      }} style={st.remove}>Remove</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {getColl().length === 0 && (
            <p style={st.empty}>
              {s.viewing ? `${s.viewing} has no characters yet.` : "No characters in your collection yet. Start rolling to collect some!"}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default SusRolls;