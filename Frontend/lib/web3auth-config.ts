import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID;

// Check if we have a valid Client ID
if (!clientId || clientId === "your_web3auth_client_id_here" || clientId.length < 32) {
  console.warn("⚠️ Web3Auth Client ID not properly configured. Please set up Web3Auth Dashboard first.");
}

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0x1", // Ethereum Mainnet
  rpcTarget: "https://rpc.ankr.com/eth",
  displayName: "Ethereum Mainnet",
  blockExplorer: "https://etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
};

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: { chainConfig },
});

// Only create Web3Auth instance if we have a valid client ID
export const web3auth = clientId && clientId !== "your_web3auth_client_id_here" && clientId.length >= 32 
  ? new Web3Auth({
      clientId,
      web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET, // Changed to DEVNET for testing
      privateKeyProvider,
      uiConfig: {
        appName: "Kundali Destiny Engine",
        mode: "auto", // Auto-detects light/dark mode
        logoLight: "/astrology.png",
        logoDark: "/astrology.png",
        defaultLanguage: "en",
        loginMethodsOrder: ["google", "github", "twitter", "discord"],
        theme: {
          primary: "#7c3aed", // Purple theme to match your app
        },
      },
    })
  : null;

// Initialize Web3Auth - only call this once
let isInitialized = false;
let initializationPromise: Promise<Web3Auth | null> | null = null;

export const initWeb3Auth = async () => {
  if (!web3auth) {
    console.warn("Web3Auth not configured. Please set up your Web3Auth Client ID first.");
    return null;
  }

  // If already initialized, return immediately
  if (isInitialized) {
    console.log("✅ Web3Auth already initialized");
    return web3auth;
  }

  // If initialization is in progress, wait for it
  if (initializationPromise) {
    console.log("⏳ Web3Auth initialization in progress, waiting...");
    return initializationPromise;
  }
  
  // Start new initialization
  initializationPromise = (async () => {
    try {
      console.log("🚀 Initializing Web3Auth...");
      await web3auth.initModal();
      isInitialized = true;
      console.log("✅ Web3Auth initialized successfully");
      return web3auth;
    } catch (error) {
      console.error("❌ Failed to initialize Web3Auth:", error);
      initializationPromise = null; // Reset so we can try again
      throw error;
    }
  })();

  return initializationPromise;
};
