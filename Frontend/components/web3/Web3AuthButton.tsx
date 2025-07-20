"use client";

import { useWeb3AuthConnect, useWeb3AuthDisconnect, useWeb3Auth } from "@web3auth/modal/react";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Wallet, LogOut } from "lucide-react";
import { useEffect, useState } from "react";

export default function Web3AuthButton() {
  const [mounted, setMounted] = useState(false);
  const { connect } = useWeb3AuthConnect();
  const { disconnect } = useWeb3AuthDisconnect();
  const { isConnected: web3AuthConnected } = useWeb3Auth();
  const { address, isConnected } = useAccount();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Wallet className="w-4 h-4 mr-2" />
        Loading...
      </Button>
    );
  }

  const handleLogin = async () => {
    try {
      await connect();
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = async () => {
    try {
      await disconnect();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <div className="flex items-center space-x-2">
      {!isConnected && !web3AuthConnected ? (
        <Button
          onClick={handleLogin}
          variant="outline"
          size="sm"
          className="flex items-center space-x-2"
        >
          <Wallet className="w-4 h-4" />
          <span>Connect Wallet</span>
        </Button>
      ) : (
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
          </span>
          <Button
            onClick={handleLogout}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Disconnect</span>
          </Button>
        </div>
      )}
    </div>
  );
}
