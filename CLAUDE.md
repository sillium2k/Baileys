# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

### Building
- `npm run build` - Compile TypeScript to JavaScript output in `lib/`
- `npm run build:all` - Build library and generate documentation
- `npm run build:docs` - Generate Typedocs documentation only

### Testing
- `npm test` - Run Jest tests (uses `--experimental-vm-modules` flag)
- Tests are located in `src/**/*.test.ts`

### Linting & Formatting
- `npm run lint` - Type check with TypeScript and run ESLint
- `npm run lint:fix` - Format with Prettier and run ESLint with --fix
- `npm run format` - Format code with Prettier

### Examples
- `npm run example` - Run the main example script at `Example/example.ts`
- `npm run dev` - Alias for running the example (uses tsx)
- `npm start` - Run compiled example from `lib/Example/example.js`

### Protocol Buffers
- `npm run gen:protobuf` - Regenerate protobuf statics from WAProto definitions

## Architecture Overview

### Core Structure
- **Socket Layer** (`src/Socket/`): Main WebSocket implementation for WhatsApp Web protocol
  - `socket.ts`: Core socket connection handling and authentication
  - `messages-send.ts` & `messages-recv.ts`: Message handling
  - `groups.ts`, `chats.ts`: Group and chat management
  - `business.ts`: WhatsApp Business features
  - `communities.ts`, `newsletter.ts`: Community and newsletter features
  - `Client/websocket.ts`: Low-level WebSocket client implementation

- **Signal Protocol** (`src/Signal/`): End-to-end encryption implementation
  - `Group/`: Group chat encryption using Signal Protocol
  - `libsignal.ts`: Core Signal Protocol integration

- **Binary Protocol** (`src/WABinary/`): WhatsApp's binary protocol encoding/decoding
  - `encode.ts` & `decode.ts`: Binary message serialization
  - `jid-utils.ts`: WhatsApp ID utilities
  - `constants.ts`: Protocol constants and dictionaries

- **Types** (`src/Types/`): TypeScript type definitions for all WhatsApp entities
  - `Message.ts`, `Chat.ts`, `Contact.ts`, `Auth.ts`, `Socket.ts`, etc.
  - `Events.ts`: Event type definitions for the event emitter

- **Utils** (`src/Utils/`): Utility functions and helpers
  - `auth-utils.ts`: Authentication state management
  - `messages.ts` & `messages-media.ts`: Message processing
  - `use-multi-file-auth-state.ts`: File-based auth persistence
  - `event-buffer.ts`: Event buffering and emission
  - `process-message.ts`: Message decryption and processing
  - `noise-handler.ts`: Noise protocol encryption handler
  - `validate-connection.ts`: Connection validation and noise handshake

- **WAProto** (Generated): Protocol buffer definitions generated from `.proto` files

### Socket Layer Composition
The socket is built through a layered composition pattern where each layer adds functionality:
1. `makeSocket()` - Base WebSocket connection, authentication, noise protocol
2. Extends with `messages-send.ts` & `messages-recv.ts` - Message handling
3. Extends with `chats.ts` - Chat operations
4. Extends with `groups.ts` - Group management
5. Extends with `business.ts` - Business features
6. Extends with `communities.ts` - Community features (final layer)
7. `makeWASocket()` in `src/Socket/index.ts` - Entry point that ties it all together

### Key Concepts
- **WASocket**: Main class returned by `makeWASocket()` - the primary interface for all operations
- **Auth State**: Session management using Signal Protocol keys, stored via `useMultiFileAuthState` or custom implementation
- **JID (Jabber ID)**: WhatsApp identifiers with different formats:
  - Individual: `[country code][phone]@s.whatsapp.net` (e.g., `1234567890@s.whatsapp.net`)
  - Group: `[id]@g.us` (e.g., `123456789-123345@g.us`)
  - Broadcast: `[timestamp]@broadcast`
  - Status/Stories: `status@broadcast`
- **Binary Nodes**: WhatsApp's internal message format - hierarchical structure with tags, attributes, and content
- **Noise Protocol**: Used for initial handshake and encryption before session establishment
- **Event Buffer**: Aggregates and processes events before emission to prevent race conditions
- **USync**: User synchronization protocol for contacts/groups

### Protocol Integration
- Uses libsignal for E2E encryption (sessions, prekeys, identity keys)
- Implements WhatsApp's binary protocol over WebSockets (not JSON)
- Supports multi-device authentication via QR codes or pairing codes
- Mobile API is deprecated and no longer supported

## Development Notes

### TypeScript Configuration
- ESM modules with strict type checking enabled
- Output compiled to `lib/` directory
- Uses `tsc-esm-fix` for ESM compatibility
- Module resolution: bundler mode
- Requires `verbatimModuleSyntax` and `allowImportingTsExtensions`

### Dependencies
- **Core**: ws, protobufjs, libsignal, pino (logging), axios, qrcode
- **Optional peer deps**: jimp/sharp (image processing), link-preview-js, audio-decode
- **Development**: Jest, ESLint, TypeScript, Prettier, tsx (for running examples)
- Uses custom fork of libsignal: `git+https://github.com/whiskeysockets/libsignal-node`

### Testing
- Jest configuration uses ESM modules with `ts-jest` transformer
- Tests located alongside source files with `.test.ts` suffix
- Requires Node.js 20+ (specified in engines)
- Run with `--experimental-vm-modules` flag for ESM support

### Important Implementation Details
- Auth state management uses file-based mutexes to prevent race conditions
- Event buffering prevents events from being emitted before connection is fully established
- Media messages support streaming to avoid loading entire files into memory
- Store implementations should use proper databases (SQL/NoSQL) in production, not the in-memory store