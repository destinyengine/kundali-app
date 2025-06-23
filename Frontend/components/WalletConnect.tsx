"use client";

import { useState, useEffect } from "react";
import { Wallet, Copy, ExternalLink, LogOut, User, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useWeb3Auth } from "@/contexts/Web3AuthContext";
import { toast } from "sonner";

const WalletConnect = () => {
  const { 
    isConnected, 
    isLoading, 
    login, 
    logout, 
    userInfo, 
    address, 
    getBalance 
  } = useWeb3Auth();
  
  const [balance, setBalance] = useState<string>("0");
  const [balanceLoading, setBalanceLoading] = useState(false);

  useEffect(() => {
    if (isConnected && address) {
      fetchBalance();
    }
  }, [isConnected, address]);

  const fetchBalance = async () => {
    setBalanceLoading(true);
    try {
      const bal = await getBalance();
      setBalance(bal);
    } catch (error) {
      console.error("Error fetching balance:", error);
    } finally {
      setBalanceLoading(false);
    }
  };

  const truncateAddress = (addr: string) => {
    if (!addr) return "";
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Address copied to clipboard!");
    } catch (error) {
      toast.error("Failed to copy address");
    }
  };

  const openEtherscan = () => {
    if (address) {
      window.open(`https://etherscan.io/address/${address}`, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
        <span className="text-sm text-muted-foreground">Connecting...</span>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <Button
        onClick={login}
        className="flex items-center gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg transition-all duration-200 hover:shadow-xl"
        size="sm"
      >
        <Wallet className="h-4 w-4" />
        Connect Wallet
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 h-10 px-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border-purple-200 dark:border-purple-700 hover:from-purple-100 hover:to-blue-100 dark:hover:from-purple-900/30 dark:hover:to-blue-900/30 transition-all duration-200"
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={userInfo?.profileImage} alt="Profile" />
            <AvatarFallback className="bg-gradient-to-r from-purple-400 to-blue-400 text-white text-xs">
              {userInfo?.name?.charAt(0) || address?.charAt(2) || "W"}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col items-start">
            <span className="text-sm font-medium">
              {userInfo?.name || truncateAddress(address || "")}
            </span>
            <span className="text-xs text-muted-foreground">
              {truncateAddress(address || "")}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent className="w-80 p-0" align="end">
        <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={userInfo?.profileImage} alt="Profile" />
              <AvatarFallback className="bg-gradient-to-r from-purple-400 to-blue-400 text-white">
                {userInfo?.name?.charAt(0) || address?.charAt(2) || "W"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {userInfo?.name || "Wallet User"}
                </span>
                <Badge variant="secondary" className="text-xs">
                  Connected
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {userInfo?.email || "Web3 Account"}
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-medium">ETH Balance</span>
            </div>
            <div className="text-right">
              {balanceLoading ? (
                <div className="h-4 w-16 bg-muted-foreground/20 rounded animate-pulse"></div>
              ) : (
                <span className="text-sm font-mono">
                  {parseFloat(balance).toFixed(4)} ETH
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Address</span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-xs bg-background px-2 py-1 rounded">
                {truncateAddress(address || "")}
              </code>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
                onClick={() => copyToClipboard(address || "")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />
        
        <div className="p-2">
          <DropdownMenuItem
            onClick={openEtherscan}
            className="flex items-center gap-2 cursor-pointer"
          >
            <ExternalLink className="h-4 w-4" />
            View on Etherscan
          </DropdownMenuItem>
          
          <DropdownMenuItem
            onClick={() => copyToClipboard(address || "")}
            className="flex items-center gap-2 cursor-pointer"
          >
            <Copy className="h-4 w-4" />
            Copy Address
          </DropdownMenuItem>
          
          <DropdownMenuSeparator />
          
          <DropdownMenuItem
            onClick={logout}
            className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400"
          >
            <LogOut className="h-4 w-4" />
            Disconnect
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default WalletConnect;
