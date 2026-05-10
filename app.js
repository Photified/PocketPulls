/**
 * POCKET PULLS - PRO MASTER ENGINE v14
 * * DESIGN PHILOSOPHY:
 * 1. Zero Browser Bloat: No massive card data saved to disk.
 * 2. High Performance: Uses RAM-based Memory Caching.
 * 3. Complete Transparency: Every logic block is explicitly written out.
 */

// --- 1. MANUAL CHASE OVERRIDES ---
// Explicitly forces high-value cards to the top for specific sets.
const chaseOverrides = {
    "Ascended Heroes": ["284", "276", "290", "294", "281"], 
    "Perfect Order": ["124", "123", "122", "121", "120"],
    "Phantasmal Flames": ["251", "250", "249", "248", "247"]
};

// --- 2. TCGPLAYER URL OVERRIDES ---
// Hardcoded links for cards that have broken API data or search errors.
const urlOverrides = {
    "284": "https://www.tcgplayer.com/product/676096/pokemon-me-ascended-heroes-mega-gengar-ex-284-217", 
    "276": "https://www.tcgplayer.com/product/676088/pokemon-me-ascended-heroes-pikachu-ex-276-217",   
    "290": "https://www.tcgplayer.com/product/676102/pokemon-me-ascended-heroes-mega-dragonite-ex-290-217", 
    "294": "https://www.tcgplayer.com/product/676106/pokemon-me-ascended-heroes-mega-charizard-y-ex-294-217", 
    "281": "https://www.tcgplayer.com/product/676093/pokemon-me-ascended-heroes-team-rockets-mewtwo-ex-281-217"  
};

// --- 3. ERA & ODDS CONFIGURATION ---
// Community-sourced data for historical accuracy.
const eraConfig = {
    "Scarlet & Violet": {
        labels: ["Illustration Rare", "Ultra Rare", "Spec. Illustration Rare", "Hyper Rare"],
        odds: { ir: 13, ur: 15, sir: 86, gold: 150 }
    },
    "Sword & Shield": {
        labels: ["V / VMAX", "Full Art", "Alt Art / TG", "Secret Rare"],
        odds: { ir: 8, ur: 15, sir: 100, gold: 72 }
    },
    "Sun & Moon": {
        labels: ["GX Card", "Full Art", "Tag Team / Rainbow", "Secret Rare"],
        odds: { ir: 6, ur: 20, sir: 86, gold: 72 }
    },
    "XY Series": { 
        labels: ["EX Card", "Mega EX", "Full Art", "Secret Rare"],
        odds: { ir: 6, ur: 15, sir: 36, gold: 72 }
    }
};

const defaultEra = {
    labels: ["Holo Rare", "Ultra Rare", "Secret Rare", "Gold Card"],
    odds: { ir: 12, ur: 36, sir: 72, gold: 144 }
};

// --- 4. RARITY SCORING (TIE-BREAKER SORTING) ---
const rarityScore = {
    'Special Illustration Rare': 15, 'Mega Hyper Rare': 14, 'Hyper Rare': 13,
    'Mega Attack Rare': 12, 'Ultra Rare': 10, 'Illustration Rare': 9,
    'Rare Illustration': 9, 'Double Rare': 8, 'Rare Ultra': 7,
    'Rare Holo VMAX': 6, 'Rare Holo V': 5, 'Rare Holo': 4, 'Rare': 3
};

// --- 5. GLOBAL APP STATE ---
const API_KEY = "c7f8ecf9-8793-4fd6-a929-2282bf5fb09f"; 
const setsApiUrl = 'https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate';

// Memory Cache: Instant speed for the current session without bloating browser storage.
const cardCache = {}; 

// Stonks Database: Only stores tiny price numbers (Safe for LocalStorage).
const savedPrices = JSON.parse(localStorage.getItem('pocketPullsPrices')) || {};

// --- 6. CORE LOGIC: LOAD SET LIST ---
async function loadSets() {
    const setsContainer = document.getElementById('sets-container');
    
    try {
        const response = await fetch(setsApiUrl, {
            headers: { 'X-Api-Key': API_KEY }
        });
        const data = await response.json();
        const allSets = data.data;

        setsContainer.innerHTML = ''; 

        const seriesOrder = [];
        const seriesSets = {};

        // Group sets by their Series (SV, SwSh, etc)
        allSets.forEach(set => {
            if (!seriesOrder.includes(set.series)) {
                seriesOrder.push(set.series); 
                seriesSets[set.series] = [];
            }
            seriesSets[set.series].push(set);
        });

        // Build the Accordion UI
        seriesOrder.forEach((seriesName, index) => {
            let baseSet = seriesSets[seriesName][0];
            const isOpen = index < 2; // Auto-open the newest 2 Eras

            const btn = document.createElement('button');
            btn.className = `accordion-btn ${isOpen ? 'active' : ''}`;
            btn.innerHTML = `
                <div class="era-header-info">
                    <img class="era-symbol" src="${baseSet.images.symbol}"> 
                    <span>${seriesName}</span>
                </div>
                <span class="arrow">${isOpen ? '▲' : '▼'}</span>`;
            
            const content = document.createElement('div');
            content.className = `accordion-content ${isOpen ? 'show' : ''}`;
            
            const grid = document.createElement('div');
            grid.className = 'sets-grid';

            seriesSets[seriesName].forEach(set => {
                const setCard = document.createElement('div');
                setCard.className = 'set-card';
                setCard.onclick = () => openSetView(set);
                setCard.innerHTML = `<img class="set-logo" src="${set.images.logo}" loading="lazy">`;
                grid.appendChild(setCard);
            });

            content.appendChild(grid);
            setsContainer.appendChild(btn);
            setsContainer.appendChild(content);

            btn.onclick = function() {
                this.classList.toggle('active');
                content.classList.toggle('show');
                this.querySelector('.arrow').innerText = this.classList.contains('active') ? '▲' : '▼';
            };
        });

    } catch (error) {
        console.error("API Error (Sets):", error);
        setsContainer.innerHTML = `<p class="error">API Offline. Try again later.</p>`;
    }
}

// --- 7. CORE LOGIC: OPEN SET VIEW ---
async function openSetView(set) {
    // UI Transitions
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('set-view').classList.remove('hidden');
    document.getElementById('current-set-title').innerText = set.name;
    
    const symbolImg = document.getElementById('current-set-symbol');
    symbolImg.src = set.images.symbol;
    symbolImg.classList.remove('hidden');

    // 1. Dynamic Era Terminology
    const seriesKey = set.series.includes("XY") ? "XY Series" : set.series;
    const config = eraConfig[seriesKey] || defaultEra;
    
    const oddsBar = document.getElementById('odds-bar');
    oddsBar.innerHTML = `
        <div class="odds-pill pill-ir"><span class="odds-label">${config.labels[0]}</span><span class="odds-value">1 in ${config.odds.ir}</span></div>
        <div class="odds-pill pill-ur"><span class="odds-label">${config.labels[1]}</span><span class="odds-value">1 in ${config.odds.ur}</span></div>
        <div class="odds-pill pill-sir"><span class="odds-label">${config.labels[2]}</span><span class="odds-value">1 in ${config.odds.sir}</span></div>
        <div class="odds-pill pill-gold"><span class="odds-label">${config.labels[3]}</span><span class="odds-value">1 in ${config.odds.gold}</span></div>
    `;

    const chaseContainer = document.getElementById('chase-container');

    // 2. Memory Cache Layer (Instant revisit speed)
    if (cardCache[set.id]) {
        console.log("Loading from Session Cache...");
        renderChases(cardCache[set.id], set);
        return;
    }

    // 3. API Download Layer
    chaseContainer.innerHTML = `
        <div class="loader-container">
            <div class="pokeball-spinner"></div>
            <div class="loader-text">Fetching Cards...</div>
        </div>`;

    try {
        const fetchRecursive = async (id, page = 1, aggregate = []) => {
            const res = await fetch(`https://api.pokemontcg.io/v2/cards?q=set.id:${id}&page=${page}&pageSize=250`, {
                headers: { 'X-Api-Key': API_KEY }
            });
            const json = await res.json();
            aggregate.push(...json.data);
            
            if (json.data.length === 250) {
                return fetchRecursive(id, page + 1, aggregate);
            }
            return aggregate;
        };

        const allCards = await fetchRecursive(set.id);
        cardCache[set.id] = allCards; // Save to RAM for this session
        renderChases(allCards, set);

    } catch (error) {
        console.error("API Error (Cards):", error);
        chaseContainer.innerHTML = `<p class="error">Data download failed.</p>`;
    }
}

// --- 8. CORE LOGIC: SORT & RENDER CHASES ---
function renderChases(cards, set) {
    const chaseContainer = document.getElementById('chase-container');
    chaseContainer.innerHTML = ''; 

    // 1. COMPLEX SORTING ENGINE
    const sortedCards = cards.sort((cardA, cardB) => {
        const baseNumA = cardA.number.toString().split('/')[0];
        const baseNumB = cardB.number.toString().split('/')[0];

        // Priority A: Check Manual Override Dictionary
        const manualList = chaseOverrides[set.name] || [];
        const indexA = manualList.indexOf(baseNumA);
        const indexB = manualList.indexOf(baseNumB);

        if (indexA !== -1 || indexB !== -1) {
            if (indexA !== -1 && indexB !== -1) return indexA - indexB;
            return indexA !== -1 ? -1 : 1;
        }

        // Priority B: Sort by Market Price
        const priceA = calculateHighestPrice(cardA);
        const priceB = calculateHighestPrice(cardB);
        if (priceA > 0 || priceB > 0) return priceB - priceA;

        // Priority C: Sort by Rarity Tier
        const tierA = rarityScore[cardA.rarity] || 0;
        const tierB = rarityScore[cardB.rarity] || 0;
        return tierB - tierA;
    });

    // 2. DISPLAY THE TOP 10
    const top10 = sortedCards.slice(0, 10);

    top10.forEach(card => {
        const price = calculateHighestPrice(card);
        const priceLabel = price > 0 ? `$${price.toFixed(2)}` : 'Pending';
        const baseNum = card.number.toString().split('/')[0];

        // 3. TCGPlayer Link Failsafe
        let tcgUrl = '';
        if (price === 0 && urlOverrides[baseNum]) {
            tcgUrl = urlOverrides[baseNum];
        } else if (card.tcgplayer && card.tcgplayer.url) {
            tcgUrl = card.tcgplayer.url;
        } else {
            tcgUrl = `https://www.tcgplayer.com/search/pokemon/product?q=${encodeURIComponent(card.name + ' ' + baseNum)}`;
        }
        tcgUrl = tcgUrl.replace(/'/g, "%27");

        // 4. THE STONK ENGINE
        let trendHtml = '';
        const historicPrice = savedPrices[card.id];

        if (price > 0) {
            if (historicPrice > 0) {
                const diff = price - historicPrice;
                if (diff > 0) {
                    trendHtml = `<div class="trend-pill trend-up">+$${diff.toFixed(2)} 📈</div>`;
                } else if (diff < 0) {
                    trendHtml = `<div class="trend-pill trend-down">-$${Math.abs(diff).toFixed(2)} 📉</div>`;
                } else {
                    trendHtml = `<div class="trend-pill trend-flat">Holding ➖</div>`;
                }
            } else {
                trendHtml = `<div class="trend-pill trend-flat">Baseline 📊</div>`;
            }
            // Update the persistent "Stonk" database
            savedPrices[card.id] = price;
        }

        // 5. Build the HTML Node
        const cardDiv = document.createElement('div');
        cardDiv.className = 'card-item';
        cardDiv.innerHTML = `
            <img class="chase-thumbnail" src="${card.images.small}" onclick="openLightbox('${card.images.large}')">
            <div class="price-tag" onclick="window.open('${tcgUrl}', '_blank')">${priceLabel}</div>
            ${trendHtml}
        `;
        chaseContainer.appendChild(cardDiv);
    });

    // Save Stonks to Disk (LocalStorage)
    localStorage.setItem('pocketPullsPrices', JSON.stringify(savedPrices));
}

// --- 9. HELPER: CALCULATE PRICE ---
function calculateHighestPrice(card) {
    if (!card.tcgplayer || !card.tcgplayer.prices) return 0;
    let highest = 0;
    const priceObjects = card.tcgplayer.prices;
    
    for (const key in priceObjects) {
        const p = priceObjects[key];
        const val = p.market || p.mid || p.directLow || p.low || 0;
        if (val > highest) highest = val;
    }
    return highest;
}

// --- 10. UI HANDLERS ---
document.getElementById('back-button').onclick = () => {
    document.getElementById('set-view').classList.add('hidden');
    document.getElementById('home-view').classList.remove('hidden');
};

function openLightbox(url) {
    document.getElementById('lightbox-image').src = url;
    document.getElementById('lightbox').style.display = 'flex';
}

function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
}

// Settings Modal
document.getElementById('settings-btn').onclick = () => {
    document.getElementById('settings-modal').style.display = 'flex';
};

document.getElementById('close-settings').onclick = () => {
    document.getElementById('settings-modal').style.display = 'none';
};

// PWA Service Worker Hook
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
    });
}

// Boot the App
loadSets();