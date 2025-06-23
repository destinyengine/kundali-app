"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Web3Auth } from "@web3auth/modal";
import { CHAIN_NAMESPACES, IProvider, WEB3AUTH_NETWORK } from "@web3auth/base";
import { EthereumPrivateKeyProvider } from "@web3auth/ethereum-provider";
import { ethers } from "ethers";

interface Web3AuthContextType {
  web3auth: Web3Auth | null;
  provider: IProvider | null;
  userInfo: any;
  isLoading: boolean;
  isConnected: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getUserInfo: () => Promise<any>;
  getAccounts: () => Promise<string[]>;
  getBalance: () => Promise<string>;
  address: string | null;
}

const Web3AuthContext = createContext<Web3AuthContextType | null>(null);

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || "BPi5PB_UiIZ-cPz1GtV5i1I2iOSOHuimiXBI0e-Oe_u6X3oVAbCiAZOTEBtTXw4tsluTITPqA8zMsfxIKMjiqNQ";

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: "0x1", // Ethereum Mainnet
  rpcTarget: "https://rpc.ankr.com/eth",
  displayName: "Ethereum Mainnet",
  blockExplorerUrl: "https://etherscan.io",
  ticker: "ETH",
  tickerName: "Ethereum",
  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
};

export const Web3AuthProvider = ({ children }: { children: ReactNode }) => {
  const [web3auth, setWeb3auth] = useState<Web3Auth | null>(null);
  const [provider, setProvider] = useState<IProvider | null>(null);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const privateKeyProvider = new EthereumPrivateKeyProvider({
          config: { chainConfig },
        });

        const web3authInstance = new Web3Auth({
          clientId,
          web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
          privateKeyProvider,
          uiConfig: {
            appName: "Destiny Engine",
            mode: "dark",
            logoLight: "https://web3auth.io/images/web3authlog.png",
            logoDark: "https://web3auth.io/images/web3authlogodark.png",
            defaultLanguage: "en",
            theme: {
              primary: "#768729",
            },
          },
        });

        setWeb3auth(web3authInstance);
        await web3authInstance.init();

        if (web3authInstance.connected) {
          setProvider(web3authInstance.provider);
          setIsConnected(true);
          const user = await web3authInstance.getUserInfo();
          setUserInfo(user);
          if (web3authInstance.provider) {
            const ethersProvider = new ethers.BrowserProvider(web3authInstance.provider);
            const signer = await ethersProvider.getSigner();
            const address = await signer.getAddress();
            setAddress(address);
          }
        }
      } catch (error) {
        console.error("Web3Auth initialization error:", error);
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = async () => {
    if (!web3auth) {
      console.log("Web3Auth not initialized yet");
      return;
    }
    
    try {
      setIsLoading(true);
      const web3authProvider = await web3auth.connect();
      setProvider(web3authProvider);
      setIsConnected(true);
      
      const user = await web3auth.getUserInfo();
      setUserInfo(user);
      
      if (web3authProvider) {
        const ethersProvider = new ethers.BrowserProvider(web3authProvider);
        const signer = await ethersProvider.getSigner();
        const address = await signer.getAddress();
        setAddress(address);
      }
    } catch (error) {
      console.error("Login error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    if (!web3auth) {
      console.log("Web3Auth not initialized yet");
      return;
    }
    
    try {
      await web3auth.logout();
      setProvider(null);
      setUserInfo(null);
      setIsConnected(false);
      setAddress(null);
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const getUserInfo = async () => {
    if (web3auth?.connected) {
      const user = await web3auth.getUserInfo();
      setUserInfo(user);
      return user;
    }
    return null;
  };

  const getAccounts = async () => {
    if (!provider) {
      console.log("Provider not initialized yet");
      return [];
    }
    
    try {
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      return [address];
    } catch (error) {
      console.error("Get accounts error:", error);
      return [];
    }
  };

  const getBalance = async () => {
    if (!provider) {
      console.log("Provider not initialized yet");
      return "0";
    }
    
    try {
      const ethersProvider = new ethers.BrowserProvider(provider);
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      const balance = await ethersProvider.getBalance(address);
      return ethers.formatEther(balance);
    } catch (error) {
      console.error("Get balance error:", error);
      return "0";
    }
  };

  const contextValue: Web3AuthContextType = {
    web3auth,
    provider,
    userInfo,
    isLoading,
    isConnected,
    login,
    logout,
    getUserInfo,
    getAccounts,
    getBalance,
    address,
  };

  return (
    <Web3AuthContext.Provider value={contextValue}>
      {children}
    </Web3AuthContext.Provider>
  );
};

export const useWeb3Auth = () => {
  const context = useContext(Web3AuthContext);
  if (!context) {
    throw new Error("useWeb3Auth must be used within a Web3AuthProvider");
  }
  return context;
};
