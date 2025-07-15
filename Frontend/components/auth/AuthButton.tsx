"use client";

import React from 'react';
import { useWeb3 } from '@/contexts/Web3Context';
import { Button } from '@/components/ui/button';
import { 
  Wallet, 
  User, 
  LogOut, 
  Chrome, 
  Github, 
  Loader2,
  AlertCircle 
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export const AuthButton: React.FC = () => {
  const { 
    user, 
    isConnected, 
    isLoading, 
    connectWallet, 
    connectGoogle, 
    connectGitHub, 
    disconnect,
    error 
  } = useWeb3();

  // Loading state
  if (isLoading) {
    return (
      <Button disabled variant="outline" className="min-w-[120px]">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  // Error state
  if (error) {
    return (
      <Alert className="max-w-md">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {error}
        </AlertDescription>
      </Alert>
    );
  }

  // Connected state - show user profile dropdown
  if (isConnected && user) {
    const getAuthMethodBadge = () => {
      switch (user.authMethod) {
        case 'google':
          return <Badge variant="secondary" className="text-xs">Google</Badge>;
        case 'github':
          return <Badge variant="secondary" className="text-xs">GitHub</Badge>;
        case 'web3':
          return <Badge variant="secondary" className="text-xs">Wallet</Badge>;
        default:
          return <Badge variant="secondary" className="text-xs">Web3</Badge>;
      }
    };

    const getInitials = (name?: string) => {
      if (!name) return user.address.slice(2, 4).toUpperCase();
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    };

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2 min-w-[140px] justify-start">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.profileImage} alt={user.name || "User"} />
              <AvatarFallback className="text-xs">
                {getInitials(user.name)}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col items-start min-w-0">
              <span className="text-sm font-medium truncate max-w-[80px]">
                {user.name || `${user.address.slice(0, 6)}...${user.address.slice(-4)}`}
              </span>
              {getAuthMethodBadge()}
            </div>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Account Details</DropdownMenuLabel>
          <DropdownMenuItem className="flex flex-col items-start p-4">
            <div className="flex items-center gap-2 w-full">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.profileImage} alt={user.name || "User"} />
                <AvatarFallback>
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="font-medium text-sm">
                  {user.name || "Anonymous User"}
                </span>
                {user.email && (
                  <span className="text-xs text-muted-foreground truncate">
                    {user.email}
                  </span>
                )}
                <span className="text-xs text-muted-foreground font-mono">
                  {user.address.slice(0, 6)}...{user.address.slice(-4)}
                </span>
              </div>
            </div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={disconnect}
            className="text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Not connected state - show login options
  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="flex items-center gap-2">
            <User className="h-4 w-4" />
            Connect
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>Choose Login Method</DropdownMenuLabel>
          <DropdownMenuItem onClick={connectGoogle} className="cursor-pointer">
            <Chrome className="h-4 w-4 mr-2" />
            Continue with Google
          </DropdownMenuItem>
          <DropdownMenuItem onClick={connectGitHub} className="cursor-pointer">
            <Github className="h-4 w-4 mr-2" />
            Continue with GitHub
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={connectWallet} className="cursor-pointer">
            <Wallet className="h-4 w-4 mr-2" />
            Connect Wallet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};

// Simple version for mobile or compact layouts
export const AuthButtonCompact: React.FC = () => {
  const { user, isConnected, isLoading, connectWallet, disconnect } = useWeb3();

  if (isLoading) {
    return (
      <Button size="sm" disabled variant="outline">
        <Loader2 className="h-4 w-4 animate-spin" />
      </Button>
    );
  }

  if (isConnected && user) {
    return (
      <Button onClick={disconnect} size="sm" variant="outline">
        <LogOut className="h-4 w-4" />
      </Button>
    );
  }

  return (
    <Button onClick={connectWallet} size="sm" variant="outline">
      <Wallet className="h-4 w-4" />
    </Button>
  );
};

export default AuthButton;
