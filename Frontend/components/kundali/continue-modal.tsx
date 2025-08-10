"use client";

import { Wallet, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogOverlay,
  DialogPortal,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { useWeb3AuthConnect, useWeb3Auth } from "@web3auth/modal/react";
import { useAccount } from "wagmi";

interface ContinueModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onContinue: (method: 'wallet' | 'guest') => void;
}

export function ContinueModal({ open, onOpenChange, onContinue }: ContinueModalProps) {
  const [keepSignedIn, setKeepSignedIn] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  
  const { connect } = useWeb3AuthConnect();
  const { isConnected: web3AuthConnected } = useWeb3Auth();
  const { address, isConnected } = useAccount();

  const handleWalletConnect = async () => {
    try {
      setIsConnecting(true);
      
      // Close the popup first
      onOpenChange(false);
      
      // If already connected, proceed with the flow
      if (isConnected || web3AuthConnected) {
        onContinue('wallet');
        return;
      }
      
      // Otherwise, initiate wallet connection (this will open the Web3Auth modal)
      await connect();
      
      // After successful connection, proceed with the flow
      onContinue('wallet');
    } catch (error) {
      console.error("Wallet connection failed:", error);
      // You might want to show an error toast here
    } finally {
      setIsConnecting(false);
    }
  };

  const handleGuestContinue = () => {
    onContinue('guest');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        {/* Custom overlay with higher z-index */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-[100] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        
        {/* Custom content with higher z-index and better styling */}
        <DialogPrimitive.Content className={cn(
          'fixed left-[50%] top-[50%] z-[100] grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg'
        )}>
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
          
          <DialogHeader className="text-center space-y-4">
            <DialogTitle className="text-xl font-semibold text-slate-900 dark:text-white text-center">
              How would you like to continue?
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* Connect Wallet Button */}
            <Button
              onClick={handleWalletConnect}
              disabled={isConnecting}
              className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 h-auto text-base font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wallet className="mr-2 h-5 w-5" />
              {isConnecting ? "Connecting..." : (isConnected || web3AuthConnected) ? "Connected - Continue" : "Connect Wallet"}
            </Button>

            {/* Show connected wallet address if connected */}
            {(isConnected || web3AuthConnected) && address && (
              <div className="text-center text-sm text-slate-600 dark:text-slate-400">
                Connected: {address.slice(0, 6)}...{address.slice(-4)}
              </div>
            )}

            {/* Keep me signed in checkbox */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="keep-signed-in"
                  checked={keepSignedIn}
                  onCheckedChange={(checked) => setKeepSignedIn(checked as boolean)}
                  className="data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                />
                <label
                  htmlFor="keep-signed-in"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-slate-700 dark:text-slate-300"
                >
                  Keep me signed in?
                </label>
              </div>
              <button className="text-orange-500 hover:text-orange-600 text-sm font-medium">
                Forgot Password?
              </button>
            </div>

            {/* Divider */}
            <div className="flex items-center justify-center">
              <span className="text-sm text-muted-foreground italic">or</span>
            </div>

            {/* Continue as Guest */}
            <div className="text-center">
              <button
                onClick={handleGuestContinue}
                className="text-orange-500 hover:text-orange-600 font-medium text-base underline"
              >
                Continue as a Guest
              </button>
            </div>

            {/* Terms and Conditions */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
              <h4 className="text-sm font-semibold text-slate-900 dark:text-white">
                Terms and Conditions:
              </h4>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p className="mb-2">By continuing, you agree to:</p>
                <ul className="space-y-1 ml-4">
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>You have read and accepted our <span className="text-orange-500 underline cursor-pointer">Terms & Conditions</span> and <span className="text-orange-500 underline cursor-pointer">Privacy Policy</span>.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>All astrology insights are for entertainment and not professional guidance.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>The app does not provide medical, legal, or financial advice of any kind.</span>
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>Your data may be used to improve predictions and personalize your experience.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPortal>
    </Dialog>
  );
}
