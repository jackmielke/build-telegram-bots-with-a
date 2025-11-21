# Wallet Connection Flow

This diagram shows how users connect their crypto wallets (Metamask, Coinbase) and have that data stored in Supabase.

```mermaid
sequenceDiagram
    participant U as User
    participant UI as Profile Page
    participant WC as WalletConnectionDialog
    participant W as Wagmi/Wallet
    participant DB as Supabase Database
    
    Note over U,DB: User Initiates Wallet Connection
    U->>UI: Navigates to Profile Page
    UI->>U: Shows "Connect Wallet" button
    U->>WC: Clicks "Connect Wallet"
    WC->>U: Shows wallet options (Metamask, Coinbase)
    
    Note over U,DB: Wallet Selection & Authorization
    U->>WC: Selects wallet provider
    WC->>W: Triggers wallet connection
    W->>U: Opens wallet popup for authorization
    U->>W: Approves connection
    W-->>WC: Returns wallet address
    
    Note over U,DB: Save to Database
    WC->>DB: Get current auth user
    DB-->>WC: Returns auth_user_id
    WC->>DB: Find user record by auth_user_id
    DB-->>WC: Returns user profile ID
    WC->>DB: Update users table:<br/>- wallet_address<br/>- wallet_provider<br/>- wallet_connected_at
    DB-->>WC: Confirms update
    WC->>U: Shows success toast
    UI->>U: Updates UI to show connected state
    
    Note over U,DB: Disconnection Flow
    U->>WC: Clicks "Disconnect Wallet"
    WC->>DB: Clear wallet fields (set to null)
    DB-->>WC: Confirms update
    WC->>W: Disconnect from wallet
    WC->>U: Shows disconnection success
```

## Database Schema

### Users Table Updates
```sql
ALTER TABLE users 
ADD COLUMN wallet_address text,
ADD COLUMN wallet_provider text,
ADD COLUMN wallet_connected_at timestamp with time zone;

CREATE INDEX idx_users_wallet_address ON users(wallet_address);
```

### Fields
- `wallet_address` - User's connected crypto wallet address (e.g., 0x742d...)
- `wallet_provider` - Wallet provider name (metamask, coinbase, etc.)
- `wallet_connected_at` - Timestamp when wallet was first connected

## Supported Wallets

- **MetaMask** - Browser extension wallet
- **Coinbase Wallet** - Coinbase's official wallet

## Technical Stack

- **wagmi** - React Hooks for Ethereum
- **viem** - TypeScript interface for Ethereum
- **Base Chain** - Primary blockchain (Base Mainnet + Base Sepolia Testnet)

## Component Architecture

```mermaid
graph TB
    A[App.tsx] --> B[WagmiProvider]
    B --> C[Profile.tsx]
    C --> D[WalletConnectionDialog]
    D --> E[wagmi/useConnect Hook]
    D --> F[wagmi/useAccount Hook]
    D --> G[wagmi/useDisconnect Hook]
    E --> H[Supabase Update]
    G --> H
    
    style B fill:#e1f5fe
    style D fill:#c8e6c9
    style H fill:#fff3e0
```

## Next Steps for P2P Payments

With wallet connection in place, you can now:

1. **Custom Tool: `send_crypto`** - Allow bot to initiate USDC transfers
2. **Transaction History** - Create `crypto_transactions` table
3. **Balance Display** - Show USDC balance in user profile
4. **Payment Commands** - Bot understands "send $10 USDC to @alice"
5. **Gas Sponsorship** - Optional: Use paymaster for gasless transactions
