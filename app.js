/**
 * POCKET PULLS - MASTER ENGINE v12
 * Features: Era-Labeling, Community Odds, Memory Cache, 
 * URL Overrides, Manual Sorting, & LocalStorage Stonks.
 */

// --- 1. MANUAL CHASE OVERRIDES ---
// Forces specific card numbers to the top 5 for new or unpriced sets.
const chaseOverrides = {
    "Ascended Heroes": ["284", "276", "290", "294", "281"], 
    "Perfect Order": ["124", "123", "122", "121", "120"],
    "Phantasmal Flames": ["251", "250", "249", "248", "247"]
};

// --- 2. TCGPLAYER URL OVERRIDES ---
// Fixes broken API links for brand new cards (Dragonite, Mewtwo, etc).
const urlOverrides = {
    "284": "https://www.tcgplayer.com/product/676096/pokemon-me-ascended-heroes-mega-gengar-ex-284-217", 
    "276": "https://www.tcgplayer.com/product/676088/pokemon-me-ascended-heroes-pikachu-ex-276-217",   
    "290": "https://www.tcgplayer.com/product/676102/pokemon-me-ascended-heroes-mega-dragonite-ex-290-217", 
    "294": "https://www.tcgplayer.com/product/676106/pokemon-me-ascended-heroes-mega-charizard-y-ex-294-217", 
    "281": "https://www.tcgplayer.com/product/676093/pokemon-me-ascended-heroes-team-rockets-mewtwo-ex-281-217"  
};

// --- 3. ERA-SPECIFIC CONFIGURATION ---
// Community-sourced odds for Sword & Shield, Sun & Moon, and XY.
const eraConfig = {
    "Scarlet & Violet": {
        labels: ["Illustration Rare", "Ultra Rare", "Spec. Illustration Rare", "Hyper Rare"],
        odds: { ir: 13, ur: 15, sir: 86, gold: 150 }
    },
    "Sword & Shield": {
        labels: ["V / VMAX", "Full Art", "Alt Art / TG", "Secret Rare"], //
        odds: { ir: 8, ur: 15, sir: 100, gold: 72 } //
    },
    "Sun & Moon": {
        labels: ["GX Card", "Full Art", "Tag Team / Rainbow", "Secret Rare"], //
        odds: { ir: 6, ur: 20, sir: 86, gold: 72 } //
    },
    "XY Series": { 
        labels: ["EX Card", "Mega EX", "Full Art", "Secret Rare"], //
        odds: { ir: 6, ur: 15, sir: 36, gold: 72 } //
    }
};

const defaultEra = {
    labels: ["Holo Rare", "Ultra Rare", "Secret Rare", "Gold Card"],
    odds: { ir: 12, ur: 36, sir: 72, gold: 144 }
};

// --- 4. RARITY RANKING (FOR AUTO-SORTING) ---
const rarityScore = {
    'Special Illustration Rare': 15, 'Mega Hyper Rare': 14, 'Hyper Rare': 13,
    'Mega Attack Rare': 12, 'Ultra Rare': 10, 'Illustration Rare': 9,
    'Rare Illustration': 9, 'Double Rare': 8, 'Rare Ultra': 7,
    'Rare Holo VMAX': 6, 'Rare Holo V': 5, 'Rare Holo': 4, 'Rare': 3
};

// --- 5. GLOBAL STATE & API CONFIG ---
const API_KEY = "c7f8ecf9-8793-4fd6-a929-2282bf5fb09f"; 
const savedPrices = JSON.parse(localStorage.getItem('pocketPullsPrices')) || {};
const cardCache = {}; // Memory cache for instant return-visits
const setsApiUrl = 'https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate';

// --- 6. INITIALIZATION: LOAD ALL SETS ---
async function loadSets() {
    try {
        const response = await fetch(setsApiUrl, {
            headers: { 'X-Api-Key': API_KEY }
        });
        const data = await response.json();
        const container = document.getElementById('sets-container');
        container.innerHTML = ''; 

        const seriesOrder = [];
        const seriesSets = {};

        data.data.forEach(set => {
            if (!seriesOrder.includes(set.series)) {
                seriesOrder.push(set.series); 
                seriesSets[set.series] = [];
            }
            seriesSets[set.series].push(set);
        });

        seriesOrder.forEach((seriesName, index) => {
            let baseSet = seriesSets[seriesName][0];
            const eraSymbolUrl = baseSet.images.symbol;
            const isOpen = index < 2;

            const btn = document.createElement('button');
            btn.className = `accordion-btn ${isOpen ? 'active' : ''}`;
            btn.innerHTML = `
                <div class="era-header-info">
                    <img class="era-symbol" src="${eraSymbolUrl}"> 
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
            container.appendChild(btn);
            container.appendChild(content);

            btn.onclick = function() {
                this.classList.toggle('active');
                content.classList.toggle('show');
                this.querySelector('.arrow').innerText = this.classList.contains('active') ? '▲' : '▼';
            };
        });
    } catch (error) { console.error("Load Sets Error:", error); }
}

// --- 7. API FETCH: GET CARDS FOR SET ---
async function fetchAllCards(setId, page = 1, allCards = []) {
    const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&page=${page}&pageSize=250`, {
        headers: { 'X-Api-Key': API_KEY }
    });
    const data = await response.json();
    allCards.push(...data.data);
    if (data.data.length === 250) {
        return fetchAllCards(setId, page + 1, allCards);
    }
    return allCards;
}

// --- 8. VIEW CONTROLLER: OPEN SET ---
async function openSetView(set) {
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('set-view').classList.remove('hidden');
    document.getElementById('current-set-title').innerText = set.name;
    
    const symbolImg = document.getElementById('current-set-symbol');
    symbolImg.src = set.images.symbol;
    symbolImg.classList.remove('hidden');

    // Update terminology labels based on Era
    renderOdds(set.series); 

    const chaseContainer = document.getElementById('chase-container');
    
    // Check Memory Cache first for 0s load time
    if (cardCache[set.id]) {
        chaseContainer.innerHTML = ''; 
        processAndSortCards(cardCache[set.id], set);
        return;
    }

    chaseContainer.innerHTML = `
        <div class="loader-container">
            <div class="pokeball-spinner"></div>
            <div class="loader-text">Loading All Cards...</div>
        </div>`;

    try {
        const cards = await fetchAllCards(set.id);
        cardCache[set.id] = cards; // Store in cache
        processAndSortCards(cards, set);
    } catch (error) { console.error("Fetch Cards Error:", error); }
}

// --- 9. ODDS ENGINE: ERA TERMINOLOGY ---
function renderOdds(seriesName) {
    const oddsBar = document.getElementById('odds-bar');
    const seriesKey = seriesName.includes("XY") ? "XY Series" : seriesName;
    const config = eraConfig[seriesKey] || defaultEra;
    
    oddsBar.innerHTML = `
        <div class="odds-pill pill-ir"><span class="odds-label">${config.labels[0]}</span><span class="odds-value">1 in ${config.odds.ir}</span></div>
        <div class="odds-pill pill-ur"><span class="odds-label">${config.labels[1]}</span><span class="odds-value">1 in ${config.odds.ur}</span></div>
        <div class="odds-pill pill-sir"><span class="odds-label">${config.labels[2]}</span><span class="odds-value">1 in ${config.odds.sir}</span></div>
        <div class="odds-pill pill-gold"><span class="odds-label">${config.labels[3]}</span><span class="odds-value">1 in ${config.odds.gold}</span></div>
    `;
}

// --- 10. SORTING ENGINE: FIND THE TOP 5 ---
function processAndSortCards(cards, set) {
    const sortedCards = cards.sort((a, b) => {
        // Fix for "290/217" format
        const baseNumA = a.number.toString().split('/')[0];
        const baseNumB = b.number.toString().split('/')[0];

        // Level 1: Check Manual Chase Overrides
        const manualList = chaseOverrides[set.name] || [];
        const manualPosA = manualList.indexOf(baseNumA);
        const manualPosB = manualList.indexOf(baseNumB);

        if (manualPosA !== -1 || manualPosB !== -1) {
            if (manualPosA !== -1 && manualPosB !== -1) return manualPosA - manualPosB;
            return manualPosA !== -1 ? -1 : 1;
        }

        // Level 2: Sort by Market Price
        const priceA = getHighestPrice(a);
        const priceB = getHighestPrice(b);
        if (priceA > 0 || priceB > 0) return priceB - priceA;

        // Level 3: Sort by Rarity Score
        const scoreA = rarityScore[a.rarity] || 0;
        const scoreB = rarityScore[b.rarity] || 0;
        return scoreB - scoreA;
    });

    renderChases(sortedCards.slice(0, 5));
}

// --- 11. PRICE ENGINE: FETCH HIGHEST MARKET VALUE ---
function getHighestPrice(card) {
    if (!card.tcgplayer || !card.tcgplayer.prices) return 0;
    let max = 0;
    for (const type in card.tcgplayer.prices) {
        const p = card.tcgplayer.prices[type];
        const val = p.market || p.mid || p.directLow || p.low || 0;
        if (val > max) max = val;
    }
    return max;
}

// --- 12. RENDER ENGINE: BUILD CARD UI & STONKS ---
function renderChases(cards) {
    const container = document.getElementById('chase-container');
    container.innerHTML = ''; 
    
    cards.forEach(card => {
        const price = getHighestPrice(card);
        const priceString = price > 0 ? `$${price.toFixed(2)}` : 'Market Pending';
        const baseNum = card.number.toString().split('/')[0];

        // Smart Link Fallback
        let tcgUrl = (price === 0 && urlOverrides[baseNum]) ? urlOverrides[baseNum] : 
                     (card.tcgplayer && card.tcgplayer.url) ? card.tcgplayer.url : 
                     `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&ProductTypeName=Cards&q=${encodeURIComponent(card.name + ' ' + baseNum)}`;

        tcgUrl = tcgUrl.replace(/'/g, "%27"); // Fix apostrophe bug

        // STONKS LOGIC (LocalStorage Based)
        let trendHtml = '';
        const pastPrice = savedPrices[card.id];

        if (price > 0) {
            if (pastPrice > 0) {
                const diff = price - pastPrice;
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
            savedPrices[card.id] = price; // Update DB
        }

        const cardItem = document.createElement('div');
        cardItem.className = 'card-item';
        cardItem.innerHTML = `
            <img class="chase-thumbnail" src="${card.images.small}" onclick="openLightbox('${card.images.large}')">
            <div class="price-tag" onclick="window.open('${tcgUrl}', '_blank')" title="View on TCGPlayer">${priceString}</div>
            ${trendHtml}
        `;
        container.appendChild(cardItem);
    });

    localStorage.setItem('pocketPullsPrices', JSON.stringify(savedPrices));
}

// --- 13. UI CONTROLS: LIGHTBOX & BACK BUTTON ---
document.getElementById('back-button').onclick = () => {
    document.getElementById('set-view').classList.add('hidden');
    document.getElementById('home-view').classList.remove('hidden');
    document.getElementById('current-set-symbol').classList.add('hidden');
};

function openLightbox(url) { 
    document.getElementById('lightbox-image').src = url; 
    document.getElementById('lightbox').style.display = 'flex'; 
}

function closeLightbox() { 
    document.getElementById('lightbox').style.display = 'none'; 
}

// --- 14. PWA & SETTINGS MODAL LOGIC ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.log('SW Failed', err));
    });
}

document.getElementById('settings-btn').onclick = () => document.getElementById('settings-modal').style.display = 'flex';
document.getElementById('close-settings').onclick = () => document.getElementById('settings-modal').style.display = 'none';

let deferredPrompt;
const installBtn = document.getElementById('install-btn');
const iosMsg = document.getElementById('ios-install-msg');

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    installBtn.classList.remove('hidden');
});

installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') installBtn.classList.add('hidden');
        deferredPrompt = null;
    }
});

const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
};
const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

if (isIos() && !isInStandaloneMode()) {
    iosMsg.classList.remove('hidden');
}

// Launch the app
loadSets();