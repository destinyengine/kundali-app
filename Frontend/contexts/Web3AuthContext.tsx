"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK, UserInfo } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { ethers } from "ethers";

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ";

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0x1",
  rpcTarget: "https://rpc.ankr.com/eth",
  displayName: "Ethereum Mainnet",
  blockExplorerUrl: "https://etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
};

// Initialize Web3Auth instance
let web3auth: Web3Auth | null = null;

const initializeWeb3Auth = () => {
  if (typeof window === "undefined") return null;
  
  if (!web3auth) {
    try {
      const privateKeyProvider = new EthereumPrivateKeyProvider({
        config: { chainConfig },
      });

      web3auth = new Web3Auth({
        clientId,
        web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
        privateKeyProvider: privateKeyProvider as any,
        uiConfig: {
          appName: "Destiny Engine",
          theme: {
            primary: "#7c3aed",
          },
          mode: "light",
          defaultLanguage: "en",
        },
      });
    } catch (error) {
      console.error("Error creating Web3Auth instance:", error);
      return null;
    }
  }
  
  return web3auth;
};

interface Web3AuthContextType {
  isConnected: boolean;
  isLoading: boolean;
  userInfo: Partial<UserInfo> | null;
  address: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getBalance: () => Promise<string>;
}

const Web3AuthContext = createContext<Web3AuthContextType | undefined>(undefined);

export const useWeb3Auth = (): Web3AuthContextType => {
  const context = useContext(Web3AuthContext);
  if (!context) {
    throw new Error("useWeb3Auth must be used within a Web3AuthProvider");
  }
  return context;
};

interface Web3AuthProviderProps {
  children: ReactNode;
}

export const Web3AuthProvider = ({ children }: Web3AuthProviderProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [userInfo, setUserInfo] = useState<Partial<UserInfo> | null>(null);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const web3authInstance = initializeWeb3Auth();
        if (!web3authInstance) {
          setIsLoading(false);
          return;
        }

        await web3authInstance.init();
        
        if (web3authInstance.connected) {
          setIsConnected(true);
          const user = await web3authInstance.getUserInfo();
          setUserInfo(user);
          
          if (web3authInstance.provider) {
            const ethersProvider = new ethers.BrowserProvider(web3authInstance.provider as any);
            const signer = await ethersProvider.getSigner();
            const userAddress = await signer.getAddress();
            setAddress(userAddress);
          }
        }
      } catch (error) {
        console.error("Error initializing Web3Auth:", error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = async () => {
    try {
      setIsLoading(true);
      const web3authInstance = initializeWeb3Auth();
      if (!web3authInstance) {
        throw new Error("Web3Auth not initialized");
      }

      const web3authProvider = await web3authInstance.connect();
      
      if (web3authProvider) {
        setIsConnected(true);
        const user = await web3authInstance.getUserInfo();
        setUserInfo(user);
        
        const ethersProvider = new ethers.BrowserProvider(web3authProvider as any);
        const signer = await ethersProvider.getSigner();
        const userAddress = await signer.getAddress();
        setAddress(userAddress);
      }
    } catch (error) {
      console.error("Error during login:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      const web3authInstance = initializeWeb3Auth();
      if (!web3authInstance) return;

      await web3authInstance.logout();
      setIsConnected(false);
      setUserInfo(null);
      setAddress(null);
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  const getBalance = async (): Promise<string> => {
    const web3authInstance = initializeWeb3Auth();
    if (!web3authInstance?.provider || !address) return "0";
    
    try {
      const ethersProvider = new ethers.BrowserProvider(web3authInstance.provider as any);
      const balance = await ethersProvider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("Error fetching balance:", error);
      return "0";
    }
  };

  const value: Web3AuthContextType = {
    isConnected,
    isLoading,
    userInfo,
    address,
    login,
    logout,
    getBalance,
  };

  return (
    <Web3AuthContext.Provider value={value}>
      {children}
    </Web3AuthContext.Provider>
  );
};