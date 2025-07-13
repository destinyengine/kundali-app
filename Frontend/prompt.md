Add Web3 Authentication with Database Integration
I want to implement Web3 authentication in my Kundali app with the following requirements:

Current Setup:
Next.js 13.5.1 frontend in Frontend directory
Existing auth routes in components/layout/Navbar.tsx
Backend in Backend directory
Current tsconfig.json with path aliases
Requirements:
Web3 Authentication Provider Integration:

Support for MetaMask, WalletConnect, and other popular wallets
Social login fallback (Google, Twitter, Email)
Seamless user onboarding for both crypto and non-crypto users
Database Schema Design:

User table with Web3 wallet addresses
Link multiple wallets to single user account
Store user preferences and kundali data
Session management for authenticated users
Frontend Components:

Web3 connect button component
User profile management
Wallet connection status indicator
Integration with existing Navbar
Backend Integration:

Authentication middleware
Wallet signature verification
User session management
API endpoints for user data
Security Features:

Signature-based authentication
Nonce generation for secure login
Session token management
Protected routes
Database Tables Needed:

Technology Preferences:

Web3Auth or similar for provider abstraction
Prisma or similar ORM for database
PostgreSQL or MongoDB for data storage
JWT tokens for session management
Integration Points:

Update existing auth buttons in Navbar
Create new contexts in contexts/ directory
Add hooks in hooks/ directory
Maintain existing UI components structure
Please provide:

Complete code implementation
Database migration scripts
Environment variable setup
Security best practices
Error handling strategies
User flow documentation
The solution should work seamlessly with the existing codebase and maintain the current UI/UX design patterns shown in components/home/features-section.tsx and other components.