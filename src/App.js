import React, { useState, useEffect, useRef } from "react";

const SusRolls = () => {
  const [rolledCharacters, setRolledCharacters] = useState([]);
  const [userCollection, setUserCollection] = useState([]);
  const [view, setView] = useState("roll");
  const [isRolling, setIsRolling] = useState(false);
  const [rollCount, setRollCount] = useState(0);
  const [claimedCharacterId, setClaimedCharacterId] = useState(null);
  const [showMenu, setShowMenu] = useState(false);
  const [sortBy, setSortBy] = useState("level");
  const [revealedCards, setRevealedCards] = useState([]);
  const [showingCards, setShowingCards] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [showLogin, setShowLogin] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [allUsers, setAllUsers] = useState({});
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendCode, setFriendCode] = useState("");
  const [myFriendCode, setMyFriendCode] = useState("");
  const [viewingUser, setViewingUser] = useState("");

  // Persistent storage that works in this environment
  const storageRef = useRef({
    collection: [],
    rollCount: 0
  });

  // Track API requests to prevent rate limiting
  const lastRequestTime = useRef(0);
  const requestCount = useRef(0);

  // Load user data and accounts
  useEffect(() => {
    // Initialize with session storage since localStorage isn't available
    setShowLogin(true);
  }, []);

  // Generate or get friend code for current user
  useEffect(() => {
    if (currentUser) {
      const friendCode = btoa(currentUser).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
      setMyFriendCode(friendCode);
    }
  }, [currentUser]);

  const addFriend = () => {
    if (!friendCode.trim()) return;
    
    // Find user by friend code
    const friendUser = Object.keys(allUsers).find(username => {
      const code = btoa(username).replace(/[^a-zA-Z0-9]/g, '').substring(0, 8).toUpperCase();
      return code === friendCode.toUpperCase();
    });
    
    if (!friendUser) {
      alert("Friend code not found! Make sure your friend has created an account.");
      return;
    }
    
    if (friendUser === currentUser) {
      alert("You can't add yourself as a friend!");
      return;
    }
    
    // Add to friends list
    const updatedUsers = { ...allUsers };
    if (!updatedUsers[currentUser].friends) updatedUsers[currentUser].friends = [];
    if (!updatedUsers[currentUser].friends.includes(friendUser)) {
      updatedUsers[currentUser].friends.push(friendUser);
      setAllUsers(updatedUsers);
      alert(`Added ${friendUser} as a friend!`);
    } else {
      alert("This person is already your friend!");
    }
    
    setFriendCode("");
    setShowAddFriend(false);
  };

  const getFriends = () => {
    if (!currentUser || !allUsers[currentUser]) return [];
    return allUsers[currentUser].friends || [];
  };

  const saveCollection = (collection) => {
    if (!currentUser) return;
    
    const updatedUsers = { ...allUsers };
    if (!updatedUsers[currentUser]) updatedUsers[currentUser] = {};
    updatedUsers[currentUser].collection = collection;
    setAllUsers(updatedUsers);
    storageRef.current.collection = collection;
  };

  const saveRollCount = (count) => {
    if (!currentUser) return;
    
    const updatedUsers = { ...allUsers };
    if (!updatedUsers[currentUser]) updatedUsers[currentUser] = {};
    updatedUsers[currentUser].rollCount = count;
    setAllUsers(updatedUsers);
    storageRef.current.rollCount = count;
    setRollCount(count);
  };

  const loadUserData = (username) => {
    if (allUsers[username]) {
      setUserCollection(allUsers[username].collection || []);
      setRollCount(allUsers[username].rollCount || 0);
      storageRef.current.collection = allUsers[username].collection || [];
      storageRef.current.rollCount = allUsers[username].rollCount || 0;
    }
  };

  const createAccount = () => {
    if (!newUsername.trim()) return;
    
    const updatedUsers = { ...allUsers };
    
    if (updatedUsers[newUsername]) {
      alert("Username already exists! Please choose a different one.");
      return;
    }
    
    updatedUsers[newUsername] = { collection: [], rollCount: 0, friends: [] };
    
    setAllUsers(updatedUsers);
    setCurrentUser(newUsername);
    setUserCollection([]);
    setRollCount(0);
    setShowLogin(false);
    setNewUsername("");
  };

  const switchUser = (username) => {
    setCurrentUser(username);
    loadUserData(username);
    setViewingUser("");
    setShowMenu(false);
  };

  const viewUserCollection = (username) => {
    setViewingUser(username);
    setView("collection");
    setShowMenu(false);
  };

  const getDisplayCollection = () => {
    if (viewingUser && allUsers[viewingUser]) {
      return allUsers[viewingUser].collection || [];
    }
    return userCollection;
  };

  const getDisplayUser = () => {
    return viewingUser || currentUser;
  };

  // Create a single audio context to prevent distortion
  const audioContextRef = React.useRef(null);
  
  const getAudioContext = () => {
    if (!audioContextRef.current) {
      try {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
      } catch (error) {
        console.log('Audio not supported');
        return null;
      }
    }
    
    // Resume context if it's suspended (fixes audio issues after multiple uses)
    if (audioContextRef.current.state === 'suspended') {
      audioContextRef.current.resume().catch(console.log);
    }
    
    return audioContextRef.current;
  };

  const playSound = (type) => {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    
    const createTone = (frequency, duration, type = 'sine', volume = 0.15) => {
      try {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0, audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + duration);
      } catch (error) {
        console.log('Audio error:', error);
      }
    };

    const createChord = (frequencies, duration, volume = 0.1) => {
      frequencies.forEach((freq, index) => {
        setTimeout(() => createTone(freq, duration, 'sine', volume), index * 50);
      });
    };

    switch(type) {
      case 'roll_start':
        createChord([440, 554, 659], 0.8, 0.12);
        setTimeout(() => createChord([523, 659, 784], 0.6, 0.1), 200);
        break;
      case 'card_reveal':
        createTone(800, 0.15, 'triangle', 0.15);
        setTimeout(() => createTone(1000, 0.15, 'sine', 0.12), 80);
        setTimeout(() => createTone(1200, 0.2, 'sine', 0.1), 160);
        break;
      case 'rare_reveal':
        createChord([880, 1100, 1320], 0.4, 0.15);
        setTimeout(() => createChord([1100, 1320, 1580], 0.5, 0.12), 200);
        setTimeout(() => createChord([1320, 1580, 1880], 0.6, 0.1), 400);
        break;
      case 'claim':
        createTone(659, 0.2, 'sine', 0.15);
        setTimeout(() => createTone(784, 0.2, 'sine', 0.12), 100);
        setTimeout(() => createTone(988, 0.3, 'sine', 0.1), 200);
        break;
      case 'whoosh':
        for(let i = 0; i < 5; i++) {
          setTimeout(() => {
            createTone(400 + (i * 100), 0.3, 'sawtooth', 0.08);
          }, i * 80);
        }
        break;
    }
  };

  const getSortedCollection = () => {
    const collection = getDisplayCollection();
    const sorted = [...collection];
    
    switch (sortBy) {
      case "name":
        return sorted.sort((a, b) => a.name.full.localeCompare(b.name.full));
      case "series":
        return sorted.sort((a, b) => {
          const seriesA = a.media?.nodes[0]?.title?.romaji || "Unknown";
          const seriesB = b.media?.nodes[0]?.title?.romaji || "Unknown";
          return seriesA.localeCompare(seriesB);
        });
      case "age":
        return sorted.sort((a, b) => {
          const ageA = parseInt(a.age) || 0;
          const ageB = parseInt(b.age) || 0;
          return ageB - ageA;
        });
      case "favorites":
        return sorted.sort((a, b) => (b.favourites || 0) - (a.favourites || 0));
      case "level":
      default:
        return sorted.sort((a, b) => (b.level || 1) - (a.level || 1));
    }
  };

  // Rate limiting helper
  const waitForRateLimit = async (minDelay = 500) => {
    const now = Date.now();
    const timeSinceLastRequest = now - lastRequestTime.current;
    
    // Reset request count every minute
    if (timeSinceLastRequest > 60000) {
      requestCount.current = 0;
    }
    
    // If we've made too many requests recently, wait longer
    if (requestCount.current > 10) {
      minDelay = 2000;
    } else if (requestCount.current > 5) {
      minDelay = 1000;
    }
    
    if (timeSinceLastRequest < minDelay) {
      await new Promise(resolve => setTimeout(resolve, minDelay - timeSinceLastRequest));
    }
    
    lastRequestTime.current = Date.now();
    requestCount.current++;
  };

  // Improved character fetching - one character per page for maximum diversity
  const getCharactersForPulls = async () => {
    if (!currentUser) {
      alert("Please login first!");
      return;
    }
    
    if (isRolling) return; // Prevent multiple concurrent rolls
    
    setIsRolling(true);
    setRolledCharacters([]);
    setRevealedCards([]);
    setShowingCards(false);
    
    playSound('roll_start');
    
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
          pageInfo {
            total
            lastPage
          }
          characters {
            id
            name {
              full
            }
            image {
              large
            }
            age
            siteUrl
            favourites
            media(perPage: 3, sort: [POPULARITY_DESC]) {
              nodes {
                title {
                  romaji
                }
                popularity
              }
            }
          }
        }
      }
    `;

    try {
      const results = [];
      const usedIds = new Set();
      const usedSeries = new Set();
      
      // First, get total page count
      let totalPages = 5000; // Default assumption
      try {
        await waitForRateLimit();
        const testResponse = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
          },
          body: JSON.stringify({ 
            query, 
            variables: { page: 1, perPage: 1 }
          }),
        });
        
        if (testResponse.ok) {
          const testData = await testResponse.json();
          if (testData.data?.Page?.pageInfo?.lastPage) {
            totalPages = Math.min(testData.data.Page.pageInfo.lastPage, 5000); // Cap at 5000 for performance
            console.log(`Total pages available: ${totalPages}`);
          }
        }
      } catch (error) {
        console.log('Could not determine total pages, using default range');
      }
      
      // Strategy: Get exactly one character per page from 5 completely random pages
      // This ensures maximum diversity across different series
      let attempts = 0;
      const maxAttempts = 20; // More attempts to ensure we get 5 good characters
      
      while (results.length < 5 && attempts < maxAttempts) {
        try {
          // Generate a truly random page number
          const randomPage = Math.floor(Math.random() * totalPages) + 1;
          
          console.log(`Attempt ${attempts + 1}: Fetching from page ${randomPage}`);
          
          // Add rate limiting delay
          await waitForRateLimit(600);
          
          const response = await fetch("https://graphql.anilist.co", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "application/json",
            },
            body: JSON.stringify({ 
              query, 
              variables: { page: randomPage, perPage: 25 } // Get 25 to have options
            }),
          });
          
          if (!response.ok) {
            console.log(`Request failed with status: ${response.status}`);
            attempts++;
            continue;
          }
          
          const data = await response.json();
          
          if (!data.data?.Page?.characters || data.data.Page.characters.length === 0) {
            console.log(`No characters found on page ${randomPage}`);
            attempts++;
            continue;
          }
          
          // Filter valid characters
          const validCharacters = data.data.Page.characters.filter((char) => {
            if (!char || !char.name?.full || !char.image?.large) return false;
            if (char.age && parseInt(char.age) < 18) return false;
            if (usedIds.has(char.id)) return false;
            
            // Check for series diversity (optional - prioritize but don't strictly enforce)
            const seriesName = char.media?.nodes[0]?.title?.romaji;
            if (seriesName && usedSeries.has(seriesName) && usedSeries.size < 4) {
              // If we have less than 4 unique series so far, try to avoid duplicates
              // But don't strictly enforce to avoid infinite loops
              return Math.random() > 0.7; // 30% chance to still include
            }
            
            return true;
          });
          
          if (validCharacters.length === 0) {
            console.log(`No valid characters found on page ${randomPage}`);
            attempts++;
            continue;
          }
          
          // Randomly select one character from this page
          const randomCharacter = validCharacters[Math.floor(Math.random() * validCharacters.length)];
          
          // Add to results
          results.push(randomCharacter);
          usedIds.add(randomCharacter.id);
          
          // Track series for diversity (but don't strictly enforce)
          const seriesName = randomCharacter.media?.nodes[0]?.title?.romaji;
          if (seriesName) {
            usedSeries.add(seriesName);
          }
          
          console.log(`Added character: ${randomCharacter.name.full} from ${seriesName || 'Unknown series'}`);
          
        } catch (error) {
          console.error(`Error on attempt ${attempts + 1}:`, error);
        }
        
        attempts++;
      }
      
      if (results.length === 0) {
        alert("Unable to fetch characters. Please try again in a moment.");
        setIsRolling(false);
        return;
      }
      
      // Final shuffle to randomize the order
      const finalResults = results.sort(() => Math.random() - 0.5);
      
      console.log(`Successfully fetched ${finalResults.length} characters from ${usedSeries.size} different series`);
      
      setRolledCharacters(finalResults);
      setIsRolling(false);
      setClaimedCharacterId(null);
      saveRollCount(rollCount + 1);
      
      // Start card reveal sequence
      playSound('whoosh');
      setShowingCards(true);
      
      // Reveal cards one by one
      finalResults.forEach((char, index) => {
        setTimeout(() => {
          const rarity = getCharacterRarity(char);
          playSound(rarity === 'legendary' ? 'rare_reveal' : 'card_reveal');
          setRevealedCards(prev => [...prev, index]);
        }, 200 + (index * 300));
      });

    } catch (error) {
      console.error("Error in getCharactersForPulls:", error);
      alert("Rolling failed. Please try again in a moment.");
      setIsRolling(false);
    }
  };

  const handleClaimCharacter = (character) => {
    if (claimedCharacterId) return;
    
    playSound('claim');
    
    const newCollection = [...userCollection];
    const existing = newCollection.find((c) => c.id === character.id);
    
    if (existing) {
      existing.level = (existing.level || 1) + 1;
    } else {
      newCollection.push({ ...character, level: 1 });
    }
    
    setUserCollection(newCollection);
    saveCollection(newCollection);
    setClaimedCharacterId(character.id);
  };

  const handleRemoveCharacter = (id) => {
    const newCollection = userCollection.filter((char) => char.id !== id);
    setUserCollection(newCollection);
    saveCollection(newCollection);
  };

  const clearAllData = () => {
    if (window.confirm("Are you sure you want to clear all data? This cannot be undone.")) {
      setUserCollection([]);
      setRollCount(0);
      setRolledCharacters([]);
      setCurrentUser("");
      setAllUsers({});
      setViewingUser("");
      storageRef.current = { collection: [], rollCount: 0 };
      setShowMenu(false);
      setShowLogin(true);
      // Reset API tracking
      requestCount.current = 0;
      lastRequestTime.current = 0;
    }
  };

  const getCharacterRarity = (character) => {
    const favourites = character.favourites || 0;
    const mediaPopularity = character.media?.nodes[0]?.popularity || 0;
    const totalPopularity = favourites + (mediaPopularity * 0.1); // Weight character favorites more heavily
    
    // Higher popularity = higher rarity (popular characters are harder to get)
    if (favourites >= 10000) return "legendary";  // Extremely popular characters (Naruto, Goku, etc.)
    if (favourites >= 3000) return "epic";        // Very popular characters  
    if (favourites >= 800) return "uncommon";     // Moderately popular characters
    return "common";                                    // Less popular characters (most common)
  };

  const getRarityColor = (rarity) => {
    switch (rarity) {
      case "legendary": return "#ffd700";  // Gold
      case "epic": return "#9d4edd";       // Purple
      case "uncommon": return "#20c997";   // Teal
      default: return "#6c757d";           // Gray
    }
  };

  return (
    <div style={styles.app}>
      {/* Login Modal */}
      {showLogin && (
        <div style={styles.loginOverlay}>
          <div style={styles.loginModal}>
            <h2 style={styles.loginTitle}>Welcome to Sus Rolls!</h2>
            <p style={styles.loginSubtext}>Create an account or login to start collecting</p>
            
            <div style={styles.loginForm}>
              <input
                type="text"
                placeholder="Enter username"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                style={styles.loginInput}
                onKeyPress={(e) => e.key === 'Enter' && createAccount()}
              />
              <button onClick={createAccount} style={styles.loginButton}>
                Create Account
              </button>
            </div>
            
            {Object.keys(allUsers).length > 0 && (
              <div style={styles.existingUsers}>
                <p style={styles.existingUsersTitle}>Or login as existing user:</p>
                <div style={styles.usersList}>
                  {Object.keys(allUsers).map(username => (
                    <button
                      key={username}
                      onClick={() => {
                        switchUser(username);
                        setShowLogin(false);
                      }}
                      style={styles.existingUserButton}
                    >
                      {username} ({allUsers[username]?.collection?.length || 0} cards)
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Friend Modal */}
      {showAddFriend && (
        <div style={styles.loginOverlay}>
          <div style={styles.loginModal}>
            <h2 style={styles.loginTitle}>Add Friend</h2>
            <p style={styles.loginSubtext}>Enter your friend's code to add them</p>
            
            <div style={styles.friendCodeDisplay}>
              <p style={styles.friendCodeLabel}>Your Friend Code:</p>
              <div style={styles.friendCodeBox}>
                <span style={styles.friendCode}>{myFriendCode}</span>
                <button 
                  onClick={() => navigator.clipboard.writeText(myFriendCode)}
                  style={styles.copyButton}
                >
                  📋 Copy
                </button>
              </div>
              <p style={styles.friendCodeHelp}>Share this code with friends so they can add you!</p>
            </div>
            
            <div style={styles.loginForm}>
              <input
                type="text"
                placeholder="Enter friend's code"
                value={friendCode}
                onChange={(e) => setFriendCode(e.target.value.toUpperCase())}
                style={styles.loginInput}
                onKeyPress={(e) => e.key === 'Enter' && addFriend()}
              />
              <div style={styles.modalButtons}>
                <button onClick={addFriend} style={styles.loginButton}>
                  Add Friend
                </button>
                <button 
                  onClick={() => {
                    setShowAddFriend(false);
                    setFriendCode("");
                  }} 
                  style={styles.cancelButton}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={styles.header}>
        <h1 style={styles.title}>✨ Sus Rolls ✨</h1>
        <div style={styles.userInfo}>
          <span style={styles.currentUser}>👤 {getDisplayUser()}</span>
          {viewingUser && (
            <button 
              onClick={() => {setViewingUser(""); setView("roll");}}
              style={styles.backButton}
            >
              ← Back to My Account
            </button>
          )}
        </div>
        <div style={styles.stats}>
          <span>Total Rolls: {viewingUser ? (allUsers[viewingUser]?.rollCount || 0) : rollCount}</span>
          <span>Collection: {getDisplayCollection().length}</span>
        </div>
        
        <div style={styles.menuContainer}>
          <button 
            onClick={() => setShowMenu(!showMenu)}
            style={styles.hamburgerButton}
          >
            ☰
          </button>
          {showMenu && (
            <div style={styles.dropdown}>
              {!viewingUser && (
                <>
                  <button onClick={() => setShowLogin(true)} style={styles.dropdownItem}>
                    👤 Switch Account
                  </button>
                  <button onClick={() => setShowAddFriend(true)} style={styles.dropdownItem}>
                    ➕ Add Friend
                  </button>
                  <div style={styles.dropdownDivider}></div>
                  <div style={styles.dropdownSection}>
                    <span style={styles.dropdownSectionTitle}>My Friends:</span>
                    {getFriends().length === 0 ? (
                      <span style={styles.noFriendsText}>No friends added yet</span>
                    ) : (
                      getFriends().map(username => (
                        <button
                          key={username}
                          onClick={() => viewUserCollection(username)}
                          style={styles.dropdownItem}
                        >
                          🔍 {username} ({allUsers[username]?.collection?.length || 0})
                        </button>
                      ))
                    )}
                  </div>
                  <div style={styles.dropdownDivider}></div>
                </>
              )}
              <button onClick={clearAllData} style={styles.dropdownItem}>
                🗑️ Clear All Data
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={styles.navigation}>
        {view === "roll" && !viewingUser && (
          <button 
            onClick={getCharactersForPulls} 
            disabled={isRolling}
            style={{
              ...styles.button, 
              ...styles.rollButton,
              ...(isRolling ? {opacity: 0.6, cursor: 'not-allowed'} : {})
            }}
          >
            {isRolling ? "Rolling..." : "🎲 Roll 5 Characters"}
          </button>
        )}
        
        {getDisplayCollection().length > 0 && (
          <button 
            onClick={() => setView(view === "roll" ? "collection" : "roll")}
            style={{...styles.button, ...styles.viewButton}}
          >
            {view === "roll" ? "📚 View Collection" : "🎲 Back to Roll"}
          </button>
        )}
      </div>

      {isRolling && (
        <div style={styles.loading}>
          <div style={styles.packContainer}>
            <div style={styles.magicalOrb}>
              <div style={styles.orbCore}>🔮</div>
              <div style={styles.orbGlow}></div>
            </div>
          </div>
          <p style={styles.loadingText}>Summoning characters from across the anime universe...</p>
          <p style={styles.loadingSubtext}>Finding diverse characters for maximum variety!</p>
        </div>
      )}

      {view === "roll" && !isRolling && showingCards && (
        <div>
          <div style={styles.cardGrid}>
            {rolledCharacters.map((char, index) => {
              const rarity = getCharacterRarity(char);
              const isOwned = userCollection.find(c => c.id === char.id);
              const isRevealed = revealedCards.includes(index);
              const isClaimed = claimedCharacterId === char.id;
              
              return (
                <div key={char.id} style={styles.cardContainer}>
                  {!isRevealed ? (
                    // Card Back
                    <div style={styles.cardBack}>
                      <div style={styles.cardBackContent}>
                        <div style={styles.cardBackLogo}>🎴</div>
                        <div style={styles.cardBackText}>Sus Rolls</div>
                        <div style={styles.cardBackSubtext}>Character Card</div>
                      </div>
                    </div>
                  ) : (
                    // Card Front
                    <div 
                      style={{
                        ...styles.card,
                        borderColor: getRarityColor(rarity),
                        borderWidth: '3px',
                        animation: 'cardReveal 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
                      }}
                    >
                      <div style={{...styles.rarityBadge, backgroundColor: getRarityColor(rarity)}}>
                        {rarity.toUpperCase()}
                      </div>
                      {isOwned && <div style={styles.ownedBadge}>OWNED LV.{isOwned.level}</div>}
                      <img 
                        src={char.image.large} 
                        alt={char.name.full} 
                        style={styles.cardImage}
                        onClick={(e) => {
                          // Create and show full-size image modal
                          const modal = document.createElement('div');
                          modal.style.cssText = `
                            position: fixed;
                            top: 0;
                            left: 0;
                            width: 100%;
                            height: 100%;
                            background: rgba(0, 0, 0, 0.9);
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            z-index: 10000;
                            cursor: pointer;
                          `;
                          
                          const img = document.createElement('img');
                          img.src = char.image.large;
                          img.style.cssText = `
                            max-width: 90%;
                            max-height: 90%;
                            object-fit: contain;
                            border-radius: 10px;
                            box-shadow: 0 0 50px rgba(255, 255, 255, 0.3);
                          `;
                          
                          modal.appendChild(img);
                          document.body.appendChild(modal);
                          
                          modal.onclick = () => document.body.removeChild(modal);
                        }}
                      />
                      <div style={styles.cardContent}>
                        <div>
                          <h3 style={styles.cardTitle}>
                            <a href={char.siteUrl} target="_blank" rel="noopener noreferrer" style={styles.characterLink}>
                              {char.name.full}
                            </a>
                          </h3>
                          <p style={styles.cardInfo}>
                            <strong>Series:</strong> {char.media.nodes[0]?.title?.romaji || "Unknown"}
                          </p>
                          <p style={styles.cardInfo}>
                            <strong>Age:</strong> {char.age || "?"}
                          </p>
                          <p style={styles.cardInfo}>
                            <strong>Favorites:</strong> {char.favourites || 0}
                          </p>
                        </div>
                        <div style={styles.cardBottom}>
                          <button 
                            onClick={() => handleClaimCharacter(char)}
                            disabled={claimedCharacterId !== null}
                            style={{
                              ...styles.claimButton,
                              ...(isClaimed ? styles.claimButtonClaimed : {}),
                              ...(claimedCharacterId !== null && !isClaimed ? styles.claimButtonDisabled : {})
                            }}
                          >
                            {isClaimed ? "Claimed!" : (claimedCharacterId !== null ? "Available" : "Claim")}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {view === "collection" && (
        <div>
          <div style={styles.collectionHeader}>
            <h2 style={styles.collectionTitle}>
              {viewingUser ? `${viewingUser}'s Collection` : 'My Collection'} ({getDisplayCollection().length})
            </h2>
            
            <div style={styles.sortContainer}>
              <label style={styles.sortLabel}>Sort by: </label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                style={styles.sortSelect}
              >
                <option value="level">Level (High to Low)</option>
                <option value="favorites">Favorites (High to Low)</option>
                <option value="name">Name (A-Z)</option>
                <option value="series">Series (A-Z)</option>
                <option value="age">Age (High to Low)</option>
              </select>
            </div>
          </div>
          
          <div style={styles.cardGrid}>
            {getSortedCollection().map((char) => {
              const rarity = getCharacterRarity(char);
              
              return (
                <div 
                  key={char.id} 
                  style={{
                    ...styles.card,
                    borderColor: getRarityColor(rarity),
                    borderWidth: '3px'
                  }}
                >
                  <div style={{...styles.rarityBadge, backgroundColor: getRarityColor(rarity)}}>
                    {rarity.toUpperCase()}
                  </div>
                  <div style={styles.levelBadge}>LV.{char.level || 1}</div>
                  <img 
                    src={char.image.large} 
                    alt={char.name.full} 
                    style={styles.cardImage}
                    onClick={(e) => {
                      // Create and show full-size image modal
                      const modal = document.createElement('div');
                      modal.style.cssText = `
                        position: fixed;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        background: rgba(0, 0, 0, 0.9);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 10000;
                        cursor: pointer;
                      `;
                      
                      const img = document.createElement('img');
                      img.src = char.image.large;
                      img.style.cssText = `
                        max-width: 90%;
                        max-height: 90%;
                        object-fit: contain;
                        border-radius: 10px;
                        box-shadow: 0 0 50px rgba(255, 255, 255, 0.3);
                      `;
                      
                      modal.appendChild(img);
                      document.body.appendChild(modal);
                      
                      modal.onclick = () => document.body.removeChild(modal);
                    }}
                  />
                  <h3 style={styles.cardTitle}>
                    <a href={char.siteUrl} target="_blank" rel="noreferrer" style={styles.characterLink}>
                      {char.name.full}
                    </a>
                  </h3>
                  {char.age && <p style={styles.cardInfo}>Age: {char.age}</p>}
                  {char.media?.nodes[0]?.title?.romaji && (
                    <p style={styles.cardInfo}>From: {char.media.nodes[0].title.romaji}</p>
                  )}
                  <p style={styles.cardInfo}>Favorites: {char.favourites || 0}</p>
                  {!viewingUser && (
                    <button 
                      onClick={() => handleRemoveCharacter(char.id)}
                      style={styles.removeButton}
                    >
                      Remove
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {getDisplayCollection().length === 0 && (
            <p style={styles.emptyCollection}>
              {viewingUser ? `${viewingUser} has no characters yet.` : "No characters in your collection yet. Start rolling!"}
            </p>
          )}
        </div>
      )}
    </div>
  );
};

const styles = {
  app: {
    textAlign: "center",
    padding: "2rem",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#1a1a2e",
    color: "#fff",
    minHeight: "100vh"
  },
  header: {
    marginBottom: "2rem",
    position: "relative"
  },
  menuContainer: {
    position: "absolute",
    top: "10px",
    right: "10px"
  },
  hamburgerButton: {
    background: "rgba(255, 255, 255, 0.1)",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    color: "#fff",
    fontSize: "1.5rem",
    padding: "8px 12px",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease"
  },
  dropdown: {
    position: "absolute",
    top: "100%",
    right: "0",
    marginTop: "5px",
    backgroundColor: "#16213e",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "8px",
    minWidth: "150px",
    boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
    zIndex: 1000
  },
  dropdownItem: {
    width: "100%",
    background: "none",
    border: "none",
    color: "#fff",
    padding: "12px 16px",
    textAlign: "left",
    cursor: "pointer",
    fontSize: "0.9rem",
    transition: "background-color 0.2s ease"
  },
  title: {
    fontSize: "3rem",
    margin: "0 0 1rem 0",
    background: "linear-gradient(45deg, #ff6b6b, #4ecdc4, #45b7d1)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text"
  },
  stats: {
    display: "flex",
    justifyContent: "center",
    gap: "2rem",
    fontSize: "1.1rem",
    color: "#ccc"
  },
  navigation: {
    display: "flex",
    justifyContent: "center",
    gap: "1rem",
    marginBottom: "2rem",
    flexWrap: "wrap"
  },
  button: {
    padding: "12px 24px",
    fontSize: "1.1rem",
    border: "none",
    borderRadius: "25px",
    cursor: "pointer",
    fontWeight: "bold",
    transition: "all 0.3s ease"
  },
  rollButton: {
    background: "linear-gradient(45deg, #6c47ff, #9d4edd)",
    color: "white"
  },
  viewButton: {
    background: "linear-gradient(45deg, #4ecdc4, #45b7d1)",
    color: "white"
  },
  loading: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "3rem"
  },
  packContainer: {
    perspective: "1000px",
    marginBottom: "2rem"
  },
  magicalOrb: {
    position: "relative",
    width: "120px",
    height: "120px",
    margin: "0 auto"
  },
  orbCore: {
    position: "absolute",
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    background: "radial-gradient(circle, #4ecdc4, #6c47ff)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "3rem",
    animation: "orbFloat 2s ease-in-out infinite",
    boxShadow: "0 0 40px rgba(78, 205, 196, 0.8)"
  },
  orbGlow: {
    position: "absolute",
    width: "160px",
    height: "160px",
    top: "-20px",
    left: "-20px",
    background: "radial-gradient(circle, rgba(78, 205, 196, 0.4) 0%, transparent 70%)",
    borderRadius: "50%",
    animation: "orbPulse 1.5s ease-in-out infinite"
  },
  loadingText: {
    fontSize: "1.5rem",
    color: "#4ecdc4",
    textShadow: "0 0 20px rgba(78, 205, 196, 0.8)",
    animation: "textGlow 1.5s ease-in-out infinite alternate",
    marginBottom: "0.5rem"
  },
  loadingSubtext: {
    fontSize: "1rem",
    color: "#ccc",
    opacity: 0.8
  },
  cardBack: {
    width: "250px",
    minHeight: "400px", // Same minimum height
    border: "3px solid #4ecdc4",
    borderRadius: "15px",
    backgroundColor: "#16213e",
    boxShadow: "0 8px 16px rgba(0, 0, 0, 0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
    position: "relative",
    overflow: "hidden"
  },
  cardBackContent: {
    textAlign: "center",
    zIndex: 2
  },
  cardBackLogo: {
    fontSize: "4rem",
    marginBottom: "1rem",
    opacity: 0.8,
    filter: "drop-shadow(0 0 10px rgba(78, 205, 196, 0.5))"
  },
  cardBackText: {
    fontSize: "1.5rem",
    fontWeight: "bold",
    color: "#4ecdc4",
    textShadow: "0 0 10px rgba(78, 205, 196, 0.5)",
    marginBottom: "0.5rem"
  },
  cardBackSubtext: {
    fontSize: "1rem",
    color: "#ccc",
    opacity: 0.8
  },
  cardGrid: {
    display: "flex",
    gap: "20px",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: "20px"
  },
  card: {
    width: "250px",
    minHeight: "400px", // Minimum height but can expand
    border: "2px solid #ddd",
    borderRadius: "15px",
    padding: "15px",
    textAlign: "center",
    backgroundColor: "#16213e",
    boxShadow: "0 8px 16px rgba(0, 0, 0, 0.3)",
    transition: "all 0.3s ease-out",
    position: "relative",
    display: "flex",
    flexDirection: "column"
  },
  rarityBadge: {
    position: "absolute",
    top: "10px",
    right: "10px",
    padding: "4px 8px",
    borderRadius: "12px",
    fontSize: "0.7rem",
    fontWeight: "bold",
    color: "white"
  },
  ownedBadge: {
    position: "absolute",
    top: "10px",
    left: "10px",
    padding: "4px 8px",
    borderRadius: "12px",
    fontSize: "0.7rem",
    fontWeight: "bold",
    backgroundColor: "#28a745",
    color: "white"
  },
  levelBadge: {
    position: "absolute",
    top: "10px",
    left: "10px",
    padding: "6px 10px",
    borderRadius: "15px",
    fontSize: "0.8rem",
    fontWeight: "bold",
    backgroundColor: "#ffd700",
    color: "#000"
  },
  cardImage: {
    width: "100%",
    height: "auto", // Allow natural height
    maxHeight: "300px", // Maximum height to prevent overly tall images
    objectFit: "contain", // Show full image without cropping
    borderRadius: "10px",
    flexShrink: 0, // Prevent shrinking
    cursor: "pointer" // Indicate it's clickable
  },
  cardContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    paddingTop: "10px"
  },
  cardTitle: {
    margin: "8px 0",
    fontSize: "1.1rem",
    color: "#fff",
    fontWeight: "bold"
  },
  characterLink: {
    color: "#4ecdc4",
    textDecoration: "none",
    transition: "color 0.3s ease"
  },
  cardInfo: {
    margin: "4px 0",
    fontSize: "0.85rem",
    color: "#ccc",
    lineHeight: "1.3",
    flexShrink: 0
  },
  cardBottom: {
    marginTop: "auto", // Push button to bottom
    paddingTop: "15px"
  },
  link: {
    color: "#4ecdc4",
    textDecoration: "none",
    fontSize: "0.85rem",
    display: "block",
    margin: "8px 0"
  },
  claimButton: {
    background: "linear-gradient(45deg, #28a745, #20c997)",
    color: "white",
    border: "none",
    padding: "10px 20px",
    borderRadius: "20px",
    cursor: "pointer",
    fontSize: "0.9rem",
    fontWeight: "bold",
    marginTop: "auto",
    transition: "all 0.3s ease"
  },
  claimButtonClaimed: {
    background: "linear-gradient(45deg, #ffd700, #ffed4e)",
    color: "#000",
    fontWeight: "bold",
    transform: "scale(1.05)",
    boxShadow: "0 0 20px rgba(255, 215, 0, 0.6)"
  },
  claimButtonDisabled: {
    background: "#6c757d",
    cursor: "not-allowed",
    opacity: 0.6
  },
  removeButton: {
    background: "#dc3545",
    color: "white",
    border: "none",
    padding: "6px 12px",
    borderRadius: "15px",
    cursor: "pointer",
    fontSize: "0.8rem",
    marginTop: "10px"
  },
  collectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "2rem",
    flexWrap: "wrap",
    gap: "1rem"
  },
  collectionTitle: {
    margin: "0",
    fontSize: "2rem",
    color: "#4ecdc4"
  },
  sortContainer: {
    display: "flex",
    alignItems: "center",
    gap: "10px"
  },
  sortLabel: {
    fontSize: "1rem",
    color: "#ccc"
  },
  sortSelect: {
    background: "#16213e",
    color: "#fff",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "0.9rem",
    cursor: "pointer"
  },
  emptyCollection: {
    fontSize: "1.2rem",
    color: "#666",
    marginTop: "3rem"
  },
  // Login and Account Styles
  loginOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10000
  },
  loginModal: {
    backgroundColor: "#16213e",
    border: "3px solid #4ecdc4",
    borderRadius: "20px",
    padding: "2rem",
    textAlign: "center",
    maxWidth: "400px",
    width: "90%",
    boxShadow: "0 0 40px rgba(78, 205, 196, 0.3)"
  },
  loginTitle: {
    fontSize: "2rem",
    margin: "0 0 1rem 0",
    color: "#4ecdc4",
    textShadow: "0 0 10px rgba(78, 205, 196, 0.5)"
  },
  loginSubtext: {
    fontSize: "1rem",
    color: "#ccc",
    marginBottom: "2rem"
  },
  loginForm: {
    display: "flex",
    flexDirection: "column",
    gap: "1rem",
    marginBottom: "2rem"
  },
  loginInput: {
    padding: "12px 16px",
    fontSize: "1rem",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    borderRadius: "10px",
    backgroundColor: "#1a1a2e",
    color: "#fff",
    outline: "none"
  },
  loginButton: {
    background: "linear-gradient(45deg, #4ecdc4, #45b7d1)",
    color: "white",
    border: "none",
    padding: "12px 24px",
    borderRadius: "20px",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.3s ease"
  },
  existingUsers: {
    borderTop: "1px solid rgba(255, 255, 255, 0.2)",
    paddingTop: "1.5rem"
  },
  existingUsersTitle: {
    fontSize: "0.9rem",
    color: "#ccc",
    marginBottom: "1rem"
  },
  usersList: {
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem"
  },
  existingUserButton: {
    background: "rgba(255, 255, 255, 0.1)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    color: "#fff",
    padding: "8px 16px",
    borderRadius: "10px",
    cursor: "pointer",
    fontSize: "0.9rem",
    transition: "all 0.3s ease"
  },
  userInfo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "1rem",
    marginBottom: "1rem",
    flexWrap: "wrap"
  },
  currentUser: {
    fontSize: "1.2rem",
    color: "#4ecdc4",
    fontWeight: "bold",
    textShadow: "0 0 10px rgba(78, 205, 196, 0.5)"
  },
  backButton: {
    background: "linear-gradient(45deg, #ff6b6b, #ee5a6f)",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "15px",
    fontSize: "0.9rem",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.3s ease"
  },
  dropdownDivider: {
    height: "1px",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    margin: "8px 0"
  },
  dropdownSection: {
    padding: "8px 0"
  },
  dropdownSectionTitle: {
    fontSize: "0.8rem",
    color: "#4ecdc4",
    fontWeight: "bold",
    padding: "0 16px 8px 16px",
    display: "block"
  },
  // Friend System Styles
  friendCodeDisplay: {
    backgroundColor: "rgba(78, 205, 196, 0.1)",
    border: "1px solid rgba(78, 205, 196, 0.3)",
    borderRadius: "10px",
    padding: "1rem",
    marginBottom: "1.5rem"
  },
  friendCodeLabel: {
    fontSize: "0.9rem",
    color: "#4ecdc4",
    marginBottom: "0.5rem",
    fontWeight: "bold"
  },
  friendCodeBox: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.5rem"
  },
  friendCode: {
    fontSize: "1.5rem",
    fontWeight: "bold",
    color: "#fff",
    letterSpacing: "2px",
    fontFamily: "monospace"
  },
  copyButton: {
    background: "rgba(255, 255, 255, 0.2)",
    border: "1px solid rgba(255, 255, 255, 0.3)",
    color: "#fff",
    padding: "4px 8px",
    borderRadius: "6px",
    fontSize: "0.8rem",
    cursor: "pointer",
    transition: "all 0.3s ease"
  },
  friendCodeHelp: {
    fontSize: "0.8rem",
    color: "#ccc",
    margin: "0",
    fontStyle: "italic"
  },
  modalButtons: {
    display: "flex",
    gap: "1rem"
  },
  cancelButton: {
    background: "rgba(255, 255, 255, 0.1)",
    border: "2px solid rgba(255, 255, 255, 0.3)",
    color: "#fff",
    padding: "12px 24px",
    borderRadius: "20px",
    fontSize: "1rem",
    fontWeight: "bold",
    cursor: "pointer",
    transition: "all 0.3s ease"
  },
  noFriendsText: {
    fontSize: "0.8rem",
    color: "#666",
    padding: "0 16px",
    fontStyle: "italic"
  }
};

// Add CSS animations
const animationKeyframes = `
  @keyframes orbFloat {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-10px) rotate(180deg); }
  }
  
  @keyframes orbPulse {
    0%, 100% { opacity: 0.4; transform: scale(1); }
    50% { opacity: 0.8; transform: scale(1.1); }
  }
  
  @keyframes textGlow {
    0% { text-shadow: 0 0 20px rgba(78, 205, 196, 0.8); }
    100% { text-shadow: 0 0 30px rgba(78, 205, 196, 1), 0 0 40px rgba(78, 205, 196, 0.5); }
  }
  
  @keyframes cardReveal {
    0% { 
      transform: rotateY(180deg) scale(0.3) translateY(-100px); 
      opacity: 0; 
    }
    50% { 
      transform: rotateY(90deg) scale(1.1) translateY(-20px); 
      opacity: 0.8; 
    }
    100% { 
      transform: rotateY(0deg) scale(1) translateY(0px); 
      opacity: 1; 
      box-shadow: 0 8px 30px rgba(255, 215, 0, 0.4), 0 0 50px rgba(255, 215, 0, 0.2); 
    }
  }
`;

// Inject the keyframes
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = animationKeyframes;
  document.head.appendChild(style);
}

export default SusRolls;