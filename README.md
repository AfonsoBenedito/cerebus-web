<p align="center">
  <img src="public/logo.svg" alt="Cerebus Logo" width="120" />
</p>

<h1 align="center">Cerebus</h1>

<p align="center">
  <strong>Run LLMs locally in your browser. Chat peer-to-peer. No servers required.</strong>
</p>

<p align="center">
  <a href="https://afonsobenedito.github.io/cerebus-web/">
    <img src="https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-7c7cff?style=for-the-badge" alt="Live Demo" />
  </a>
  <img src="https://img.shields.io/github/actions/workflow/status/AfonsoBenedito/cerebus-web/deploy.yml?style=for-the-badge&label=Deploy" alt="Deploy Status" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="License" />
</p>

---

## What is Cerebus?

Cerebus is a web application that combines **local LLM inference** with **peer-to-peer communication** — entirely in the browser, with zero backend infrastructure.

- **Local LLM**: Load and run language models directly in your browser using [WebLLM](https://github.com/mlc-ai/web-llm) and WebGPU. Your data never leaves your device.
- **P2P Chat**: Connect directly with other users via [PeerJS](https://peerjs.com/) (WebRTC). Messages flow peer-to-peer after the initial handshake.
- **Agent Mode**: Use `/agent <prompt>` in the P2P chat to send a question to your peer's local LLM and get a response — no cloud APIs involved.

## Features

| Feature | Description |
|---|---|
| **12+ Models** | Choose from SmolLM2, Llama 3.2, Gemma 2, Phi 3.5, DeepSeek R1, Qwen 2.5, and more |
| **Streaming Responses** | See LLM output as it's generated, token by token |
| **Username-based P2P** | Pick a username, share it, and connect — no random IDs |
| **Agent Delegation** | `/agent` sends prompts to a peer's local model |
| **Pending Request Flow** | If a peer's model isn't loaded, they get prompted to load one |
| **Thinking Indicators** | Visual feedback while models are generating or peers are loading |
| **Cross-Network** | Works across different networks via WebRTC + STUN |
| **Zero Backend** | Everything runs client-side. No servers to deploy or maintain |

## Getting Started

### Prerequisites

- **Node.js** >= 20.19 (recommended: 22+)
- **Chrome** or **Edge** (WebGPU support required)

### Installation

```bash
git clone https://github.com/AfonsoBenedito/cerebus-web.git
cd cerebus-web
npm install
```

### Development

```bash
make local-up     # Start dev server on localhost:5175
make local-down   # Stop the dev server
make build        # Production build
make run-tests    # Run test suite (placeholder)
make lint         # Run ESLint
```

Or directly with npm:

```bash
npm run dev       # Start dev server
npm run build     # Production build
npm run lint      # Lint
```

## Architecture

```
src/
├── components/
│   ├── Layout/              # App shell components
│   │   ├── Header           # App title and subtitle
│   │   ├── TabBar            # LLM / P2P tab navigation
│   │   └── ChatInput         # Shared message input area
│   ├── LLMChat/              # Local LLM chat panel
│   │   └── LLMChat           # Model controls + chat messages
│   ├── PeerChat/             # P2P chat panel
│   │   ├── PeerChat          # Connection UI + message list
│   │   └── PendingBanner     # Agent request pending notification
│   └── common/               # Reusable UI primitives
│       ├── MessageBubble     # Chat message bubble
│       ├── ModelSelector     # Model dropdown
│       └── ProgressBar       # Loading progress bar
├── hooks/
│   ├── useWebLLM.ts          # WebLLM engine management
│   └── usePeer.ts            # PeerJS connection management
├── App.tsx                   # Root orchestrator
├── App.css                   # Global styles
└── main.tsx                  # Entry point
```

## How It Works

### Local LLM

Models are loaded and run entirely in the browser via [WebLLM](https://github.com/mlc-ai/web-llm), which compiles models to WebGPU. The first load downloads model weights (cached for subsequent uses). All inference happens on your device's GPU.

### P2P Communication

[PeerJS](https://peerjs.com/) wraps WebRTC for simple peer-to-peer data channels. A public signaling server handles the initial handshake (exchanging connection metadata), then all data flows directly between browsers. STUN servers help with NAT traversal across networks.

### Agent Mode

When you type `/agent <prompt>` in the P2P chat:

1. The prompt is sent to the connected peer as an `llm-request`
2. If the peer has a model loaded, it processes the request and sends back an `llm-response`
3. If not, the peer is prompted to load a model, and you see a "choosing a model..." indicator

## Tech Stack

- [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) — build tooling
- [WebLLM](https://github.com/mlc-ai/web-llm) — local LLM inference via WebGPU
- [PeerJS](https://peerjs.com/) — WebRTC peer-to-peer connections

## Browser Support

| Browser | WebGPU | WebRTC | Status |
|---|---|---|---|
| Chrome 113+ | Yes | Yes | Fully supported |
| Edge 113+ | Yes | Yes | Fully supported |
| Firefox | Limited | Yes | LLM may not work |
| Safari | Limited | Yes | LLM may not work |
| Chrome Android | Yes | Yes | Small models only |
| iOS Safari | No | Yes | LLM not supported |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Commit your changes using [conventional commits](https://www.conventionalcommits.org/)
4. Open a Pull Request — CI checks must pass before merging

## License

MIT
