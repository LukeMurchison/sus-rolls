import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

const SusRolls = () => {
  // Core state
  const [state, setState] = useState({
    rolledCharacters: [], userCollection: [], view: "roll", isRolling: false,
    rollCount: 0, claimedCharacterId: null, showMenu: false, sortBy: "level",
    revealedCards: [], showingCards: false, availableRolls: 10, currentRollIndex: 0,
    timeUntilReset: "", currentUser: "", showLogin: false, newUsername: "",
    allUsers: {}, showAddFriend: false, friendCode: "", myFriendCode: "",
    viewingUser: ""
  });

  const lastRequestTime = useRef(0);
  const requestCount = useRef(0);
  const countdownTimer = useRef(null);
  const audioContextRef = useRef(null);

  // Storage helpers
  const storage = useMemo(() => ({
    get: (key) => {
      try { return localStorage?.getItem(key); } catch { return null; }
    },
    set: (key, value) => {
      try { localStorage?.setItem(key, value); return true; } catch { return false; }
    }
  }), []);

  // Update state helper
  const updateState = useCallback((updates) => setState(prev => ({ ...prev, ...updates })), []);

  // Time helpers
  const getNextResetTime = () => {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(now.getHours() + 1, 0, 0, 0);
    return nextHour;
  };

  const shouldResetRolls = (lastResetTime) => {
    if (!lastResetTime) return true;
    const now = new Date();
    const lastReset = new Date(lastResetTime);
    return now.getHours() !== lastReset.getHours() || now.getDate() !== lastReset.getDate();
  };

  // User data management
  const saveAllUsers = useCallback((users) => {
    storage.set('susRolls_allUsers', JSON.stringify(users));
  }, [storage]);

  const saveUserData = useCallback((updates) => {
    if (!state.currentUser) return;
    const updatedUsers = { 
      ...state.allUsers, 
      [state.currentUser]: { ...state.allUsers[state.currentUser], ...updates }
    };
    updateState({ allUsers: updatedUsers });
    saveAllUsers(updatedUsers);
  }, [state.currentUser, state.allUsers, updateState, saveAllUsers]);

  // Audio system
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch { return null; }
    }
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(() => {});
    }
    return audioContextRef.current;
  }, []);

  const playSound = useCallback((type) => {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    
    const createTone = (frequency, duration, waveType = 'sine', volume = 0.15) => {
      try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = waveType;
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
      } catch {}
    };

    const sounds = {
      roll_start: () => {
        [440, 554, 659].forEach((freq, i) => setTimeout(() => createTone(freq, 0.8, 'sine', 0.12), i * 50));
        setTimeout(() => [523, 659, 784].forEach((freq, i) => setTimeout(() => createTone(freq, 0.6, 'sine', 0.1), i * 50)), 200);
      },
      card_reveal: () => {
        createTone(800, 0.15, 'triangle', 0.15);
        setTimeout(() => createTone(1000, 0.15), 80);
        setTimeout(() => createTone(1200, 0.2), 160);
      },
      rare_reveal: () => {
        [[880, 1100, 1320], [1100, 1320, 1580], [1320, 1580, 1880]].forEach((freqs, i) => 
          setTimeout(() => freqs.forEach((freq, j) => setTimeout(() => createTone(freq, 0.4 + i * 0.1, 'sine', 0.15 - i * 0.025), j * 50)), i * 200)
        );
      },
      claim: () => {
        [659, 784, 988].forEach((freq, i) => setTimeout(() => createTone(freq, 0.2 + i * 0.05), i * 100));
      },
      whoosh: () => {
        for(let i = 0; i < 5; i++) setTimeout(() => createTone(400 + i * 100, 0.3, 'sawtooth', 0.08), i * 80);
      }
    };
    sounds[type]?.();
  }, [getAudioContext]);

  // Character helpers
  const getCharacterRarity = useCallback((character) => {
    const favourites = character.favourites || 0;
    if (favourites >= 10000) return "legendary";
    if (favourites >= 3000) return "epic";
    if (favourites >= 800) return "uncommon";
    return "common";
  }, []);

  const getRarityColor = useCallback((rarity) => {
    const colors = { legendary: "#ffd700", epic: "#9d4edd", uncommon: "#20c997", common: "#6c757d" };
    return colors[rarity] || colors.common;
  }, []);

  // Countdown timer
  const updateCountdown = useCallback(() => {
    const now = new Date();
    const nextReset = getNextResetTime();
    const timeDiff = nextReset - now;
    
    if (timeDiff <= 0) {
      if (state.currentUser) {
        const resetData = {
          availableRolls: 10, rolledCharacters: [], currentRollIndex: 0,
          claimedCharacterId: null, lastResetTime: new Date().toISOString()
        };
        saveUserData(resetData);
        updateState({ ...resetData, revealedCards: [], showingCards: false });
      }
      return;
    }

    const minutes = Math.floor(timeDiff / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    updateState({ timeUntilReset: `${minutes}:${seconds.toString().padStart(2, '0')}` });
  }, [state.currentUser, saveUserData, updateState]);

  // Load user data
  const loadUserData = useCallback((username, users = state.allUsers) => {
    if (!users[username]) return;
    
    const userData = users[username];
    const baseData = {
      userCollection: userData.collection || [],
      rollCount: userData.rollCount || 0
    };

    if (shouldResetRolls(userData.lastResetTime)) {
      const resetData = {
        availableRolls: 10, rolledCharacters: [], currentRollIndex: 0,
        claimedCharacterId: null, revealedCards: [], showingCards: false
      };
      updateState({ ...baseData, ...resetData });
      saveUserData({ ...resetData, lastResetTime: new Date().toISOString() });
    } else {
      const rollData = {
        availableRolls: userData.availableRolls ?? 10,
        rolledCharacters: userData.rolledCharacters || [],
        currentRollIndex: userData.currentRollIndex || 0,
        claimedCharacterId: userData.claimedCharacterId || null,
        revealedCards: Array.from({ length: userData.currentRollIndex || 0 }, (_, i) => i),
        showingCards: (userData.rolledCharacters || []).length > 0
      };
      updateState({ ...baseData, ...rollData });
    }
  }, [state.allUsers, updateState, saveUserData]);

  // Rate limiting
  const waitForRateLimit = useCallback(async (minDelay = 500) => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime.current;
    
    if (timeSinceLastRequest > 60000) requestCount.current = 0;
    if (requestCount.current > 10) minDelay = 2000;
    else if (requestCount.current > 5) minDelay = 1000;
    
    if (timeSinceLastRequest < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest));
    }
    
    lastRequestTime.current = Date.now();
    requestCount.current++;
  }, []);

  // Main roll function
  const rollSingleCharacter = useCallback(async () => {
    if (!state.currentUser) return alert("Please login first!");
    if (state.availableRolls <= 0) return alert("No rolls remaining! Wait for the next hourly reset.");
    if (state.isRolling) return;
    
    updateState({ isRolling: true });
    playSound('roll_start');
    
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          characters {
            id name { full } image { large } age siteUrl favourites
            media(perPage: 3, sort: [POPULARITY_DESC]) {
              nodes { title { romaji } popularity }
            }
          }
        }
      }`;

    try {
      let character = null;
      let attempts = 0;
      
      while (!character && attempts < 10) {
        try {
          const randomPage = Math.floor(Math.random() * 5000) + 1;
          await waitForRateLimit(600);
          
          const response = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Accept": "application/json" },
            body: JSON.stringify({ query, variables: { page: randomPage, perPage: 25 } }),
          });
          
          if (!response.ok) { attempts++; continue; }
          
          const data = await response.json();
          const characters = data.data?.Page?.characters || [];
          
          const validCharacters = characters.filter(char => 
            char?.name?.full && char?.image?.large && (!char.age || parseInt(char.age) >= 18)
          );
          
          if (validCharacters.length === 0) { attempts++; continue; }
          character = validCharacters[Math.floor(Math.random() * validCharacters.length)];
        } catch { attempts++; }
      }
      
      if (!character) return alert("Unable to fetch character. Please try again in a moment.");
      
      const newRolledCharacters = [...state.rolledCharacters, character];
      const newAvailableRolls = state.availableRolls - 1;
      
      updateState({ 
        rolledCharacters: newRolledCharacters, 
        availableRolls: newAvailableRolls,
        showingCards: true
      });
      
      saveUserData({
        availableRolls: newAvailableRolls,
        rolledCharacters: newRolledCharacters,
        rollCount: state.rollCount + 1
      });
      
      playSound('whoosh');
      setTimeout(() => {
        const rarity = getCharacterRarity(character);
        playSound(rarity === 'legendary' ? 'rare_reveal' : 'card_reveal');
        const newIndex = state.rolledCharacters.length;
        updateState({ 
          revealedCards: [...state.revealedCards, newIndex],
          currentRollIndex: newIndex + 1
        });
        saveUserData({ currentRollIndex: newIndex + 1 });
      }, 500);

    } catch (error) {
      alert("Rolling failed. Please try again in a moment.");
    } finally {
      updateState({ isRolling: false });
    }
  }, [state, updateState, saveUserData, playSound, getCharacterRarity, waitForRateLimit]);

  // Event handlers
  const handleClaimCharacter = useCallback((character) => {
    if (state.claimedCharacterId) return alert("You can only claim one character per hour! Wait for the reset.");
    
    playSound('claim');
    const newCollection = [...state.userCollection];
    const existing = newCollection.find(c => c.id === character.id);
    
    if (existing) existing.level = (existing.level || 1) + 1;
    else newCollection.push({ ...character, level: 1 });
    
    updateState({ userCollection: newCollection, claimedCharacterId: character.id });
    saveUserData({ collection: newCollection, claimedCharacterId: character.id });
  }, [state.claimedCharacterId, state.userCollection, updateState, saveUserData, playSound]);

  const createAccount = useCallback(() => {
    if (!state.newUsername.trim()) return;
    if (state.allUsers[state.newUsername]) return alert("Username already exists! Please choose a different one.");
    
    const updatedUsers = { 
      ...state.allUsers, 
      [state.newUsername]: { 
        collection: [], rollCount: 0, friends: [], availableRolls: 10,
        rolledCharacters: [], currentRollIndex: 0, claimedCharacterId: null,
        lastResetTime: new Date().toISOString()
      }
    };
    
    updateState({
      allUsers: updatedUsers, currentUser: state.newUsername, userCollection: [],
      rollCount: 0, availableRolls: 10, rolledCharacters: [], currentRollIndex: 0,
      claimedCharacterId: null, showLogin: false, newUsername: ""
    });
    
    saveAllUsers(updatedUsers);
    storage.set('susRolls_currentUser', state.newUsername);
  }, [state.newUsername, state.allUsers, updateState, saveAllUsers, storage]);

  // Effects
  useEffect(() => {
    updateCountdown();
    countdownTimer.current = setInterval(updateCountdown, 1000);
    return () => clearInterval(countdownTimer.current);
  }, [updateCountdown]);

  useEffect(() => {
    const savedUsers = storage.get('susRolls_allUsers');
    const savedCurrentUser = storage.get('susRolls_currentUser');
    
    if (savedUsers) {
      try {
        const parsedUsers = JSON.parse(savedUsers);
        updateState({ allUsers: parsedUsers });
        
        if (savedCurrentUser && parsedUsers[savedCurrentUser]) {
          updateState({ currentUser: savedCurrentUser, showLogin: false });
          loadUserData(savedCurrentUser, parsedUsers);
        } else {
          updateState({ showLogin: true });
        }
      } catch {
        updateState({ showLogin: true });
      }
    } else {
      updateState({ showLogin: true });
    }
  }, [storage, updateState, loadUserData]);

  useEffect(() => {
    const handleKeyPress = (event) => {
      if (event.code === 'Space' && !state.showLogin && !state.showAddFriend && 
          !state.showMenu && state.view === "roll" && !state.viewingUser) {
        event.preventDefault();
        rollSingleCharacter();
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [state.showLogin, state.showAddFriend, state.showMenu, state.view, state.viewingUser, rollSingleCharacter]);

  useEffect(() => {
    if (state.currentUser) {
      const friendCode = btoa(state.currentUser).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
      updateState({ myFriendCode: friendCode });
    }
  }, [state.currentUser, updateState]);

  // Computed values
  const getDisplayCollection = () => state.viewingUser && state.allUsers[state.viewingUser] ? 
    state.allUsers[state.viewingUser].collection || [] : state.userCollection;
  
  const getDisplayUser = () => state.viewingUser || state.currentUser;
  
  const getFriends = () => state.currentUser && state.allUsers[state.currentUser] ? 
    state.allUsers[state.currentUser].friends || [] : [];

  const getSortedCollection = () => {
    const collection = getDisplayCollection();
    const sorted = [...collection];
    const sorters = {
      name: (a, b) => a.name.full.localeCompare(b.name.full),
      series: (a, b) => (a.media?.nodes[0]?.title?.romaji || "Unknown").localeCompare(b.media?.nodes[0]?.title?.romaji || "Unknown"),
      age: (a, b) => (parseInt(b.age) || 0) - (parseInt(a.age) || 0),
      favorites: (a, b) => (b.favourites || 0) - (a.favourites || 0),
      level: (a, b) => (b.level || 1) - (a.level || 1)
    };
    return sorted.sort(sorters[state.sortBy] || sorters.level);
  };

  // Styles (condensed)
  const s = {
    app: { textAlign: "center", padding: "2rem", fontFamily: "Arial, sans-serif", backgroundColor: "#1a1a2e", color: "#fff", minHeight: "100vh" },
    header: { marginBottom: "2rem", position: "relative" },
    title: { fontSize: "3rem", margin: "0 0 1rem 0", background: "linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" },
    stats: { display: "flex", justifyContent: "center", gap: "2rem", fontSize: "1.1rem", color: "#ccc" },
    userInfo: { display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginBottom: "1rem", flexWrap: "wrap" },
    currentUser: { fontSize: "1.2rem", color: "#4ecdc4", fontWeight: "bold", textShadow: "0 0 10px rgba(78, 205, 196, 0.5)" },
    rollStatus: { display: "flex", alignItems: "center", gap: "1rem", fontSize: "1rem", flexWrap: "wrap" },
    rollsRemaining: { color: "#4ecdc4", fontWeight: "bold", textShadow: "0 0 10px rgba(78, 205, 196, 0.5)" },
    resetTimer: { color: "#ff6b6b", fontWeight: "bold", textShadow: "0 0 10px rgba(255, 107, 107, 0.5)" },
    menuContainer: { position: "absolute", top: "10px", right: "10px" },
    hamburgerButton: { background: "rgba(255, 255, 255, 0.1)", border: "2px solid rgba(255, 255, 255, 0.3)", color: "#fff", fontSize: "1.5rem", padding: "8px 12px", borderRadius: "8px", cursor: "pointer" },
    dropdown: { position: "absolute", top: "100%", right: "0", marginTop: "5px", backgroundColor: "#16213e", border: "2px solid rgba(255, 255, 255, 0.3)", borderRadius: "8px", minWidth: "150px", boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)", zIndex: 1000 },
    dropdownItem: { width: "100%", background: "none", border: "none", color: "#fff", padding: "12px 16px", textAlign: "left", cursor: "pointer", fontSize: "0.9rem" },
    button: { padding: "12px 24px", fontSize: "1.1rem", border: "none", borderRadius: "25px", cursor: "pointer", fontWeight: "bold", transition: "all 0.3s ease" },
    rollButton: { background: "linear-gradient(45deg, #6c47ff, #9d4edd)", color: "white" },
    viewButton: { background: "linear-gradient(45deg, #4ecdc4, #45b7d1)", color: "white" },
    cardGrid: { display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "20px", justifyItems: "center", marginTop: "20px", maxWidth: "1400px", margin: "20px auto 0 auto" },
    card: { width: "250px", minHeight: "400px", border: "2px solid #ddd", borderRadius: "15px", padding: "15px", textAlign: "center", backgroundColor: "#16213e", boxShadow: "0 8px 16px rgba(0, 0, 0, 0.3)", position: "relative", display: "flex", flexDirection: "column" },
    cardBack: { width: "250px", minHeight: "400px", border: "3px solid #4ecdc4", borderRadius: "15px", backgroundColor: "#16213e", boxShadow: "0 8px 16px rgba(0, 0, 0, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)" },
    cardImage: { width: "100%", height: "auto", maxHeight: "300px", objectFit: "contain", borderRadius: "10px", cursor: "pointer" },
    rarityBadge: { position: "absolute", top: "10px", right: "10px", padding: "4px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: "bold", color: "white" },
    claimButton: { background: "linear-gradient(45deg, #28a745, #20c997)", color: "white", border: "none", padding: "10px 20px", borderRadius: "20px", cursor: "pointer", fontSize: "0.9rem", fontWeight: "bold", marginTop: "auto" },
    loginOverlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.8)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 10000 },
    loginModal: { backgroundColor: "#16213e", border: "3px solid #4ecdc4", borderRadius: "20px", padding: "2rem", textAlign: "center", maxWidth: "400px", width: "90%" },
    loginInput: { padding: "12px 16px", fontSize: "1rem", border: "2px solid rgba(255, 255, 255, 0.3)", borderRadius: "10px", backgroundColor: "#1a1a2e", color: "#fff", outline: "none" },
    loginButton: { background: "linear-gradient(45deg, #4ecdc4, #45b7d1)", color: "white", border: "none", padding: "12px 24px", borderRadius: "20px", fontSize: "1rem", fontWeight: "bold", cursor: "pointer" }
  };

  return (
    <div style={s.app}>
      {/* Login Modal */}
      {state.showLogin && (
        <div style={s.loginOverlay}>
          <div style={s.loginModal}>
            <h2 style={{ fontSize: "2rem", margin: "0 0 1rem 0", color: "#4ecdc4" }}>Welcome to Sus Rolls!</h2>
            <p style={{ fontSize: "1rem", color: "#ccc", marginBottom: "2rem" }}>Create an account or login to start collecting</p>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
              <input
                type="text" placeholder="Enter username" value={state.newUsername}
                onChange={(e) => updateState({ newUsername: e.target.value })} style={s.loginInput}
                onKeyPress={(e) => e.key === 'Enter' && createAccount()}
              />
              <button onClick={createAccount} style={s.loginButton}>Create Account</button>
            </div>
            
            {Object.keys(state.allUsers).length > 0 && (
              <div style={{ borderTop: "1px solid rgba(255, 255, 255, 0.2)", paddingTop: "1.5rem" }}>
                <p style={{ fontSize: "0.9rem", color: "#ccc", marginBottom: "1rem" }}>Or login as existing user:</p>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {Object.keys(state.allUsers).map(username => (
                    <button key={username} onClick={() => {
                      updateState({ currentUser: username, showLogin: false });
                      loadUserData(username);
                      storage.set('susRolls_currentUser', username);
                    }} style={{ background: "rgba(255, 255, 255, 0.1)", border: "1px solid rgba(255, 255, 255, 0.3)", color: "#fff", padding: "8px 16px", borderRadius: "10px", cursor: "pointer" }}>
                      {username} ({state.allUsers[username]?.collection?.length || 0} cards)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={s.header}>
        <h1 style={s.title}>✨ Sus Rolls ✨</h1>
        <div style={s.userInfo}>
          <span style={s.currentUser}>👤 {getDisplayUser()}</span>
          {!state.viewingUser && (
            <div style={s.rollStatus}>
              <span style={s.rollsRemaining}>🎲 Rolls: {state.availableRolls}/10</span>
              <span style={s.resetTimer}>⏰ Reset: {state.timeUntilReset}</span>
              {state.claimedCharacterId && <span style={{ color: "#28a745", fontWeight: "bold" }}>✅ Claimed</span>}
            </div>
          )}
        </div>
        <div style={s.stats}>
          <span>Total Rolls: {state.viewingUser ? (state.allUsers[state.viewingUser]?.rollCount || 0) : state.rollCount}</span>
          <span>Collection: {getDisplayCollection().length}</span>
        </div>
        
        <div style={s.menuContainer}>
          <button onClick={() => updateState({ showMenu: !state.showMenu })} style={s.hamburgerButton}>☰</button>
          {state.showMenu && (
            <div style={s.dropdown}>
              <button onClick={() => updateState({ showLogin: true })} style={s.dropdownItem}>👤 Switch Account</button>
              <button onClick={() => { 
                if (window.confirm("Are you sure you want to clear all data?")) {
                  storage.set('susRolls_allUsers', '');
                  storage.set('susRolls_currentUser', '');
                  setState({
                    rolledCharacters: [], userCollection: [], view: "roll", isRolling: false,
                    rollCount: 0, claimedCharacterId: null, showMenu: false, sortBy: "level",
                    revealedCards: [], showingCards: false, availableRolls: 10, currentRollIndex: 0,
                    timeUntilReset: "", currentUser: "", showLogin: true, newUsername: "",
                    allUsers: {}, showAddFriend: false, friendCode: "", myFriendCode: "", viewingUser: ""
                  });
                }
              }} style={s.dropdownItem}>🗑️ Clear All Data</button>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginBottom: "2rem", flexWrap: "wrap" }}>
        {state.view === "roll" && !state.viewingUser && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <button 
              onClick={rollSingleCharacter} 
              disabled={state.isRolling || state.availableRolls <= 0}
              style={{ ...s.button, ...s.rollButton, ...(state.isRolling || state.availableRolls <= 0 ? {opacity: 0.6} : {}) }}
            >
              {state.isRolling ? "Rolling..." : `🎲 Roll Character (${state.availableRolls} left)`}
            </button>
            {state.availableRolls > 0 && !state.isRolling && <p style={{ fontSize: "0.9rem", color: "#ccc", fontStyle: "italic" }}>Press SPACEBAR to roll!</p>}
          </div>
        )}
        
        {getDisplayCollection().length > 0 && (
          <button 
            onClick={() => updateState({ view: state.view === "roll" ? "collection" : "roll" })}
            style={{...s.button, ...s.viewButton}}
          >
            {state.view === "roll" ? "📚 View Collection" : "🎲 Back to Roll"}
          </button>
        )}
      </div>

      {state.view === "roll" && !state.isRolling && state.showingCards && state.rolledCharacters.length > 0 && (
        <div>
          <div style={{ textAlign: "center", marginBottom: "2rem", padding: "1rem", backgroundColor: "rgba(78, 205, 196, 0.1)", borderRadius: "15px", border: "2px solid rgba(78, 205, 196, 0.3)" }}>
            <h3 style={{ fontSize: "1.5rem", color: "#4ecdc4", margin: "0 0 1rem 0" }}>Your Rolled Characters ({state.rolledCharacters.length}/10)</h3>
            {state.claimedCharacterId ? 
              <p style={{ fontSize: "1.1rem", color: "#28a745", margin: "0", fontWeight: "bold" }}>✅ You have claimed your character for this hour!</p> :
              <p style={{ fontSize: "1.1rem", color: "#ffd700", margin: "0", fontWeight: "bold" }}>💡 Click "Claim" on ONE character to add it to your collection!</p>
            }
          </div>
          
          <div style={s.cardGrid}>
            {state.rolledCharacters.map((char, index) => {
              const rarity = getCharacterRarity(char);
              const isOwned = state.userCollection.find(c => c.id === char.id);
              const isRevealed = state.revealedCards.includes(index);
              const isClaimed = state.claimedCharacterId === char.id;
              
              return (
                <div key={`${char.id}-${index}`}>
                  {!isRevealed ? (
                    <div style={s.cardBack}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ fontSize: "4rem", marginBottom: "1rem", opacity: 0.8 }}>🎴</div>
                        <div style={{ fontSize: "1.5rem", fontWeight: "bold", color: "#4ecdc4", marginBottom: "0.5rem" }}>Sus Rolls</div>
                        <div style={{ fontSize: "1rem", color: "#ccc", opacity: 0.8 }}>Character Card</div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ ...s.card, borderColor: getRarityColor(rarity), borderWidth: '3px' }}>
                      <div style={{ ...s.rarityBadge, backgroundColor: getRarityColor(rarity) }}>{rarity.toUpperCase()}</div>
                      {isOwned && <div style={{ position: "absolute", top: "10px", left: "10px", padding: "4px 8px", borderRadius: "12px", fontSize: "0.7rem", fontWeight: "bold", backgroundColor: "#28a745", color: "white" }}>OWNED LV.{isOwned.level}</div>}
                      <img 
                        src={char.image.large} alt={char.name.full} style={s.cardImage}
                        onClick={() => {
                          const modal = document.createElement('div');
                          modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); display: flex; align-items: center; justify-content: center; z-index: 10000; cursor: pointer;`;
                          const img = document.createElement('img');
                          img.src = char.image.large;
                          img.style.cssText = `max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 10px; box-shadow: 0 0 50px rgba(255, 255, 255, 0.3);`;
                          modal.appendChild(img);
                          document.body.appendChild(modal);
                          modal.onclick = () => document.body.removeChild(modal);
                        }}
                      />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", paddingTop: "10px" }}>
                        <div>
                          <h3 style={{ margin: "8px 0", fontSize: "1.1rem", color: "#fff", fontWeight: "bold" }}>
                            <a href={char.siteUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#4ecdc4", textDecoration: "none" }}>
                              {char.name.full}
                            </a>
                          </h3>
                          <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#ccc" }}><strong>Series:</strong> {char.media.nodes[0]?.title?.romaji || "Unknown"}</p>
                          <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#ccc" }}><strong>Age:</strong> {char.age || "?"}</p>
                          <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#ccc" }}><strong>Favorites:</strong> {char.favourites || 0}</p>
                        </div>
                        <button 
                          onClick={() => handleClaimCharacter(char)}
                          disabled={state.claimedCharacterId !== null}
                          style={{
                            ...s.claimButton,
                            ...(isClaimed ? { background: "linear-gradient(45deg, #ffd700, #ffed4e)", color: "#000", fontWeight: "bold", transform: "scale(1.05)" } : {}),
                            ...(state.claimedCharacterId !== null && !isClaimed ? { background: "#6c757d", cursor: "not-allowed", opacity: 0.6 } : {})
                          }}
                        >
                          {isClaimed ? "Claimed!" : (state.claimedCharacterId !== null ? "Cannot Claim" : "Claim")}
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

      {state.view === "collection" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem", flexWrap: "wrap", gap: "1rem" }}>
            <h2 style={{ margin: "0", fontSize: "2rem", color: "#4ecdc4" }}>
              {state.viewingUser ? `${state.viewingUser}'s Collection` : 'My Collection'} ({getDisplayCollection().length})
            </h2>
            
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label style={{ fontSize: "1rem", color: "#ccc" }}>Sort by: </label>
              <select 
                value={state.sortBy} 
                onChange={(e) => updateState({ sortBy: e.target.value })}
                style={{ background: "#16213e", color: "#fff", border: "2px solid rgba(255, 255, 255, 0.3)", borderRadius: "8px", padding: "8px 12px", fontSize: "0.9rem", cursor: "pointer" }}
              >
                <option value="level">Level (High to Low)</option>
                <option value="favorites">Favorites (High to Low)</option>
                <option value="name">Name (A-Z)</option>
                <option value="series">Series (A-Z)</option>
                <option value="age">Age (High to Low)</option>
              </select>
            </div>
          </div>
          
          <div style={s.cardGrid}>
            {getSortedCollection().map((char) => {
              const rarity = getCharacterRarity(char);
              
              return (
                <div key={char.id} style={{ ...s.card, borderColor: getRarityColor(rarity), borderWidth: '3px' }}>
                  <div style={{ ...s.rarityBadge, backgroundColor: getRarityColor(rarity) }}>{rarity.toUpperCase()}</div>
                  <div style={{ position: "absolute", top: "10px", left: "10px", padding: "6px 10px", borderRadius: "15px", fontSize: "0.8rem", fontWeight: "bold", backgroundColor: "#ffd700", color: "#000" }}>LV.{char.level || 1}</div>
                  <img 
                    src={char.image.large} alt={char.name.full} style={s.cardImage}
                    onClick={() => {
                      const modal = document.createElement('div');
                      modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.9); display: flex; align-items: center; justify-content: center; z-index: 10000; cursor: pointer;`;
                      const img = document.createElement('img');
                      img.src = char.image.large;
                      img.style.cssText = `max-width: 90%; max-height: 90%; object-fit: contain; border-radius: 10px; box-shadow: 0 0 50px rgba(255, 255, 255, 0.3);`;
                      modal.appendChild(img);
                      document.body.appendChild(modal);
                      modal.onclick = () => document.body.removeChild(modal);
                    }}
                  />
                  <h3 style={{ margin: "8px 0", fontSize: "1.1rem", color: "#fff", fontWeight: "bold" }}>
                    <a href={char.siteUrl} target="_blank" rel="noreferrer" style={{ color: "#4ecdc4", textDecoration: "none" }}>
                      {char.name.full}
                    </a>
                  </h3>
                  {char.age && <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#ccc" }}>Age: {char.age}</p>}
                  {char.media?.nodes[0]?.title?.romaji && (
                    <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#ccc" }}>From: {char.media.nodes[0].title.romaji}</p>
                  )}
                  <p style={{ margin: "4px 0", fontSize: "0.85rem", color: "#ccc" }}>Favorites: {char.favourites || 0}</p>
                  {!state.viewingUser && (
                    <button 
                      onClick={() => {
                        const newCollection = state.userCollection.filter(c => c.id !== char.id);
                        updateState({ userCollection: newCollection });
                        saveUserData({ collection: newCollection });
                      }}
                      style={{ background: "#dc3545", color: "white", border: "none", padding: "6px 12px", borderRadius: "15px", cursor: "pointer", fontSize: "0.8rem", marginTop: "10px" }}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {getDisplayCollection().length === 0 && (
            <p style={{ fontSize: "1.2rem", color: "#666", marginTop: "3rem" }}>
              {state.viewingUser ? `${state.viewingUser} has no characters yet.` : "No characters in your collection yet. Start rolling!"}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

// Add CSS animations
const animationKeyframes = `
  @keyframes cardReveal {
    0% { transform: rotateY(180deg) scale(0.3) translateY(-100px); opacity: 0; }
    50% { transform: rotateY(90deg) scale(1.1) translateY(-20px); opacity: 0.8; }
    100% { transform: rotateY(0deg) scale(1) translateY(0px); opacity: 1; box-shadow: 0 8px 30px rgba(255, 215, 0, 0.4); }
  }
`;

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = animationKeyframes;
  document.head.appendChild(style);
}

export default SusRolls;