"use client";

import { useWeb3Auth } from "@web3auth/modal/react";
import { useAccount, useBalance, useSignMessage, useSendTransaction } from "wagmi";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Copy } from "lucide-react";
import { toast } from "sonner";

export function Web3AuthDemo() {
  const [mounted, setMounted] = useState(false);
  const { isInitialized, isConnected } = useWeb3Auth();
  const { address, chainId } = useAccount();
  const { data: balance } = useBalance({ address });
  const { signMessage } = useSignMessage();
  const { sendTransaction } = useSendTransaction();
  
  const [message, setMessage] = useState("Hello Web3Auth!");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("0.001");

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Web3Auth</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleSignMessage = async () => {
    try {
      const signature = await signMessage({ message });
      toast.success("Message signed successfully!");
      console.log("Signature:", signature);
    } catch (error) {
      console.error("Error signing message:", error);
      toast.error("Failed to sign message");
    }
  };

  const handleSendTransaction = async () => {
    if (!toAddress) {
      toast.error("Please enter a recipient address");
      return;
    }
    
    try {
      const tx = await sendTransaction({
        to: toAddress as `0x${string}`,
        value: BigInt(Number(amount) * 1e18), // Convert to wei
      });
      toast.success("Transaction sent successfully!");
      console.log("Transaction:", tx);
    } catch (error) {
      console.error("Error sending transaction:", error);
      toast.error("Failed to send transaction");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard!");
  };

  if (!isInitialized) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Web3Auth</CardTitle>
          <CardDescription>Initializing...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Web3Auth</CardTitle>
          <CardDescription>Connect your wallet to get started</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Wallet Information</CardTitle>
          <CardDescription>Your connected wallet details</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Address:</Label>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(address || "")}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Chain ID:</Label>
            <span>{chainId}</span>
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Balance:</Label>
            <span>
              {balance?.formatted} {balance?.symbol}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sign Message</CardTitle>
          <CardDescription>Sign a custom message with your wallet</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Enter message to sign"
            />
          </div>
          <Button onClick={handleSignMessage} className="w-full">
            Sign Message
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Send Transaction</CardTitle>
          <CardDescription>Send ETH to another address</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="toAddress">Recipient Address</Label>
            <Input
              id="toAddress"
              value={toAddress}
              onChange={(e) => setToAddress(e.target.value)}
              placeholder="0x..."
            />
          </div>
          <div>
            <Label htmlFor="amount">Amount (ETH)</Label>
            <Input
              id="amount"
              type="number"
              step="0.001"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.001"
            />
          </div>
          <Button onClick={handleSendTransaction} className="w-full">
            Send Transaction
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
