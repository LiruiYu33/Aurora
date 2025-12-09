# Aurora - AI-Powered Browser Application

## Overview

Aurora is an innovative React Native-based browser application designed to seamlessly integrate artificial intelligence capabilities with web browsing. The application enables users to summarize web pages, engage in AI-powered conversations, and manage bookmarks with intelligent assistance.

**Developer**: Lirui Yu  
**Current Status**: Active Development (Prototype Stage)

## Features

### 🌐 Web Browsing
- Full-featured in-app browser with web page rendering
- Bookmark management system for saving favorite pages
- Page summarization powered by AI models
- Dynamic theme support (light/dark mode)

### 🤖 AI Integration
Supports multiple AI providers:
- **SiliconFlow (硅基流动)**: High-performance Chinese LLM API
- **RAGFlow**: Knowledge base Q&A engine with intelligent endpoint discovery

### 💬 Conversation Capabilities
- Interactive chat interface with AI models
- Page context-aware conversations
- Multi-turn dialogue support
- Persistent conversation history

### 🎨 User Experience
- Haptic feedback on interactions
- Parallax scrolling effects
- Responsive UI components
- Local storage for user preferences and API configurations

## Project Structure

```
Aurora/
├── app/                          # React Native app screens
│   ├── (tabs)/                   # Tab-based navigation
│   │   ├── index.tsx             # Main browser & chat interface
│   │   ├── explore.tsx           # Exploration screen
│   │   └── _layout.tsx           # Tab layout configuration
│   ├── _layout.tsx               # Root layout
│   ├── modal.tsx                 # Modal screen
│   └── settings.tsx              # Settings screen
├── components/                   # Reusable UI components
│   ├── ui/                       # Base UI components
│   ├── parallax-scroll-view.tsx  # Custom scroll view
│   ├── themed-text.tsx           # Theme-aware text
│   └── ...
├── hooks/                        # Custom React hooks
│   ├── use-color-scheme.ts       # Color scheme detection
│   └── use-theme-color.ts        # Theme management
├── contexts/                     # React context providers
│   └── browser-settings.tsx      # Browser settings context
├── constants/                    # Application constants
├── assets/                       # Static assets and resources
├── ios/                          # iOS native code
├── android/                      # Android native code
└── package.json                  # Project dependencies

## Getting Started

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn package manager
- Expo CLI
- iOS Xcode development environment (for iOS builds)
- Android Studio (for Android builds)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/LiruiYu33/Aurora.git
   cd Aurora
   ```

2. **Install dependencies**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Install Expo CLI globally** (if not already installed)
   ```bash
   npm install -g expo-cli
   ```

4. **Start the development server**
   ```bash
   npm start
   # or
   expo start
   ```

## Configuration

### API Keys Setup

The application requires API keys for AI providers. Configure them in the app's settings panel:

1. **SiliconFlow API Key**
   - Sign up at [https://www.siliconflow.cn/](https://www.siliconflow.cn/)
   - Generate an API key from your dashboard
   - Save it in the app settings (stored locally via AsyncStorage)

2. **RAGFlow Configuration**
   - Configure RAGFlow base URL (e.g., `http://127.0.0.1/`)
   - Provide RAGFlow API key
   - The app automatically discovers Chat IDs or Agent IDs

### Backend Server

The backend Java server runs on `http://localhost:8080` and provides:
- `/chat` endpoint for AI conversations
- `/summarise` endpoint for page summarization

The backend code is maintained in a separate private repository: [AuroraBackend](https://github.com/LiruiYu33/AuroraBackend)

**Running the backend locally:**
```bash
cd /path/to/AuroraBackend
./run_server.sh
```

## Technology Stack

### Frontend
- **Framework**: React Native with Expo
- **Language**: TypeScript
- **State Management**: React Hooks + AsyncStorage
- **Styling**: Themed components with dynamic colors
- **HTTP Client**: Fetch API

### Backend
- **Language**: Java
- **HTTP Server**: com.sun.net.httpserver.HttpServer
- **JSON Parsing**: org.json library
- **Port**: 8080

### AI APIs
- **SiliconFlow**: OpenAI-compatible REST API
- **RAGFlow**: Knowledge base with OpenAI-compatible endpoints

## Development

### Available Scripts

- `npm start` - Start development server with Expo
- `npm run build` - Build the application
- `npm run web` - Run web version
- `npm run android` - Build Android app
- `npm run ios` - Build iOS app

### Code Style

The project uses ESLint for code linting. Configuration is defined in `eslint.config.js`.

Run linting:
```bash
npm run lint
```

### Project Configuration

- **TypeScript**: `tsconfig.json` - TypeScript compiler options
- **Expo**: `app.json` - Expo project configuration
- **EAS**: `eas.json` - Expo Application Services configuration

## Features in Detail

### Page Summarization
Users can summarize any web page using their selected AI provider. The browser extracts page content and sends it to the configured AI service for intelligent summarization.

### Intelligent Chat
- Context-aware conversations about the current page
- Support for multiple AI providers
- Automatic model selection
- Conversation history management

### Bookmark Management
- Save pages for later reference
- Quick access to bookmarked content
- Integration with summarization and chat features

### RAGFlow Integration
Advanced knowledge base integration featuring:
- Automatic Chat ID and Agent ID discovery
- Intelligent endpoint selection
- Fallback mechanisms for reliability
- Support for custom RAGFlow deployments

## Architecture

### Data Flow
```
User Input
    ↓
React Native UI
    ↓
HTTP Request (localhost:8080)
    ↓
Java Backend Server
    ↓
AI Provider API (SiliconFlow or RAGFlow)
    ↓
Response Processing
    ↓
Display in UI
```

### State Management
- **Local State**: React hooks for UI state
- **Persistent State**: AsyncStorage for API keys, preferences, and configuration
- **Context**: BrowserSettings context for app-wide settings

## Storage Keys

The application persists the following data locally:

| Key | Purpose |
|-----|---------|
| `browser.siliconflow.apikey.v1` | SiliconFlow API key |
| `browser.siliconflow.model.v1` | Selected SiliconFlow model |
| `browser.ragflow.apikey.v1` | RAGFlow API key |
| `browser.ragflow.baseurl.v1` | RAGFlow base URL |
| `browser.ai.provider.v1` | Selected AI provider |

## Troubleshooting

### Backend Connection Issues
If the app cannot connect to the backend:
1. Ensure Java server is running on port 8080
2. Check that your device/emulator can reach localhost:8080
3. Verify backend logs for errors

### API Key Issues
- Verify API keys are correctly entered in settings
- Check API provider status and quotas
- Ensure backend has network access to external APIs

### RAGFlow 404 Errors
The app automatically discovers RAGFlow endpoints:
- Attempts to find Chat ID from `/api/v1/chats`
- Falls back to Agent ID from `/api/v1/agents`
- Uses default `/api/v1/chat/completions` as final fallback

## Contributing

Contributions are welcome! To contribute:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is currently under development. License details to be determined.

## Contact & Support

**Developer**: Lirui Yu  
**Repository**: [https://github.com/LiruiYu33/Aurora](https://github.com/LiruiYu33/Aurora)  
**Backend Repository**: [https://github.com/LiruiYu33/AuroraBackend](https://github.com/LiruiYu33/AuroraBackend)

For issues, questions, or suggestions, please open an issue on the GitHub repository.

## Acknowledgments

- Built with [React Native](https://reactnative.dev/) and [Expo](https://expo.dev/)
- AI powered by SiliconFlow and RAGFlow
- UI components styled with custom themes