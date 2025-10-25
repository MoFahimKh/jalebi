                  🎙️ User
                     │
                     ▼
        ┌───────────────────────────┐
        │ Voice Input / Command     │
        │ e.g., “Swap ETH to USDC”  │
        └───────────────────────────┘
                     │
                     ▼
        ┌───────────────────────────┐
        │ Speech-to-Text (Whisper)  │
        │ Converts voice → text     │
        └───────────────────────────┘
                     │
                     ▼
        ┌───────────────────────────┐
        │ AI Intent Parser (OpenAI) │
        │ Understands user’s intent │
        │ and extracts parameters   │
        └───────────────────────────┘
                     │
                     ▼
        ┌───────────────────────────┐
        │ Intent Executor (Agent)   │
        │ • Determines required     │
        │   on-chain actions        │
        │ • Handles routing logic   │
        │ • Prepares transactions   │
        └───────────────────────────┘
                     │
                     ▼
        ┌───────────────────────────┐
        │ Transaction Manager        │
        │ • Token approvals          │
        │ • Submit txs to blockchain │
        │ • Monitor confirmations    │
        └───────────────────────────┘
                     │
                     ▼
        ┌───────────────────────────┐
        │ Results & Summary Layer   │
        │ • Returns final outcome   │
        │ • Converts summary to     │
        │   speech (TTS)            │
        └───────────────────────────┘
                     │
                     ▼
                  🗣️ Voice Feedback to User
                     │
                     ▼
        ┌───────────────────────────┐
        │ **Future Scope: x402**     │
        │ • Fully autonomous agent  │
        │ • Portfolio management    │
        │ • Intent-driven execution │
        └───────────────────────────┘
