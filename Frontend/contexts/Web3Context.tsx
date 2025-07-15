"use client";

import React, { 
  createContext, 
  useContext, 
  useEffect, 
  useState, 
  ReactNode,
  useCallback 
} from 'react';
import { web3auth, initWeb3Auth } from '@/lib/web3auth-config';
import { ethers } from 'ethers';

// Types for Next.js 15.3.0+ with strict TypeScript
interface User {
  address: string;
  email?: string;
  name?: string;
  profileImage?: string;
  authMethod: 'web3' | 'google' | 'github' | 'twitter';
}

interface Web3ContextType {
  user: User | null;
  isConnected: boolean;
  isLoading: boolean;
  connectWallet: () => Promise<void>;
  connectGoogle: () => Promise<void>;
  connectGitHub: () => Promise<void>;
  disconnect: () => Promise<void>;
  provider: ethers.BrowserProvider | null;
  error: string | null;
}

// Create context with undefined default for proper type checking
const Web3Context = createContext<Web3ContextType | undefined>(undefined);

interface Web3ProviderProps {
  children: ReactNode;
}

export const Web3Provider: React.FC<Web3ProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Initialize Web3Auth on component mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      setError(null);
      await initWeb3Auth();
      
      // Check if user is already connected
      if (web3auth.connected && web3auth.provider) {
        await setUserInfo();
      }
    } catch (error) {
      console.error("Web3Auth initialization failed:", error);
      setError("Failed to initialize authentication. Please refresh the page.");
    } finally {
      setIsLoading(false);
    }
  };

  const setUserInfo = async () => {
    try {
      if (!web3auth.connected || !web3auth.provider) {
        throw new Error("Web3Auth not connected");
      }

      // Create ethers provider compatible with Next.js 15.3.0+
      const ethersProvider = new ethers.BrowserProvider(web3auth.provider);
      setProvider(ethersProvider);
      
      const signer = await ethersProvider.getSigner();
      const address = await signer.getAddress();
      
      // Get user info from Web3Auth
      const userInfo = await web3auth.getUserInfo();
      
      const userData: User = {
        address,
        email: userInfo.email || undefined,
        name: userInfo.name || undefined,
        profileImage: userInfo.profileImage || undefined,
        authMethod: (userInfo.typeOfLogin as User['authMethod']) || 'web3'
      };
      
      setUser(userData);
      setIsConnected(true);
      
      // Save user data to backend
      await saveUserToDatabase(userData);
    } catch (error) {
      console.error("Failed to set user info:", error);
      setError("Failed to retrieve user information.");
    }
  };

  const saveUserToDatabase = async (userData: User) => {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';
      const response = await fetch(`${apiUrl}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: userData.address,
          email: userData.email,
          name: userData.name,
          profileImage: userData.profileImage,
          authMethod: userData.authMethod,
        }),
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Store authentication token
      if (data.token) {
        localStorage.setItem('authToken', data.token);
        localStorage.setItem('userId', data.user?.id?.toString() || '');
      }
    } catch (error) {
      console.error('Error saving user to database:', error);
      // Don't throw error here - user can still use the app without backend
    }
  };

  const connectWallet = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const web3authProvider = await web3auth.connect();
      if (web3authProvider) {
        await setUserInfo();
      }
    } catch (error) {
      console.error("Wallet connection failed:", error);
      setError("Failed to connect wallet. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectGoogle = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const web3authProvider = await web3auth.connectTo("openlogin", {
        loginProvider: "google"
      });
      
      if (web3authProvider) {
        await setUserInfo();
      }
    } catch (error) {
      console.error("Google connection failed:", error);
      setError("Failed to connect with Google. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const connectGitHub = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      const web3authProvider = await web3auth.connectTo("openlogin", {
        loginProvider: "github"
      });
      
      if (web3authProvider) {
        await setUserInfo();
      }
    } catch (error) {
      console.error("GitHub connection failed:", error);
      setError("Failed to connect with GitHub. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      setError(null);
      await web3auth.logout();
      
      // Clear state
      setUser(null);
      setIsConnected(false);
      setProvider(null);
      
      // Clear local storage
      localStorage.removeItem('authToken');
      localStorage.removeItem('userId');
      
    } catch (error) {
      console.error("Disconnect failed:", error);
      setError("Failed to disconnect. Please refresh the page.");
    }
  }, []);

  // Context value with proper typing
  const contextValue: Web3ContextType = {
    user,
    isConnected,
    isLoading,
    connectWallet,
    connectGoogle,
    connectGitHub,
    disconnect,
    provider,
    error,
  };

  return (
    <Web3Context.Provider value={contextValue}>
      {children}
    </Web3Context.Provider>
  );
};

// Custom hook with proper error handling
export const useWeb3 = (): Web3ContextType => {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
};

// Export types for use in other components
export type { User, Web3ContextType };
