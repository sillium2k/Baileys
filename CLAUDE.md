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

## Architecture Overview

### Core Structure
- **Socket Layer** (`src/Socket/`): Main WebSocket implementation for WhatsApp Web protocol
  - `socket.ts`: Core socket connection handling
  - `messages-send.ts` & `messages-recv.ts`: Message handling
  - `groups.ts`, `chats.ts`: Group and chat management
  - `business.ts`: WhatsApp Business features

- **Signal Protocol** (`src/Signal/`): End-to-end encryption implementation
  - `Group/`: Group chat encryption using Signal Protocol
  - `libsignal.ts`: Core Signal Protocol integration

- **Binary Protocol** (`src/WABinary/`): WhatsApp's binary protocol encoding/decoding
  - `encode.ts` & `decode.ts`: Binary message serialization
  - `jid-utils.ts`: WhatsApp ID utilities

- **Types** (`src/Types/`): TypeScript type definitions for all WhatsApp entities
  - `Message.ts`, `Chat.ts`, `Contact.ts`, etc.

- **Utils** (`src/Utils/`): Utility functions and helpers
  - `auth-utils.ts`: Authentication state management
  - `messages.ts` & `messages-media.ts`: Message processing
  - `use-multi-file-auth-state.ts`: File-based auth persistence

### Key Concepts
- **WASocket**: Main class returned by `makeWASocket()` - the primary interface
- **Auth State**: Session management using Signal Protocol keys
- **JID**: WhatsApp identifiers (e.g., `1234567890@s.whatsapp.net`)
- **Binary Nodes**: WhatsApp's internal message format
- **USync**: User synchronization protocol for contacts/groups

### Protocol Integration
- Uses libsignal for E2E encryption
- Implements WhatsApp's binary protocol over WebSockets
- Supports multi-device authentication via QR codes or pairing codes

## Development Notes

### TypeScript Configuration
- ESM modules with strict type checking enabled
- Output compiled to `lib/` directory
- Uses `tsc-esm-fix` for ESM compatibility

### Dependencies
- **Core**: ws, protobufjs, libsignal, pino (logging)
- **Optional**: jimp/sharp (image processing), link-preview-js, audio-decode
- **Development**: Jest, ESLint, TypeScript, Prettier

### Testing
- Jest configuration uses ESM modules
- Tests located alongside source files with `.test.ts` suffix
- Requires Node.js 20+ (specified in engines)