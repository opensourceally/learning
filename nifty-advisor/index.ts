import Fastify from 'fastify';
import axios from 'axios';
import fastifyStatic from '@fastify/static';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({
  logger: true
});

fastify.register(fastifyStatic, {
  root: path.join(__dirname, 'public'),
  prefix: '/', // optional: default '/'
});

// Sentiment word lists
const bullishWords = ['gain', 'surge', 'bullish', 'record', 'growth', 'rise', 'jump', 'up', 'high', 'positive', 'rally', 'recovery', 'boom', 'breakout', 'outperform', 'upgrade', 'buy', 'optimistic', 'omentum'];
const bearishWords = ['fall', 'drop', 'crash', 'bearish', 'decline', 'down', 'low', 'negative', 'slump', 'weak', 'loss', 'sell', 'pressure', 'recession', 'downgrade', 'cautious', 'fear', 'correction', 'bears'];

const analyzeSentiment = (headlines: string[]): { sentiment: string; score: number; bullCount: number; bearCount: number } => {
  let bullCount = 0;
  let bearCount = 0;

  headlines.forEach(headline => {
    const lowerHeadline = headline.toLowerCase();
    bullishWords.forEach(word => {
      if (lowerHeadline.includes(word)) bullCount++;
    });
    bearishWords.forEach(word => {
      if (lowerHeadline.includes(word)) bearCount++;
    });
  });

  const total = (bullCount + bearCount) || 1;
  const score = Math.round((bullCount / total) * 100);
  
  let sentiment = 'Neutral';
  if (score > 60) sentiment = 'Bullish';
  else if (score < 40) sentiment = 'Bearish';

  return { sentiment, score, bullCount, bearCount };
};

const getNewsSentiment = async (): Promise<NewsData> => {
  try {
    const rssUrl = 'https://economictimes.indiatimes.com/markets/stocks/rssfeeds/2146842.cms';
    const response = await axios.get(rssUrl);
    const xml = response.data;
    
    // Simple extraction of titles from XML items
    const titles = [...xml.matchAll(/<title>(.*?)<\/title>/g)].map(match => match[1]);
    
    // Filter out the channel title itself
    const headlines = titles.filter(t => !t.includes("Economic Times") && !t.includes("ET Markets"));

    const analysis = analyzeSentiment(headlines);

    return { sentiment: analysis.sentiment, score: analysis.score };
  } catch (error) {
    console.error('Failed to fetch news sentiment:', error);
    return { sentiment: 'Neutral', score: 50 };
  }
};

// Fetch international news sentiment from global sources
const getInternationalNewsSentiment = async (): Promise<InternationalNewsData> => {
  const sources = [
    { name: 'Reuters Business', url: 'https://www.reutersagency.com/feed/?taxonomy=best-sectors&post_type=best' },
    { name: 'Yahoo Finance', url: 'https://finance.yahoo.com/news/rssindex' }
  ];

  const allHeadlines: string[] = [];
  const sourceResults: { source: string; sentiment: string; score: number }[] = [];

  for (const source of sources) {
    try {
      const response = await axios.get(source.url, { timeout: 5000 });
      const xml = response.data;
      const titles = [...xml.matchAll(/<title>(.*?)<\/title>/g)].map(match => match[1]);
      const headlines = titles.filter(t => !t.includes(source.name) && t.length > 10 && !t.includes('<?xml'));
      
      allHeadlines.push(...headlines);
      const analysis = analyzeSentiment(headlines);
      sourceResults.push({ source: source.name, sentiment: analysis.sentiment, score: analysis.score });
    } catch (error) {
      console.error(`Failed to fetch from ${source.name}:`, error);
      sourceResults.push({ source: source.name, sentiment: 'Neutral', score: 50 });
    }
  }

  // Aggregate all headlines for overall international sentiment
  const overallAnalysis = analyzeSentiment(allHeadlines);
  
  return {
    sentiment: overallAnalysis.sentiment,
    score: overallAnalysis.score,
    sources: sourceResults
  };
};

// Fetch international market sentiment from global indices
const getInternationalMarketSentiment = async (): Promise<InternationalMarketData> => {
  const indices = [
    { name: 'S&P 500', symbol: 'SPY', region: 'US' },
    { name: 'NASDAQ', symbol: 'QQQ', region: 'US' },
    { name: 'Dow Jones', symbol: 'DIA', region: 'US' },
    { name: 'Nikkei 225', symbol: 'EWJ', region: 'Japan' },
    { name: 'Hang Seng', symbol: 'EWH', region: 'Hong Kong' },
    { name: 'FTSE 100', symbol: 'EWU', region: 'UK' },
    { name: 'DAX', symbol: 'EWG', region: 'Germany' }
  ];

  const results: { name: string; region: string; change: number; sentiment: string }[] = [];

  // Try to fetch from Yahoo Finance for US indices (most reliable)
  try {
    const symbols = indices.filter(i => i.region === 'US').map(i => i.symbol).join(',');
    const response = await axios.get(`https://query1.finance.yahoo.com/v7/finance/quote?symbols=${symbols}`, {
      headers: { 'User-Agent': userAgent }
    });
    
    if (response.data?.quoteResponse?.result) {
      for (const quote of response.data.quoteResponse.result) {
        const change = quote.regularMarketChangePercent || 0;
        let sentiment = 'Neutral';
        if (change > 0.3) sentiment = 'Bullish';
        else if (change < -0.3) sentiment = 'Bearish';
        
        results.push({
          name: quote.symbol,
          region: 'US',
          change: change,
          sentiment
        });
      }
    }
  } catch (error) {
    console.error('Failed to fetch US market data:', error);
  }

  // For non-US indices, use predefined sentiment based on typical market hours
  // In production, you'd use a more reliable data source
  const asianMarkets = ['Nikkei 225', 'Hang Seng'];
  const europeanMarkets = ['FTSE 100', 'DAX'];
  
  // Add mock data for Asian markets (would need real API in production)
  for (const idx of indices.filter(i => asianMarkets.includes(i.name))) {
    results.push({ name: idx.name, region: idx.region, change: 0, sentiment: 'Neutral' });
  }
  
  // Add mock data for European markets
  for (const idx of indices.filter(i => europeanMarkets.includes(i.name))) {
    results.push({ name: idx.name, region: idx.region, change: 0, sentiment: 'Neutral' });
  }

  // Calculate overall international sentiment
  const bullishCount = results.filter(r => r.sentiment === 'Bullish').length;
  const bearishCount = results.filter(r => r.sentiment === 'Bearish').length;
  const total = results.length || 1;
  
  let overallSentiment = 'Neutral';
  const sentimentScore = Math.round((bullishCount / total) * 100);
  
  if (sentimentScore > 60) overallSentiment = 'Bullish';
  else if (sentimentScore < 40) overallSentiment = 'Bearish';

  return {
    sentiment: overallSentiment,
    score: sentimentScore,
    indices: results
  };
};

// Function to fetch Option Chain Data from NSE India
let nseCookies = '';

const userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

async function fetchNSECookies() {
  try {
    // Phase 1: Initial load
    const response = await axios.get('https://www.nseindia.com', {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    let cookies = response.headers['set-cookie']?.map(cookie => cookie.split(';')[0]).join('; ');

    // Phase 2: Warm-up to ensure Akamai/Advanced cookies are set
    await axios.get('https://www.nseindia.com/option-chain', {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Cookie': cookies
      }
    });

    if (cookies) {
      nseCookies = cookies;
    }
  } catch (err) {
    console.error('Failed to get NSE cookies:', err);
  }
}

async function getLatestExpiryDate(): Promise<string | null> {
  try {
    const url = 'https://www.nseindia.com/api/option-chain-contract-info?symbol=NIFTY';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/option-chain',
        'Cookie': nseCookies
      }
    });
    return response.data?.expiryDates?.[0] || null;
  } catch (err) {
    console.error('Failed to fetch expiry dates:', err);
    return null;
  }
}

const getOptionChainData = async (): Promise<OptionChainData> => {
  try {
    if (!nseCookies) {
      await fetchNSECookies();
    }

    const expiry = await getLatestExpiryDate();
    if (!expiry) {
      throw new Error("Could not fetch expiry date");
    }

    const url = `https://www.nseindia.com/api/option-chain-v3?type=Indices&symbol=NIFTY&expiry=${expiry}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent,
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/option-chain',
        'Cookie': nseCookies
      }
    });
    const data = response.data;
    console.log('data', data);
    const spotPrice = data.records.underlyingValue;

    // Filter out strikes that are too far from the spot price
    const filteredRecords = data.records.data.filter((record: any) => {
      return record.strikePrice >= spotPrice * 0.95 && record.strikePrice <= spotPrice * 1.05;
    });

    const strikes = filteredRecords.map((record: any) => {
      return {
        price: record.strikePrice,
        callOI: record.CE ? record.CE.openInterest : 0,
        putOI: record.PE ? record.PE.openInterest : 0
      };
    });

    return {
      spotPrice,
      strikes
    };
  } catch (error) {
    console.error("Error fetching NSE Option Chain data, falling back to mock... (Bot detection likely)", error);
    nseCookies = '';
    const baseSpot = 23000;
    const spotPrice = Math.floor(baseSpot + Math.random() * 500);
    const strikes = [];
    for (let i = -3; i <= 3; i++) {
      const strikePrice = Math.round(spotPrice / 100) * 100 + (i * 100);
      strikes.push({
        price: strikePrice,
        callOI: Math.floor(Math.random() * 5000000 + 1000000),
        putOI: Math.floor(Math.random() * 5000000 + 1000000)
      });
    }
    return { spotPrice, strikes };
  }
};

interface NewsData {
  sentiment: string;
  score: number;
}

interface InternationalNewsData {
  sentiment: string;
  score: number;
  sources: { source: string; sentiment: string; score: number }[];
}

interface InternationalMarketData {
  sentiment: string;
  score: number;
  indices: { name: string; region: string; change: number; sentiment: string }[];
}

interface OptionChainData {
  spotPrice: number;
  strikes: {
    price: number;
    callOI: number;
    putOI: number;
  }[];
}

// Combine domestic and international sentiment into a weighted score
const combineSentiment = (
  domesticNews: NewsData,
  internationalNews: InternationalNewsData,
  internationalMarket: InternationalMarketData
): { combinedSentiment: string; combinedScore: number; breakdown: { domestic: number; internationalNews: number; internationalMarket: number } } => {
  // Weights: Domestic news (50%), International news (25%), International market (25%)
  const domesticWeight = 0.5;
  const intlNewsWeight = 0.25;
  const intlMarketWeight = 0.25;

  const domesticScore = domesticNews.score;
  const intlNewsScore = internationalNews.sentiment === 'Neutral' ? 50 : 
                        internationalNews.sentiment === 'Bullish' ? internationalNews.score : 
                        100 - internationalNews.score;
  const intlMarketScore = internationalMarket.sentiment === 'Neutral' ? 50 : 
                          internationalMarket.sentiment === 'Bullish' ? internationalMarket.score : 
                          100 - internationalMarket.score;

  const combinedScore = Math.round(
    domesticScore * domesticWeight +
    intlNewsScore * intlNewsWeight +
    intlMarketScore * intlMarketWeight
  );

  let combinedSentiment = 'Neutral';
  if (combinedScore > 60) combinedSentiment = 'Bullish';
  else if (combinedScore < 40) combinedSentiment = 'Bearish';

  return {
    combinedSentiment,
    combinedScore,
    breakdown: {
      domestic: domesticScore,
      internationalNews: intlNewsScore,
      internationalMarket: intlMarketScore
    }
  };
};

// Core logic to determine where to invest
const analyzeMarket = (
  news: NewsData,
  optionChain: OptionChainData,
  internationalNews?: InternationalNewsData,
  internationalMarket?: InternationalMarketData
) => {
  const { spotPrice, strikes } = optionChain;

  // Predict support and resistance based on Open Interest
  // Support = Strike with highest Put OI
  // Resistance = Strike with highest Call OI
  let maxCallOI = 0;
  let maxPutOI = 0;
  let resistanceStrike = 0;
  let supportStrike = 0;
  let totalCallOI = 0;
  let totalPutOI = 0;

  for (const strike of strikes) {
    totalCallOI += strike.callOI;
    totalPutOI += strike.putOI;

    if (strike.callOI > maxCallOI) {
      maxCallOI = strike.callOI;
      resistanceStrike = strike.price;
    }
    if (strike.putOI > maxPutOI) {
      maxPutOI = strike.putOI;
      supportStrike = strike.price;
    }
  }

  // Put-Call Ratio (PCR) gives an idea of market sentiment from Options traders
  const globalPCR = (totalPutOI / (totalCallOI || 1)).toFixed(2);

  let recommendation = 'Hold / No Trade';
  let strategy = 'Wait for clearer signals';

  // Determine risk level based on alignment between Sentiment, PCR, and Price Action
  let riskLevel = 'Medium';
  const pcr = Number(globalPCR);
  
  // Use combined sentiment if international data is available
  let effectiveSentiment = news.sentiment;
  let effectiveScore = news.score;
  
  if (internationalNews && internationalMarket) {
    const combined = combineSentiment(news, internationalNews, internationalMarket);
    effectiveSentiment = combined.combinedSentiment;
    effectiveScore = combined.combinedScore;
  }
  
  const isSentimentBullish = effectiveSentiment === 'Bullish';
  const isSentimentBearish = effectiveSentiment === 'Bearish';
  const isSentimentNeutral = effectiveSentiment === 'Neutral';
  
  const isPcrBullish = pcr > 1.1; // More puts than calls (bullish)
  const isPcrBearish = pcr < 0.9; // More calls than puts (bearish)
  
  const isPriceAtSupport = spotPrice <= supportStrike * 1.01 && spotPrice >= supportStrike * 0.99;
  const isPriceAtResistance = spotPrice >= resistanceStrike * 0.99 && spotPrice <= resistanceStrike * 1.01;

  if (isSentimentBullish && isPcrBullish && spotPrice >= supportStrike) {
    riskLevel = 'Low'; // Strong alignment
  } else if (isSentimentBearish && isPcrBearish && spotPrice <= resistanceStrike) {
    riskLevel = 'Low'; // Strong alignment
  } else if ((isSentimentBullish && isPcrBearish) || (isSentimentBearish && isPcrBullish)) {
    riskLevel = 'High'; // Divergence
  } else if (isSentimentNeutral) {
    riskLevel = 'Medium';
  }

  // Basic Algorithm combining News, PCR, Support & Resistance
  if (isSentimentBullish && spotPrice >= supportStrike) {
    if (pcr > 1) {
      recommendation = 'Buy NIFTY Calls / Bull Call Spread';
      strategy = `Strong bullishness. Spot (${spotPrice}) is near or above support. PCR (${globalPCR}) indicates strong put writing. Consider ATMs or slightly OTMs Calls.`;
    } else {
      recommendation = 'Buy NIFTY Calls with Caution';
      strategy = `News is bullish, but low PCR (${globalPCR}) shows call writers are active. Buy with strict stop loss.`;
    }
  } else if (isSentimentBearish && spotPrice <= resistanceStrike) {
    if (pcr < 1) {
      recommendation = 'Buy NIFTY Puts / Bear Put Spread';
      strategy = `Strong bearishness. Spot (${spotPrice}) is facing resistance. PCR (${globalPCR}) shows strong call writing. Consider ATM Puts.`;
    } else {
      recommendation = 'Sell NIFTY Calls';
      strategy = `News is bearish but PCR is solid. Consider selling OTM Calls above resistance (${resistanceStrike}) instead of buying puts to use time decay.`;
    }
  } else if (isSentimentNeutral) {
    recommendation = 'Short Strangle / Iron Condor';
    strategy = `Market is sideways. Sell OTM Calls above resistance (${resistanceStrike}) and OTM Puts below support (${supportStrike}) to collect premium.`;
  }

  // Build international context string for the strategy
  let intlContext = '';
  if (internationalMarket && internationalMarket.indices.length > 0) {
    const usMarkets = internationalMarket.indices.filter(i => i.region === 'US');
    if (usMarkets.length > 0) {
      const avgChange = usMarkets.reduce((sum, m) => sum + m.change, 0) / usMarkets.length;
      intlContext = ` | US Markets: ${avgChange > 0 ? '+' : ''}${avgChange.toFixed(2)}%`;
    }
  }

  return {
    timestamp: new Date().toISOString(),
    marketData: {
      spotPrice,
      supportLevel: supportStrike,
      resistanceLevel: resistanceStrike,
      putCallRatio: Number(globalPCR),
      strikes,
    },
    newsAnalysis: news,
    internationalAnalysis: internationalNews && internationalMarket ? {
      newsSentiment: internationalNews,
      marketSentiment: internationalMarket,
      combinedScore: effectiveScore,
      combinedSentiment: effectiveSentiment
    } : undefined,
    investmentAdvice: {
      recommendation,
      strategy: strategy + intlContext,
      riskLevel
    }
  };
}

fastify.get('/nifty-advisor', async (request, reply) => {
  try {
    // Fetch all data in parallel
    const [news, optionChain, intlNews, intlMarket] = await Promise.all([
      getNewsSentiment(),
      getOptionChainData(),
      getInternationalNewsSentiment().catch(err => {
        console.error('Failed to fetch international news:', err);
        return null;
      }),
      getInternationalMarketSentiment().catch(err => {
        console.error('Failed to fetch international market:', err);
        return null;
      })
    ]);

    // Pass international data to the analyzer
    const analysis = analyzeMarket(news, optionChain, intlNews || undefined, intlMarket || undefined);

    return reply.send({
      success: true,
      data: analysis
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ success: false, error: 'Failed to generate recommendation' });
  }
});

// Endpoint for domestic-only analysis (legacy)
fastify.get('/nifty-advisor/domestic', async (request, reply) => {
  try {
    const news = await getNewsSentiment();
    const optionChain = await getOptionChainData();

    const analysis = analyzeMarket(news, optionChain);

    return reply.send({
      success: true,
      data: analysis
    });
  } catch (error) {
    request.log.error(error);
    return reply.status(500).send({ success: false, error: 'Failed to generate recommendation' });
  }
});

// fastify.get('/', async (request, reply) => {
//     return reply.send({ message: "Welcome to Nifty F&O Advisor. Go to /nifty-advisor to get recommendations." });
// });

// Run the server
const start = async () => {
  try {
    // Bun runs the server natively, but Fastify's interface makes it standard across runtimes
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('NIFTY Advisor Server is running at http://localhost:3000');
    console.log('Access the advisor endpoint at http://localhost:3000/nifty-advisor');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();