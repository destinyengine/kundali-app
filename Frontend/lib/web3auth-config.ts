import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!;

if (!clientId) {
  throw new Error("NEXT_PUBLIC_WEB3AUTH_CLIENT_ID is not set in environment variables");
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

export const web3auth = new Web3Auth({
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
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
});

// Initialize Web3Auth - only call this once
let isInitialized = false;

export const initWeb3Auth = async () => {
  if (!isInitialized) {
    try {
      await web3auth.initModal();
      isInitialized = true;
    } catch (error) {
      console.error("Failed to initialize Web3Auth:", error);
      throw error;
    }
  }
  return web3auth;
};
