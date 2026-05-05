// 1. Expert Override List using Set Names to avoid ID mismatch bugs
const chaseOverrides = {
    "Ascended Heroes": ["284", "276", "290", "294", "281"], 
    "Perfect Order": ["124", "123", "122", "121", "120"],
    "Phantasmal Flames": ["251", "250", "249", "248", "247"]
};

// 2. Master Odds Library
const setOdds = {
    "sv3pt5": { ir: 12, ur: 15, sir: 32, gold: 50 }, 
    "Scarlet & Violet": { ir: 13, ur: 15, sir: 86, gold: 150 },
    "Mega Evolution": { ir: 10, ur: 12, sir: 70, gold: 120 }
};

// 3. Rarity Ranking
const rarityScore = {
    'Special Illustration Rare': 15,
    'Mega Hyper Rare': 14,
    'Hyper Rare': 13,
    'Mega Attack Rare': 12,
    'Ultra Rare': 10,
    'Illustration Rare': 9,
    'Rare Illustration': 9,
    'Double Rare': 8,
    'Rare Ultra': 7,
    'Rare Holo VMAX': 6,
    'Rare Holo V': 5,
    'Rare Holo': 4,
    'Rare': 3
};

// 4. Load the Stonks Database from LocalStorage
const savedPrices = JSON.parse(localStorage.getItem('pocketPullsPrices')) || {};

const setsApiUrl = 'https://api.pokemontcg.io/v2/sets?orderBy=-releaseDate';

async function loadSets() {
    try {
        const response = await fetch(setsApiUrl);
        const data = await response.json();
        const sets = data.data;
        const container = document.getElementById('sets-container');
        container.innerHTML = ''; 

        const seriesOrder = [];
        const seriesSets = {};

        sets.forEach(set => {
            if (!seriesOrder.includes(set.series)) {
                seriesOrder.push(set.series); 
                seriesSets[set.series] = [];
            }
            seriesSets[set.series].push(set);
        });

        seriesOrder.forEach((seriesName, index) => {
            let baseSet = seriesSets[seriesName].find(set => set.name === seriesName);
            if (!baseSet) {
                const nonPromoSets = seriesSets[seriesName].filter(set => !set.name.toLowerCase().includes('promo'));
                baseSet = nonPromoSets.length > 0 ? nonPromoSets[nonPromoSets.length - 1] : seriesSets[seriesName][seriesSets[seriesName].length - 1];
            }

            const eraSymbolUrl = baseSet.images.symbol;
            const isOpen = index < 2;

            const btn = document.createElement('button');
            btn.className = `accordion-btn ${isOpen ? 'active' : ''}`;
            btn.innerHTML = `<div class="era-header-info"><img class="era-symbol" src="${eraSymbolUrl}"> <span>${seriesName}</span></div><span class="arrow">${isOpen ? '▲' : '▼'}</span>`;
            
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
    } catch (error) { console.error(error); }
}

async function fetchAllCards(setId, page = 1, allCards = []) {
    const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=set.id:${setId}&page=${page}&pageSize=250`);
    const data = await response.json();
    allCards.push(...data.data);
    if (data.data.length === 250) {
        return fetchAllCards(setId, page + 1, allCards);
    }
    return allCards;
}

async function openSetView(set) {
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('set-view').classList.remove('hidden');
    document.getElementById('current-set-title').innerText = set.name;
    const symbolImg = document.getElementById('current-set-symbol');
    symbolImg.src = set.images.symbol;
    symbolImg.classList.remove('hidden');

    renderOdds(set.id, set.series); 

    const chaseContainer = document.getElementById('chase-container');
    chaseContainer.innerHTML = `<div class="loader-container"><div class="pokeball-spinner"></div><div class="loader-text">Loading All Cards...</div></div>`;

    try {
        const cards = await fetchAllCards(set.id);

        const sortedCards = cards.sort((a, b) => {
            const manualList = chaseOverrides[set.name] || [];
            const manualPosA = manualList.indexOf(a.number);
            const manualPosB = manualList.indexOf(b.number);

            if (manualPosA !== -1 || manualPosB !== -1) {
                if (manualPosA !== -1 && manualPosB !== -1) return manualPosA - manualPosB;
                return manualPosA !== -1 ? -1 : 1;
            }

            const priceA = getHighestPrice(a);
            const priceB = getHighestPrice(b);
            if (priceA > 0 || priceB > 0) return priceB - priceA;

            const isSecretA = parseInt(a.number) > set.printedTotal;
            const isSecretB = parseInt(b.number) > set.printedTotal;
            if (isSecretA && !isSecretB) return -1;
            if (!isSecretA && isSecretB) return 1;

            const scoreA = rarityScore[a.rarity] || 0;
            const scoreB = rarityScore[b.rarity] || 0;
            return scoreB - scoreA;
        });

        renderChases(sortedCards.slice(0, 5));
    } catch (error) { console.error(error); }
}

function renderOdds(setId, seriesName) {
    const oddsBar = document.getElementById('odds-bar');
    const odds = setOdds[setId] || setOdds[seriesName] || { ir: '??', ur: '??', sir: '??', gold: '??' };
    
    oddsBar.innerHTML = `
        <div class="odds-pill pill-ir"><span class="odds-label">Illustration Rare</span><span class="odds-value">1 in ${odds.ir} packs</span></div>
        <div class="odds-pill pill-ur"><span class="odds-label">Ultra Rare</span><span class="odds-value">1 in ${odds.ur} packs</span></div>
        <div class="odds-pill pill-sir"><span class="odds-label">Spec. Illustration Rare</span><span class="odds-value">1 in ${odds.sir} packs</span></div>
        <div class="odds-pill pill-gold"><span class="odds-label">Hyper Rare</span><span class="odds-value">1 in ${odds.gold} packs</span></div>
    `;
}

document.getElementById('back-button').onclick = () => {
    document.getElementById('set-view').classList.add('hidden');
    document.getElementById('home-view').classList.remove('hidden');
    document.getElementById('current-set-symbol').classList.add('hidden');
};

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

function renderChases(cards) {
    const container = document.getElementById('chase-container');
    container.innerHTML = ''; 
    
    cards.forEach(card => {
        const price = getHighestPrice(card);
        const priceString = price > 0 ? `$${price.toFixed(2)}` : 'Market Pending';
        
        // SMART URL FALLBACK
        const tcgUrl = (card.tcgplayer && card.tcgplayer.url) 
            ? card.tcgplayer.url 
            : `https://www.tcgplayer.com/search/pokemon/product?productLineName=pokemon&q=${encodeURIComponent(card.name + ' ' + card.number)}`;

        // STONKS LOGIC
        let trendHtml = '';
        const pastPrice = savedPrices[card.id];

        if (price > 0 && pastPrice > 0) {
            const difference = price - pastPrice;
            if (difference > 0) {
                trendHtml = `<div class="trend-pill trend-up">+$${difference.toFixed(2)} 📈</div>`;
            } else if (difference < 0) {
                trendHtml = `<div class="trend-pill trend-down">-$${Math.abs(difference).toFixed(2)} 📉</div>`;
            }
        }

        if (price > 0) savedPrices[card.id] = price;

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

function openLightbox(url) { document.getElementById('lightbox-image').src = url; document.getElementById('lightbox').style.display = 'flex'; }
function closeLightbox() { document.getElementById('lightbox').style.display = 'none'; }


// ==========================================
// PWA, SERVICE WORKER, AND MODAL LOGIC
// ==========================================

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker Registered'))
            .catch(err => console.log('SW Registration Failed:', err));
    });
}

// Gear Modal Toggles
document.getElementById('settings-btn').onclick = () => document.getElementById('settings-modal').style.display = 'flex';
document.getElementById('close-settings').onclick = () => document.getElementById('settings-modal').style.display = 'none';

// Smart PWA Install Prompt
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

// Detect iOS
const isIos = () => {
    const userAgent = window.navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(userAgent);
};
const isInStandaloneMode = () => ('standalone' in window.navigator) && (window.navigator.standalone);

if (isIos() && !isInStandaloneMode()) {
    iosMsg.classList.remove('hidden');
}

loadSets();