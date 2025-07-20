"use client";

import { Web3AuthDemo } from "@/components/web3/Web3AuthDemo";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Web3AuthDemoPage() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold">Web3Auth Integration</h1>
          <p className="text-xl text-muted-foreground">
            Experience seamless Web3 authentication and blockchain interactions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Features</CardTitle>
            <CardDescription>
              Web3Auth provides secure and user-friendly Web3 authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm">
              <li>✅ Social login with Google, Twitter, Discord, and more</li>
              <li>✅ Secure wallet creation and management</li>
              <li>✅ Support for multiple blockchains</li>
              <li>✅ Non-custodial key management</li>
              <li>✅ Seamless integration with existing dApps</li>
              <li>✅ Mobile-friendly authentication</li>
            </ul>
          </CardContent>
        </Card>

        <Web3AuthDemo />
        
        <Card>
          <CardHeader>
            <CardTitle>Integration Complete!</CardTitle>
            <CardDescription>
              Your kundali app now supports Web3 authentication
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Users can now connect their wallets to access personalized features,
              store their kundali data on-chain, or interact with Web3 features
              you might add in the future.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
