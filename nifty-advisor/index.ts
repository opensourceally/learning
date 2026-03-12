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

// Mock function to analyze news sentiment
// In a real application, you might use a service like NewsAPI and a sentiment analysis NLP library or LLM.
const getNewsSentiment = async () => {
  const sentiments = ['Bullish', 'Bearish', 'Neutral'];
  const randomSentiment = sentiments[Math.floor(Math.random() * sentiments.length)] as string;
  return { sentiment: randomSentiment, score: Math.round(Math.random() * 100) };
};

// Function to fetch Option Chain Data from NSE India
let nseCookies = '';

async function fetchNSECookies() {
  try {
    const response = await axios.get('https://www.nseindia.com', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.1.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    const setCookieHeader = response.headers['set-cookie'];
    if (setCookieHeader) {
      nseCookies = setCookieHeader.map(cookie => cookie.split(';')[0]).join('; ');
    }
  } catch (err) {
    console.error('Failed to get NSE cookies:', err);
  }
}

const getOptionChainData = async (): Promise<OptionChainData> => {
  try {
    if (!nseCookies) {
      await fetchNSECookies();
    }
    
    const url = 'https://www.nseindia.com/api/option-chain-indices?symbol=NIFTY';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.1.0 Safari/537.36',
        'Accept': 'application/json, text/javascript, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://www.nseindia.com/option-chain',
        'Cookie': nseCookies
      }
    });

    const data = response.data;
    const spotPrice = data.records.underlyingValue;
    
    // Filter out strikes that are too far from the spot price to keep the analysis scoped and performant
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
    // Fallback back to mock if NSE bot detection blocks us
    nseCookies = '';
    const baseSpot = 22000;
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

interface OptionChainData {
  spotPrice: number;
  strikes: {
    price: number;
    callOI: number;
    putOI: number;
  }[];
}

// Core logic to determine where to invest
const analyzeMarket = (news: NewsData, optionChain: OptionChainData) => {
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
  const riskLevel = 'Medium';

  // Basic Algorithm combining News, PCR, Support & Resistance
  if (news.sentiment === 'Bullish' && spotPrice >= supportStrike) {
    if (Number(globalPCR) > 1) {
      recommendation = 'Buy NIFTY Calls / Bull Call Spread';
      strategy = `Strong bullishness. Spot (${spotPrice}) is near or above support. PCR (${globalPCR}) indicates strong put writing. Consider ATMs or slightly OTMs Calls.`;
    } else {
      recommendation = 'Buy NIFTY Calls with Caution';
      strategy = `News is bullish, but low PCR (${globalPCR}) shows call writers are active. Buy with strict stop loss.`;
    }
  } else if (news.sentiment === 'Bearish' && spotPrice <= resistanceStrike) {
    if (Number(globalPCR) < 1) {
      recommendation = 'Buy NIFTY Puts / Bear Put Spread';
      strategy = `Strong bearishness. Spot (${spotPrice}) is facing resistance. PCR (${globalPCR}) shows strong call writing. Consider ATM Puts.`;
    } else {
      recommendation = 'Sell NIFTY Calls';
      strategy = `News is bearish but PCR is solid. Consider selling OTM Calls above resistance (${resistanceStrike}) instead of buying puts to use time decay.`;
    }
  } else if (news.sentiment === 'Neutral') {
    recommendation = 'Short Strangle / Iron Condor';
    strategy = `Market is sideways. Sell OTM Calls above resistance (${resistanceStrike}) and OTM Puts below support (${supportStrike}) to collect premium.`;
  }

  return {
    timestamp: new Date().toISOString(),
    marketData: {
      spotPrice,
      supportLevel: supportStrike,
      resistanceLevel: resistanceStrike,
      putCallRatio: Number(globalPCR),
    },
    newsAnalysis: news,
    investmentAdvice: {
      recommendation,
      strategy,
      riskLevel
    }
  };
}

fastify.get('/nifty-advisor', async (request, reply) => {
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