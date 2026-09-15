import { ChainConfig } from '../types/wallet';

export const SUPPORTED_CHAINS: ChainConfig[] = [
  // ================= MAINNETS =================
  {
    id: 'ethereum',
    chainIdNum: 1,
    name: 'Ethereum Mainnet',
    shortName: 'ETH',
    type: 'evm',
    category: 'mainnet',
    color: '#627EEA',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
    rpcUrls: [
      'https://ethereum-rpc.publicnode.com',
      'https://rpc.meowrpc.com/eth',
      'https://gateway.tenderly.co/public/mainnet',
      'https://lb.drpc.live/ethereum/AlR5Bwaj40U5lG4A4leeg-jrohKrsHcR8b-XMrvp6PLd'
    ],
    explorerUrl: 'https://etherscan.io',
    tokens: [
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'DAI', name: 'Dai Stablecoin', contractAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18, coingeckoId: 'dai' },
      { symbol: 'WBTC', name: 'Wrapped BTC', contractAddress: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8, coingeckoId: 'wrapped-bitcoin' },
      { symbol: 'LINK', name: 'Chainlink', contractAddress: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18, coingeckoId: 'chainlink' },
      { symbol: 'SHIB', name: 'Shiba Inu', contractAddress: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18, coingeckoId: 'shiba-inu' },
      { symbol: 'PEPE', name: 'Pepe', contractAddress: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18, coingeckoId: 'pepe' },
      { symbol: 'UNI', name: 'Uniswap', contractAddress: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18, coingeckoId: 'uniswap' },
      { symbol: 'WETH', name: 'Wrapped Ether', contractAddress: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18, coingeckoId: 'weth' }
    ]
  },
  {
    id: 'bsc',
    chainIdNum: 56,
    name: 'BNB Smart Chain',
    shortName: 'BSC',
    type: 'evm',
    category: 'mainnet',
    color: '#F3BA2F',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
      coingeckoId: 'binancecoin',
    },
    rpcUrls: [
      'https://bsc-rpc.publicnode.com',
      'https://bsc-dataseed1.defibit.io',
      'https://bsc-dataseed2.defibit.io',
      'https://bsc-dataseed1.ninicoin.io',
      'https://binance.nodereal.io',
      'https://bsc-dataseed3.defibit.io',
      'https://bsc-dataseed2.ninicoin.io'
    ],
    explorerUrl: 'https://bscscan.com',
    tokens: [
      { symbol: 'USDT', name: 'Tether USD (BSC)', contractAddress: '0x55d398326f99059fF775485246999027B3197955', decimals: 18, coingeckoId: 'tether' },
      { symbol: 'USDC', name: 'USD Coin (BSC)', contractAddress: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18, coingeckoId: 'usd-coin' },
      { symbol: 'BUSD', name: 'Binance USD', contractAddress: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', decimals: 18, coingeckoId: 'binance-usd' },
      { symbol: 'CAKE', name: 'PancakeSwap', contractAddress: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', decimals: 18, coingeckoId: 'pancakeswap-token' },
      { symbol: 'WBNB', name: 'Wrapped BNB', contractAddress: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', decimals: 18, coingeckoId: 'binancecoin' },
      { symbol: 'BTCB', name: 'Bitcoin BEP2', contractAddress: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', decimals: 18, coingeckoId: 'wrapped-bitcoin' }
    ]
  },
  {
    id: 'polygon',
    chainIdNum: 137,
    name: 'Polygon',
    shortName: 'POL',
    type: 'evm',
    category: 'mainnet',
    color: '#8247E5',
    nativeCurrency: {
      name: 'Polygon Ecosystem Token',
      symbol: 'POL',
      decimals: 18,
      coingeckoId: 'polygon-ecosystem-token',
    },
    rpcUrls: [
      'https://polygon-bor-rpc.publicnode.com',
      'https://polygon-rpc.com'
    ],
    explorerUrl: 'https://polygonscan.com',
    tokens: [
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', name: 'Native USDC', contractAddress: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'WETH', name: 'Wrapped Ether', contractAddress: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', decimals: 18, coingeckoId: 'weth' },
      { symbol: 'QUICK', name: 'QuickSwap', contractAddress: '0xB5C064F955D8e7F38fE0460C556a72987494eE17', decimals: 18, coingeckoId: 'quickswap' }
    ]
  },
  {
    id: 'arbitrum',
    chainIdNum: 42161,
    name: 'Arbitrum One',
    shortName: 'ARB',
    type: 'evm',
    category: 'mainnet',
    color: '#28A0F0',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
    rpcUrls: [
      'https://arbitrum-one-rpc.publicnode.com',
      'https://arb1.arbitrum.io/rpc'
    ],
    explorerUrl: 'https://arbiscan.io',
    tokens: [
      { symbol: 'ARB', name: 'Arbitrum', contractAddress: '0x912CE59144191C1204E64559FE8253a0e49E6548', decimals: 18, coingeckoId: 'arbitrum' },
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'GMX', name: 'GMX', contractAddress: '0xfc5A1A6EB076a2C7aD06eD22C90d7E710E35ad0a', decimals: 18, coingeckoId: 'gmx' }
    ]
  },
  {
    id: 'base',
    chainIdNum: 8453,
    name: 'Base',
    shortName: 'BASE',
    type: 'evm',
    category: 'mainnet',
    color: '#0052FF',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
    rpcUrls: [
      'https://base-rpc.publicnode.com',
      'https://mainnet.base.org'
    ],
    explorerUrl: 'https://basescan.org',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'BRETT', name: 'Brett', contractAddress: '0x532f27101965dd16442E59d40670FaF5eBB142E4', decimals: 18, coingeckoId: 'brett' },
      { symbol: 'DEGEN', name: 'Degen', contractAddress: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18, coingeckoId: 'degen-base' },
      { symbol: 'AERO', name: 'Aerodrome Finance', contractAddress: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18, coingeckoId: 'aerodrome-finance' },
      { symbol: 'TOSHI', name: 'Toshi', contractAddress: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', decimals: 18, coingeckoId: 'toshi' }
    ]
  },
  {
    id: 'optimism',
    chainIdNum: 10,
    name: 'Optimism Mainnet',
    shortName: 'OP',
    type: 'evm',
    category: 'mainnet',
    color: '#FF0420',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
    rpcUrls: [
      'https://mainnet.optimism.io',
      'https://optimism-rpc.publicnode.com',
      'https://optimism.drpc.org',
      'https://1rpc.io/op'
    ],
    explorerUrl: 'https://optimistic.etherscan.io',
    tokens: [
      { symbol: 'OP', name: 'Optimism', contractAddress: '0x4200000000000000000000000000000000000042', decimals: 18, coingeckoId: 'optimism' },
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6, coingeckoId: 'usd-coin' }
    ]
  },
  {
    id: 'avalanche',
    chainIdNum: 43114,
    name: 'Avalanche C-Chain',
    shortName: 'AVAX',
    type: 'evm',
    category: 'mainnet',
    color: '#E84142',
    nativeCurrency: {
      name: 'Avalanche',
      symbol: 'AVAX',
      decimals: 18,
      coingeckoId: 'avalanche-2',
    },
    rpcUrls: [
      'https://api.avax.network/ext/bc/C/rpc',
      'https://avalanche-c-chain-rpc.publicnode.com',
      'https://avalanche.drpc.org',
      'https://1rpc.io/avax/c'
    ],
    explorerUrl: 'https://snowtrace.io',
    tokens: [
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6, coingeckoId: 'usd-coin' }
    ]
  },
  {
    id: 'linea',
    chainIdNum: 59144,
    name: 'Linea Mainnet',
    shortName: 'LINEA',
    type: 'evm',
    category: 'mainnet',
    color: '#121212',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
    rpcUrls: [
      'https://rpc.linea.build',
      'https://linea.drpc.org',
      'https://1rpc.io/linea'
    ],
    explorerUrl: 'https://lineascan.build',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', contractAddress: '0x176211869cA2b568f2A7D4EE941E073a821EE1ff', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', name: 'Tether USD', contractAddress: '0xA219439258ca9da29E9Cc4cE5596924745e12B93', decimals: 6, coingeckoId: 'tether' }
    ]
  },
  {
    id: 'blast',
    chainIdNum: 81457,
    name: 'Blast',
    shortName: 'BLAST',
    type: 'evm',
    category: 'mainnet',
    color: '#FCFC03',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
      coingeckoId: 'ethereum',
    },
    rpcUrls: [
      'https://rpc.blast.io',
      'https://blast.drpc.org',
      'https://blast-rpc.publicnode.com'
    ],
    explorerUrl: 'https://blastscan.io',
    tokens: [
      { symbol: 'USDB', name: 'Blast USD', contractAddress: '0x4300000000000000000000000000000000000003', decimals: 18, coingeckoId: 'usdb' }
    ]
  },
  {
    id: 'solana-mainnet',
    name: 'Solana Mainnet',
    shortName: 'SOL',
    type: 'solana',
    category: 'mainnet',
    color: '#14F195',
    nativeCurrency: {
      name: 'Solana',
      symbol: 'SOL',
      decimals: 9,
      coingeckoId: 'solana',
    },
    rpcUrls: [
      'https://mainnet.helius-rpc.com/?api-key=ed0de9ee-57bc-4096-8bf7-674d953d7a9a',
      'https://mainnet.helius-rpc.com/?api-key=32dda240-06fe-4c43-baa1-754938ec2bde',
      'https://mainnet.helius-rpc.com/?api-key=19384a06-42a5-4650-8b44-c79e189e8db2',
      'https://mainnet.helius-rpc.com/?api-key=d9d1446b-eaf7-426e-9e89-31f8f0e3f406',
      'https://mainnet.helius-rpc.com/?api-key=14a99a00-b5d3-4087-98ea-201ea17f469e',
      'https://red-shy-research.solana-mainnet.quiknode.pro/796cd5064d4e908aef58ac7d0674bebcc09c1966/',
      'https://solana-rpc.publicnode.com'
    ],
    explorerUrl: 'https://solscan.io',
    tokens: [
      { symbol: 'USDC', name: 'USD Coin', contractAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', decimals: 6, coingeckoId: 'usd-coin' },
      { symbol: 'USDT', name: 'Tether USD', contractAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', decimals: 6, coingeckoId: 'tether' },
      { symbol: 'BONK', name: 'Bonk', contractAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263', decimals: 5, coingeckoId: 'bonk' },
      { symbol: 'JUP', name: 'Jupiter', contractAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN', decimals: 6, coingeckoId: 'jupiter-exchange-solana' },
      { symbol: 'WIF', name: 'dogwifhat', contractAddress: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm', decimals: 6, coingeckoId: 'dogwifcoin' },
      { symbol: 'RAY', name: 'Raydium', contractAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R', decimals: 6, coingeckoId: 'raydium' },
      { symbol: 'PYTH', name: 'Pyth Network', contractAddress: 'HZ1JovNiDcZvKhVkRWnCtVVhMrnvwgL9KKist4aF6L80', decimals: 6, coingeckoId: 'pyth-network' },
      { symbol: 'BOME', name: 'BOOK OF MEME', contractAddress: 'ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82', decimals: 6, coingeckoId: 'book-of-meme' }
    ]
  },
  {
    id: 'tron-mainnet',
    name: 'TRON Mainnet',
    shortName: 'TRX',
    type: 'tron',
    category: 'mainnet',
    color: '#FF0013',
    nativeCurrency: {
      name: 'TRON',
      symbol: 'TRX',
      decimals: 6,
      coingeckoId: 'tron',
    },
    rpcUrls: [
      'https://tron-rpc.publicnode.com',
      'https://trx.mytokenpocket.vip',
      'https://api.trongrid.io'
    ],
    explorerUrl: 'https://tronscan.org',
    tokens: [
      { symbol: 'USDT', name: 'Tether USD (TRC-20)', contractAddress: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t', decimals: 6, coingeckoId: 'tether' }
    ]
  },
  {
    id: 'bitcoin-mainnet',
    name: 'Bitcoin Mainnet',
    shortName: 'BTC',
    type: 'bitcoin',
    category: 'mainnet',
    color: '#F7931A',
    nativeCurrency: {
      name: 'Bitcoin',
      symbol: 'BTC',
      decimals: 8,
      coingeckoId: 'bitcoin',
    },
    rpcUrls: [
      'https://mempool.space/api',
      'https://blockstream.info/api'
    ],
    explorerUrl: 'https://mempool.space',
    tokens: []
  },
  {
    id: 'litecoin-mainnet',
    name: 'Litecoin Mainnet',
    shortName: 'LTC',
    type: 'litecoin',
    category: 'mainnet',
    color: '#345D9D',
    nativeCurrency: {
      name: 'Litecoin',
      symbol: 'LTC',
      decimals: 8,
      coingeckoId: 'litecoin',
    },
    rpcUrls: [
      'https://litecoinspace.org/api'
    ],
    explorerUrl: 'https://litecoinspace.org',
    tokens: []
  },
  {
    id: 'xrp-mainnet',
    name: 'XRP Ledger',
    shortName: 'XRP',
    type: 'xrp',
    category: 'mainnet',
    color: '#23292F',
    nativeCurrency: {
      name: 'XRP',
      symbol: 'XRP',
      decimals: 6,
      coingeckoId: 'ripple',
    },
    rpcUrls: [
      'https://xrplcluster.com',
      'https://s1.ripple.com:51234'
    ],
    explorerUrl: 'https://xrpscan.com',
    tokens: []
  },

  // ================= TESTNETS =================
  {
    id: 'sepolia',
    chainIdNum: 11155111,
    name: 'Ethereum Sepolia',
    shortName: 'Sepolia',
    type: 'evm',
    category: 'testnet',
    color: '#627EEA',
    nativeCurrency: { name: 'Sepolia ETH', symbol: 'SepoliaETH', decimals: 18, coingeckoId: 'ethereum' },
    rpcUrls: [
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://sepolia.drpc.org',
      'https://1rpc.io/sepolia',
      'https://rpc.sepolia.org'
    ],
    explorerUrl: 'https://sepolia.etherscan.io',
    tokens: []
  },
  {
    id: 'base-sepolia',
    chainIdNum: 84532,
    name: 'Base Sepolia',
    shortName: 'Base Sepolia',
    type: 'evm',
    category: 'testnet',
    color: '#0052FF',
    nativeCurrency: { name: 'Base Sepolia ETH', symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum' },
    rpcUrls: [
      'https://sepolia.base.org',
      'https://base-sepolia-rpc.publicnode.com',
      'https://base-sepolia.drpc.org'
    ],
    explorerUrl: 'https://sepolia.basescan.org',
    tokens: []
  },
  {
    id: 'arbitrum-sepolia',
    chainIdNum: 421614,
    name: 'Arbitrum Sepolia',
    shortName: 'Arb Sepolia',
    type: 'evm',
    category: 'testnet',
    color: '#28A0F0',
    nativeCurrency: { name: 'Arbitrum Sepolia ETH', symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum' },
    rpcUrls: [
      'https://sepolia-rollup.arbitrum.io/rpc',
      'https://arbitrum-sepolia.drpc.org',
      'https://arbitrum-sepolia-rpc.publicnode.com'
    ],
    explorerUrl: 'https://sepolia.arbiscan.io',
    tokens: []
  },
  {
    id: 'op-sepolia',
    chainIdNum: 11155420,
    name: 'Optimism Sepolia',
    shortName: 'OP Sepolia',
    type: 'evm',
    category: 'testnet',
    color: '#FF0420',
    nativeCurrency: { name: 'OP Sepolia ETH', symbol: 'ETH', decimals: 18, coingeckoId: 'ethereum' },
    rpcUrls: [
      'https://sepolia.optimism.io',
      'https://optimism-sepolia.drpc.org',
      'https://optimism-sepolia-rpc.publicnode.com'
    ],
    explorerUrl: 'https://sepolia-optimism.etherscan.io',
    tokens: []
  },
  {
    id: 'polygon-amoy',
    chainIdNum: 80002,
    name: 'Polygon Amoy Testnet',
    shortName: 'Amoy',
    type: 'evm',
    category: 'testnet',
    color: '#8247E5',
    nativeCurrency: { name: 'Polygon Amoy POL', symbol: 'POL', decimals: 18, coingeckoId: 'polygon-ecosystem-token' },
    rpcUrls: [
      'https://polygon-amoy.drpc.org',
      'https://polygon-amoy-bor-rpc.publicnode.com',
      'https://rpc-amoy.polygon.technology'
    ],
    explorerUrl: 'https://amoy.polygonscan.com',
    tokens: []
  },
  {
    id: 'bsc-testnet',
    chainIdNum: 97,
    name: 'BNB Smart Chain Testnet',
    shortName: 'tBSC',
    type: 'evm',
    category: 'testnet',
    color: '#F3BA2F',
    nativeCurrency: { name: 'Test BNB', symbol: 'tBNB', decimals: 18, coingeckoId: 'binancecoin' },
    rpcUrls: [
      'https://bsc-testnet-rpc.publicnode.com',
      'https://bsc-testnet.drpc.org',
      'https://data-seed-prebsc-1-s2.binance.org:8545'
    ],
    explorerUrl: 'https://testnet.bscscan.com',
    tokens: []
  },
  {
    id: 'avalanche-fuji',
    chainIdNum: 43113,
    name: 'Avalanche Fuji Testnet',
    shortName: 'Fuji',
    type: 'evm',
    category: 'testnet',
    color: '#E84142',
    nativeCurrency: { name: 'Avalanche Fuji AVAX', symbol: 'AVAX', decimals: 18, coingeckoId: 'avalanche-2' },
    rpcUrls: [
      'https://avalanche-fuji-c-chain-rpc.publicnode.com',
      'https://api.avax-test.network/ext/bc/C/rpc'
    ],
    explorerUrl: 'https://testnet.snowtrace.io',
    tokens: []
  },
  {
    id: 'solana-devnet',
    name: 'Solana Devnet',
    shortName: 'SOL Dev',
    type: 'solana',
    category: 'testnet',
    color: '#14F195',
    nativeCurrency: { name: 'Solana Devnet SOL', symbol: 'SOL', decimals: 9, coingeckoId: 'solana' },
    rpcUrls: [
      'https://api.devnet.solana.com'
    ],
    explorerUrl: 'https://solscan.io?cluster=devnet',
    tokens: []
  }
];

export const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];


