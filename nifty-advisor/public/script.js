document.addEventListener('DOMContentLoaded', () => {
    fetchMarketData();
    // Refresh every 10 minutes (600000 ms)
    setInterval(fetchMarketData, 600000);
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
}

function showErrorState() {
    document.getElementById('lastUpdated').textContent = "Error loading data";
    document.querySelectorAll('.loading-shimmer').forEach(el => {
        el.textContent = 'Error';
        el.classList.remove('loading-shimmer');
    });
}
