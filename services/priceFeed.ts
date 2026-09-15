// In-memory price cache
let priceCache: Record<string, number> = {
  'ethereum': 2500,
  'bitcoin': 65000,
  'litecoin': 70,
  'ripple': 0.60,
  'tron': 0.15,
  'binancecoin': 600,
  'polygon-ecosystem-token': 0.45,
  'arbitrum': 0.65,
  'optimism': 1.40,
  'avalanche-2': 28,
  'solana': 140,
  'tether': 1.0,
  'usd-coin': 1.0,
  'dai': 1.0,
  'wrapped-bitcoin': 65000,
  'chainlink': 12,
  'shiba-inu': 0.000015,
  'pepe': 0.000009,
  'bonk': 0.000018,
  'brett': 0.08,
  'degen-base': 0.005,
  'pancakeswap-token': 2.1,
  'binance-usd': 1.0,
  'weth': 2500,
  'usdb': 1.0,
};

let lastFetchTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export async function fetchLiveCryptoPrices(): Promise<Record<string, number>> {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL_MS && Object.keys(priceCache).length > 10) {
    return priceCache;
  }

  try {
    const ids = Object.keys(priceCache).join(',');
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    const response = await fetch(url, { headers: { Accept: 'application/json' } });

    if (response.ok) {
      const data = await response.json();
      for (const [id, val] of Object.entries<any>(data)) {
        if (val && typeof val.usd === 'number') {
          priceCache[id] = val.usd;
        }
      }
      lastFetchTime = now;
      return priceCache;
    }
  } catch {
    // Fallback: try Binance ticker for major assets
    try {
      const binanceUrl = 'https://api.binance.com/api/v3/ticker/price';
      const bRes = await fetch(binanceUrl);
      if (bRes.ok) {
        const bData: { symbol: string; price: string }[] = await bRes.json();
        const bMap: Record<string, number> = {};
        for (const item of bData) {
          bMap[item.symbol] = parseFloat(item.price);
        }

        if (bMap['ETHUSDT']) priceCache['ethereum'] = bMap['ETHUSDT'];
        if (bMap['BNBUSDT']) priceCache['binancecoin'] = bMap['BNBUSDT'];
        if (bMap['POLUSDT'] || bMap['MATICUSDT']) priceCache['polygon-ecosystem-token'] = bMap['POLUSDT'] || bMap['MATICUSDT'];
        if (bMap['SOLUSDT']) priceCache['solana'] = bMap['SOLUSDT'];
        if (bMap['AVAXUSDT']) priceCache['avalanche-2'] = bMap['AVAXUSDT'];
        if (bMap['ARBUSDT']) priceCache['arbitrum'] = bMap['ARBUSDT'];
        if (bMap['OPUSDT']) priceCache['optimism'] = bMap['OPUSDT'];
        if (bMap['BTCUSDT']) {
          priceCache['wrapped-bitcoin'] = bMap['BTCUSDT'];
          priceCache['bitcoin'] = bMap['BTCUSDT'];
        }
        if (bMap['LTCUSDT']) priceCache['litecoin'] = bMap['LTCUSDT'];
        if (bMap['XRPUSDT']) priceCache['ripple'] = bMap['XRPUSDT'];
        if (bMap['TRXUSDT']) priceCache['tron'] = bMap['TRXUSDT'];
        if (bMap['LINKUSDT']) priceCache['chainlink'] = bMap['LINKUSDT'];
        if (bMap['SHIBUSDT']) priceCache['shiba-inu'] = bMap['SHIBUSDT'];
        if (bMap['PEPEUSDT']) priceCache['pepe'] = bMap['PEPEUSDT'];
        if (bMap['BONKUSDT']) priceCache['bonk'] = bMap['BONKUSDT'];

        lastFetchTime = now;
      }
    } catch {
      // Use cached/fallback defaults
    }
  }

  return priceCache;
}

export function getPriceForToken(coingeckoId?: string): number {
  if (!coingeckoId) return 0;
  return priceCache[coingeckoId.toLowerCase()] || 0;
}

