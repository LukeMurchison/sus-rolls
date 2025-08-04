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

  // Persistent storage that works in this environment
  const storageRef = useRef({
    collection: [],
    rollCount: 0
  });

  // Persistent storage using localStorage (works in most environments)
  useEffect(() => {
    try {
      const savedCollection = localStorage.getItem("susrolls_collection");
      const savedRollCount = localStorage.getItem("susrolls_rollcount");
      
      if (savedCollection) {
        const parsed = JSON.parse(savedCollection);
        setUserCollection(parsed);
        storageRef.current.collection = parsed;
      }
      if (savedRollCount) {
        const count = parseInt(savedRollCount);
        setRollCount(count);
        storageRef.current.rollCount = count;
      }
    } catch (error) {
      console.log('localStorage not available, using session storage');
      // Fallback to our ref storage
      setUserCollection(storageRef.current.collection);
      setRollCount(storageRef.current.rollCount);
    }
  }, []);

  const saveCollection = (collection) => {
    try {
      localStorage.setItem("susrolls_collection", JSON.stringify(collection));
    } catch (error) {
      console.log('localStorage not available');
    }
    storageRef.current.collection = collection;
  };

  const saveRollCount = (count) => {
    try {
      localStorage.setItem("susrolls_rollcount", count.toString());
    } catch (error) {
      console.log('localStorage not available');
    }
    storageRef.current.rollCount = count;
    setRollCount(count);
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
    return audioContextRef.current;
  };

  const playSound = (type) => {
    const audioContext = getAudioContext();
    if (!audioContext) return;
    
    const createTone = (frequency, duration, type = 'sine', volume = 0.15) => {
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
    const sorted = [...userCollection];
    
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
      case "level":
      default:
        return sorted.sort((a, b) => (b.level || 1) - (a.level || 1));
    }
  };

  const getCharactersForPulls = async () => {
    setIsRolling(true);
    setRolledCharacters([]);
    setRevealedCards([]);
    setShowingCards(false);
    
    playSound('roll_start');
    
    const query = `
      query ($page: Int, $perPage: Int) {
        Page(page: $page, perPage: $perPage) {
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
            media(perPage: 5, sort: [POPULARITY_DESC]) {
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
      await new Promise(resolve => setTimeout(resolve, 1500));

      const results = [];
      const usedIds = new Set();

      // Get characters from multiple random pages for true randomness
      for (let i = 0; i < 5; i++) {
        let attempts = 0;
        let foundCharacter = false;
        
        while (!foundCharacter && attempts < 10) {
          const page = Math.floor(Math.random() * 200) + 1; // Much wider range
          const variables = { page, perPage: 25 };

          try {
            const response = await fetch("https://graphql.anilist.co", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Accept": "application/json",
              },
              body: JSON.stringify({ query, variables }),
            });

            if (!response.ok) {
              attempts++;
              continue;
            }

            const data = await response.json();
            
            if (data.errors || !data.data?.Page?.characters) {
              attempts++;
              continue;
            }

            const characters = data.data.Page.characters;

            const valid = characters.filter((char) => {
              if (!char || usedIds.has(char.id)) return false;
              if (!char.name?.full) return false;
              if (!char.image?.large) return false;
              if (char.age && parseInt(char.age) < 18) return false;
              return true;
            });

            if (valid.length > 0) {
              const randomChar = valid[Math.floor(Math.random() * valid.length)];
              results.push(randomChar);
              usedIds.add(randomChar.id);
              foundCharacter = true;
            }
            
            attempts++;
          } catch (error) {
            console.error(`Error fetching page ${page}:`, error);
            attempts++;
          }
        }
      }
      
      setRolledCharacters(results);
      setIsRolling(false);
      setClaimedCharacterId(null);
      saveRollCount(rollCount + 1);
      
      // Start card reveal sequence
      setTimeout(() => {
        playSound('whoosh');
        setShowingCards(true);
        
        // Reveal cards one by one
        results.forEach((char, index) => {
          setTimeout(() => {
            const rarity = getCharacterRarity(char);
            playSound(rarity === 'legendary' ? 'rare_reveal' : 'card_reveal');
            setRevealedCards(prev => [...prev, index]);
          }, 500 + (index * 300));
        });
      }, 500);

    } catch (error) {
      console.error("Error in getCharactersForPulls:", error);
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
      storageRef.current = { collection: [], rollCount: 0 };
      try {
        localStorage.removeItem("susrolls_collection");
        localStorage.removeItem("susrolls_rollcount");
      } catch (error) {
        console.log('localStorage not available');
      }
      setShowMenu(false);
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
      <div style={styles.header}>
        <h1 style={styles.title}>✨ Sus Rolls ✨</h1>
        <div style={styles.stats}>
          <span>Total Rolls: {rollCount}</span>
          <span>Collection: {userCollection.length}</span>
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
              <button onClick={clearAllData} style={styles.dropdownItem}>
                🗑️ Clear All Data
              </button>
            </div>
          )}
        </div>
      </div>

      <div style={styles.navigation}>
        {view === "roll" && (
          <button 
            onClick={getCharactersForPulls} 
            disabled={isRolling}
            style={{...styles.button, ...styles.rollButton}}
          >
            {isRolling ? "Rolling..." : "🎲 Roll 5 Characters"}
          </button>
        )}
        
        {userCollection.length > 0 && (
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
          <p style={styles.loadingText}>Summoning characters...</p>
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
                      <img src={char.image.large} alt={char.name.full} style={styles.cardImage} />
                      <div style={styles.cardContent}>
                        <div>
                          <h3 style={styles.cardTitle}>{char.name.full}</h3>
                          <p style={styles.cardInfo}>
                            <strong>Series:</strong> {char.media.nodes[0]?.title?.romaji || "Unknown"}
                          </p>
                          <p style={styles.cardInfo}>
                            <strong>Age:</strong> {char.age || "?"}
                          </p>
                          <p style={styles.cardInfo}>
                            <strong>Favorites:</strong> {char.favourites || 0}
                          </p>
                          <a href={char.siteUrl} target="_blank" rel="noopener noreferrer" style={styles.link}>
                            View on AniList
                          </a>
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
            <h2 style={styles.collectionTitle}>My Collection ({userCollection.length})</h2>
            
            <div style={styles.sortContainer}>
              <label style={styles.sortLabel}>Sort by: </label>
              <select 
                value={sortBy} 
                onChange={(e) => setSortBy(e.target.value)}
                style={styles.sortSelect}
              >
                <option value="level">Level (High to Low)</option>
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
                  <img src={char.image.large} alt={char.name.full} style={styles.cardImage} />
                  <h3 style={styles.cardTitle}>{char.name.full}</h3>
                  {char.age && <p style={styles.cardInfo}>Age: {char.age}</p>}
                  {char.media?.nodes[0]?.title?.romaji && (
                    <p style={styles.cardInfo}>From: {char.media.nodes[0].title.romaji}</p>
                  )}
                  <a href={char.siteUrl} target="_blank" rel="noreferrer" style={styles.link}>
                    View on AniList
                  </a>
                  <button 
                    onClick={() => handleRemoveCharacter(char.id)}
                    style={styles.removeButton}
                  >
                    Remove
                  </button>
                </div>
              );
            })}
          </div>
          {userCollection.length === 0 && (
            <p style={styles.emptyCollection}>No characters in your collection yet. Start rolling!</p>
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
    animation: "textGlow 1.5s ease-in-out infinite alternate"
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
    height: "200px", // Fixed height for consistency
    objectFit: "cover", // Changed to cover for better consistency
    borderRadius: "10px",
    flexShrink: 0 // Prevent shrinking
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
  cardContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    paddingTop: "10px"
  },
  cardInfo: {
    margin: "4px 0",
    fontSize: "0.85rem",
    color: "#ccc",
    lineHeight: "1.3"
  },
  cardBottom: {
    marginTop: "auto", // Push button to bottom
    paddingTop: "15px"
  },
  cardInfo: {
    margin: "4px 0",
    fontSize: "0.85rem",
    color: "#ccc",
    lineHeight: "1.3",
    flexShrink: 0
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