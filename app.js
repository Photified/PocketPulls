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
            
            btn.innerHTML = `
                <div class="era-header-info">
                    <img class="era-symbol" src="${eraSymbolUrl}" alt="symbol">
                    <span>${seriesName}</span>
                </div>
                <span class="arrow">${isOpen ? '▲' : '▼'}</span>
            `;
            
            const content = document.createElement('div');
            content.className = `accordion-content ${isOpen ? 'show' : ''}`;
            
            const grid = document.createElement('div');
            grid.className = 'sets-grid';

            seriesSets[seriesName].forEach(set => {
                const setCard = document.createElement('div');
                setCard.className = 'set-card';
                // Pass the whole set object now instead of just id/name
                setCard.onclick = () => openSetView(set);

                setCard.innerHTML = `
                    <img class="set-logo" src="${set.images.logo}" alt="${set.name}" loading="lazy">
                `;
                grid.appendChild(setCard);
            });

            content.appendChild(grid);
            container.appendChild(btn);
            container.appendChild(content);

            btn.onclick = function() {
                this.classList.toggle('active');
                content.classList.toggle('show');
                
                const span = this.querySelector('.arrow');
                span.innerText = this.classList.contains('active') ? '▲' : '▼';
            };
        });

    } catch (error) {
        document.getElementById('sets-container').innerHTML = '<p>Error loading sets.</p>';
        console.error("Failed to fetch sets:", error);
    }
}

// Now accepting the whole set object
async function openSetView(set) {
    document.getElementById('home-view').classList.add('hidden');
    document.getElementById('set-view').classList.remove('hidden');
    
    // Update title and symbol
    document.getElementById('current-set-title').innerText = set.name;
    const symbolImg = document.getElementById('current-set-symbol');
    symbolImg.src = set.images.symbol;
    symbolImg.classList.remove('hidden');

    const chaseContainer = document.getElementById('chase-container');
    
    // Inject the CSS Pokeball Loader
    chaseContainer.innerHTML = `
        <div class="loader-container">
            <div class="pokeball-spinner"></div>
            <div class="loader-text">Hunting for chases...</div>
        </div>
    `;

    try {
        const response = await fetch(`https://api.pokemontcg.io/v2/cards?q=set.id:${set.id}`);
        const data = await response.json();
        const cards = data.data;

        const validCards = cards.filter(card => getHighestPrice(card) > 0);

        if (validCards.length === 0) {
            chaseContainer.innerHTML = '<div class="no-data">No market price data available for this set yet! Check back after release.</div>';
            return;
        }

        const sortedCards = validCards.sort((a, b) => {
            return getHighestPrice(b) - getHighestPrice(a);
        });

        const top5 = sortedCards.slice(0, 5);
        renderChases(top5);

    } catch (error) {
        chaseContainer.innerHTML = '<p>Error loading market data.</p>';
        console.error("Failed to fetch cards:", error);
    }
}

document.getElementById('back-button').onclick = () => {
    document.getElementById('set-view').classList.add('hidden');
    document.getElementById('home-view').classList.remove('hidden');
    document.getElementById('chase-container').innerHTML = ''; 
    document.getElementById('current-set-symbol').classList.add('hidden'); // Hide symbol on back
};

function getHighestPrice(card) {
    if (!card.tcgplayer || !card.tcgplayer.prices) return 0;
    
    let maxPrice = 0;
    for (const key in card.tcgplayer.prices) {
        const marketPrice = card.tcgplayer.prices[key].market;
        if (marketPrice > maxPrice) {
            maxPrice = marketPrice;
        }
    }
    return maxPrice;
}

function renderChases(cards) {
    const container = document.getElementById('chase-container');
    container.innerHTML = ''; 

    cards.forEach(card => {
        const price = getHighestPrice(card);
        const priceString = `$${price.toFixed(2)}`;

        const cardItem = document.createElement('div');
        cardItem.className = 'card-item';

        cardItem.innerHTML = `
            <img class="chase-thumbnail" src="${card.images.small}" alt="${card.name}" 
                 onclick="openLightbox('${card.images.large}')" loading="lazy">
            <div class="price-tag">${priceString}</div>
        `;

        container.appendChild(cardItem);
    });
}

function openLightbox(largeImageUrl) {
    document.getElementById('lightbox-image').src = largeImageUrl;
    document.getElementById('lightbox').style.display = 'flex';
}

function closeLightbox() {
    document.getElementById('lightbox').style.display = 'none';
}

loadSets();