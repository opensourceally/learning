let allStrikes = [];
let currentPage = 1;
const rowsPerPage = 10;

document.addEventListener('DOMContentLoaded', () => {
    fetchMarketData();
    // Refresh every 10 minutes (600000 ms)
    setInterval(fetchMarketData, 600000);

    // Event listeners for pagination
    document.getElementById('prevPageBtn').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderTable();
        }
    });

    document.getElementById('nextPageBtn').addEventListener('click', () => {
        const totalPages = Math.ceil(allStrikes.length / rowsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            renderTable();
        }
    });
});

async function fetchMarketData() {
    try {
        const response = await fetch('/nifty-advisor');
        const result = await response.json();
        
        if (result.success) {
            updateDashboard(result.data);
        } else {
            console.error('Failed to fetch data:', result.error);
            showErrorState();
        }
    } catch (error) {
        console.error('Error fetching market data:', error);
        showErrorState();
    }
}

function updateDashboard(data) {
    const { marketData, newsAnalysis, investmentAdvice, timestamp } = data;
    
    // Remove loading shimmers
    document.querySelectorAll('.loading-shimmer').forEach(el => {
        el.classList.remove('loading-shimmer');
    });

    // Update Timestamp
    const date = new Date(timestamp);
    document.getElementById('lastUpdated').textContent = `Last Updated: ${date.toLocaleTimeString()}`;

    // Update Market Overview
    document.getElementById('spotPrice').textContent = marketData.spotPrice;
    document.getElementById('supportLevel').textContent = marketData.supportLevel;
    document.getElementById('resistanceLevel').textContent = marketData.resistanceLevel;

    // Update Sentiment & Flow
    const sentimentElement = document.querySelector('#newsSentiment span');
    sentimentElement.textContent = newsAnalysis.sentiment;
    
    // Add specific color classes based on sentiment
    const sentimentBadge = document.getElementById('newsSentiment');
    sentimentBadge.className = 'sentiment-badge ' + newsAnalysis.sentiment.toLowerCase();

    document.getElementById('pcrValue').textContent = marketData.putCallRatio;

    // Update Trade Setup
    document.getElementById('riskLevel').textContent = `Risk: ${investmentAdvice.riskLevel}`;
    document.getElementById('recommendationTitle').textContent = investmentAdvice.recommendation;
    document.getElementById('recommendationStrategy').textContent = investmentAdvice.strategy;

    // Set global strikes data and reset pagination
    if (marketData.strikes && marketData.strikes.length > 0) {
        allStrikes = marketData.strikes;
        currentPage = 1;
        renderTable();
    } else {
        const tableBody = document.getElementById('optionChainTableBody');
        tableBody.innerHTML = '<tr><td colspan="3" style="text-align:center;">No strike data available right now.</td></tr>';
        document.getElementById('paginationControls').style.display = 'none';
    }
}

function renderTable() {
    const tableBody = document.getElementById('optionChainTableBody');
    tableBody.innerHTML = '';
    
    // Calculate start and end indices
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = Math.min(startIndex + rowsPerPage, allStrikes.length);
    const paginatedStrikes = allStrikes.slice(startIndex, endIndex);

    paginatedStrikes.forEach(strike => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td style="color: var(--danger-color); font-weight: 600;">${strike.callOI.toLocaleString('en-IN')}</td>
            <td style="font-weight: bold; background: rgba(255,255,255,0.05);">${strike.price}</td>
            <td style="color: var(--success-color); font-weight: 600;">${strike.putOI.toLocaleString('en-IN')}</td>
        `;
        tableBody.appendChild(row);
    });

    // Update pagination controls
    const totalPages = Math.ceil(allStrikes.length / rowsPerPage) || 1;
    document.getElementById('pageInfo').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('paginationControls').style.display = allStrikes.length > rowsPerPage ? 'flex' : 'none';
    
    // Disable/Enable buttons
    document.getElementById('prevPageBtn').disabled = currentPage === 1;
    document.getElementById('nextPageBtn').disabled = currentPage === totalPages;
}

function showErrorState() {
    document.getElementById('lastUpdated').textContent = "Error loading data";
    document.querySelectorAll('.loading-shimmer').forEach(el => {
        el.textContent = 'Error';
        el.classList.remove('loading-shimmer');
    });
}
