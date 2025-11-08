# Token Analytics System

## Overview
This diagram shows how the token analytics dashboard fetches real-time data from BaseScan API to display holder counts, transaction history, and volume metrics.

```mermaid
graph TD
    A[User Clicks View Analytics] --> B[TokenAnalyticsDashboard Opens]
    
    B --> C{Check Token Address}
    C -->|Zero Address| D[Show Pending Message]
    C -->|Valid Address| E[Fetch BaseScan Data]
    
    D --> D1[Display Transaction Link]
    D --> D2[Explain Address Pending]
    
    E --> E1[Query Token Transfers API]
    E1 --> E2[BaseScan API Request]
    E2 --> E3[https://api.basescan.org/api]
    
    E3 --> F[Process Response Data]
    
    F --> F1[Calculate Holder Count]
    F --> F2[Calculate Total Volume]
    F --> F3[Format Transaction List]
    
    F1 --> G[Display Stats Cards]
    F2 --> G
    F3 --> G
    
    G --> H[Render Dashboard]
    
    H --> H1[Holders Card]
    H --> H2[Volume Card]
    H --> H3[Transactions Card]
    H --> H4[Transaction History Tab]
    H --> H5[Token Info Tab]
    
    I[Auto Refresh Every 30s] --> E
    
    style E fill:#e3f2fd
    style F fill:#f3e5f5
    style G fill:#e8f5e9
    style H fill:#fff3e0
```

## Data Flow Sequence

```mermaid
sequenceDiagram
    participant U as User
    participant TM as TokenManagement
    participant TA as TokenAnalyticsDashboard
    participant API as BaseScan API
    participant UI as Dashboard UI
    
    U->>TM: Click "View Analytics"
    TM->>TA: Open dialog with token data
    
    Note over TA: Check if token_address is valid
    
    alt Token Address Pending (0x000...)
        TA->>UI: Show pending message
        TA->>UI: Display transaction link
        UI->>U: "Token address pending..."
    else Valid Token Address
        TA->>API: GET /api?module=account&action=tokentx
        Note over API: Fetch token transfers<br/>contractaddress=<token><br/>page=1&offset=100
        
        API-->>TA: Return transaction array
        
        Note over TA: Process Transactions
        TA->>TA: Extract unique holders (from/to)
        TA->>TA: Calculate total volume
        TA->>TA: Format transaction list
        
        TA->>UI: Render Stats Cards
        TA->>UI: Display Holder Count
        TA->>UI: Display Total Volume
        TA->>UI: Display Transaction Count
        
        TA->>UI: Render Tabs
        TA->>UI: Transaction History
        TA->>UI: Token Info
        
        UI->>U: Show complete analytics
        
        Note over TA: Auto-refresh every 30 seconds
        loop Every 30s
            TA->>API: Fetch latest data
            API-->>TA: Updated transactions
            TA->>UI: Update dashboard
        end
    end
```

## Analytics Dashboard Components

```mermaid
graph LR
    A[TokenAnalyticsDashboard] --> B[Stats Cards Row]
    A --> C[Detailed Tabs Section]
    
    B --> B1[Holders Card<br/>Users Icon]
    B --> B2[Volume Card<br/>TrendingUp Icon]
    B --> B3[Transactions Card<br/>ArrowUpRight Icon]
    
    C --> C1[Transactions Tab]
    C --> C2[Token Info Tab]
    
    C1 --> C1A[Transaction List]
    C1A --> C1B[Badge: Transfer]
    C1A --> C1C[Value in tokens]
    C1A --> C1D[From/To addresses]
    C1A --> C1E[Timestamp]
    C1A --> C1F[Link to BaseScan]
    
    C2 --> C2A[Token Address]
    C2 --> C2B[Network Badge]
    C2 --> C2C[Total Holders]
    C2 --> C2D[Total Transactions]
    C2 --> C2E[Note about API limits]
    
    style A fill:#e1f5ff
    style B fill:#fff3e0
    style C fill:#f3e5f5
```

## BaseScan API Integration

### Endpoints Used

1. **Token Transfers**
   ```
   GET https://api.basescan.org/api
   ?module=account
   &action=tokentx
   &contractaddress={TOKEN_ADDRESS}
   &page=1
   &offset=100
   &sort=desc
   ```

### Data Processing

1. **Holder Calculation**
   - Extract all unique addresses from `to` and `from` fields
   - Store in Set to ensure uniqueness
   - Return Set size as holder count

2. **Volume Calculation**
   - Sum all transaction `value` fields
   - Convert from wei (divide by 1e18)
   - Format to 2 decimal places

3. **Transaction History**
   - Display most recent 10 transactions
   - Format addresses (0x1234...5678)
   - Convert timestamps to readable dates
   - Link to BaseScan for details

## Integration Points

### TokenManagement Component

```mermaid
graph TD
    A[TokenManagement] --> B[Token List Display]
    B --> C[Each Token Card]
    
    C --> D[View Analytics Button]
    C --> E[View on BaseScan Button]
    
    D --> F[Opens Analytics Dialog]
    F --> G[TokenAnalyticsDashboard]
    
    G --> H[Real-time Data Display]
    
    style D fill:#e8f5e9
    style G fill:#e3f2fd
```

## Features Implemented

1. ✅ **Real-time Holder Count** - Calculated from unique addresses in transactions
2. ✅ **Transaction Volume** - Sum of all token transfers
3. ✅ **Transaction History** - List of recent transfers with details
4. ✅ **Auto-refresh** - Updates every 30 seconds
5. ✅ **Zero Address Handling** - Shows pending message for tokens being deployed
6. ✅ **BaseScan Integration** - Direct links to view on block explorer
7. ✅ **Responsive Design** - Works on mobile and desktop

## Future Enhancements

```mermaid
graph TD
    A[Current Analytics] --> B[Potential Additions]
    
    B --> C[Price Data from DEX]
    B --> D[The Graph Integration]
    B --> E[Holder Distribution Chart]
    B --> F[Trading Pairs Info]
    B --> G[Liquidity Metrics]
    
    C --> C1[Uniswap V3 API]
    C --> C2[Base DEX Aggregators]
    
    D --> D1[Custom Subgraph]
    D --> D2[Token Transfer Events]
    
    E --> E1[Top 10 Holders]
    E --> E2[Pie Chart Visualization]
    
    F --> F1[Available Pairs]
    F --> F2[Trading Volume by Pair]
    
    G --> G1[Total Liquidity]
    G --> G2[LP Token Count]
```

## API Rate Limits

- **Without API Key**: 1 call/5 seconds per IP
- **With Free API Key**: 5 calls/second
- **Implementation**: Auto-refresh set to 30 seconds to stay within limits

## Error Handling

1. **Zero Address**: Shows user-friendly pending message
2. **API Failures**: Falls back to "No data available"
3. **Empty Results**: Shows "No transactions found yet"
4. **Network Errors**: Query automatically retries with exponential backoff
