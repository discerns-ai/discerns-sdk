# @discerns/sdk

A TypeScript SDK for embedding and interacting with Discerns AI chatbots on your website. This SDK provides seamless two-way communication between your website and the embedded chatbot, allowing you to register custom tools, provide context, and listen for events.

## Table of Contents

- [Installation](#installation)
- [Plain JavaScript/TypeScript](#plain-javascripttypescript)
  - [Quick Start](#quick-start)
  - [API Reference](#api-reference)
    - [createDiscernsEmbed](#creatediscernsembedoptions)
    - [connectToDiscernsChatbot](#connecttodiscernschatbotiframe-options)
    - [WebsiteProtocol Methods](#websiteprotocol-methods)
    - [tool Helper](#tooldefinition)
- [React](#react)
  - [Quick Start](#quick-start-1)
  - [DiscernsChatbot Component](#discernschatbot-)
- [Types](#types)
- [Peer Dependencies](#peer-dependencies)
- [License](#license)

## Installation

```bash
npm install @discerns/sdk zod
# or
yarn add @discerns/sdk zod
# or
pnpm add @discerns/sdk zod
```

---

## Plain JavaScript/TypeScript

### Quick Start

```typescript
import { createDiscernsEmbed, tool } from '@discerns/sdk';
import { z } from 'zod';

// Create and embed the chatbot
const protocol = await createDiscernsEmbed({
  target: document.getElementById('chatbot-container')!,
  avatarId: 123,
  avatarInstanceId: 6, // optional
});

const users = {
    '123': { name: 'John Doe', email: 'john@example.com' },
    '456': { name: 'Jane Smith', email: 'jane@example.com' },
}

// Register a custom tool that the chatbot can call
await protocol.registerTool(
  tool({
    name: 'get_user',
    description: 'Fetches user information by ID',
    schema: z.object({
      userId: z.string().describe('The ID of the user to fetch'),
    }),
    execute: async ({ userId }) => {
      // Your logic here
      return users[userId]
    },
  })
);
```

### API Reference

### `createDiscernsEmbed(options)`

Creates an embedded chatbot iframe and establishes a connection.

#### Options

| Property           | Type          | Required | Default                  | Description                          |
| ------------------ |---------------| -------- | ------------------------ | ------------------------------------ |
| `target`           | `HTMLElement` | Yes      | -                        | The container element for the iframe |
| `avatarId`         | `number`      | Yes      | -                        | The ID of the avatar to embed        |
| `avatarInstanceId` | `number`      | No       | `null`                   | Optional avatar instance ID          |
| `baseUrl`          | `string`      | No       | `https://app.discerns.ai` | Base URL for the Discerns app        |

#### Returns

`Promise<WebsiteProtocol>` - A protocol object with methods for interacting with the chatbot.

---

### `connectToDiscernsChatbot(iframe, options?)`

Connects to an existing chatbot iframe. Use this if you've created the iframe yourself.

```typescript
import { connectToDiscernsChatbot } from '@discerns/sdk';

const iframe = document.querySelector('iframe')!;
const protocol = await connectToDiscernsChatbot(iframe, {
  targetOrigin: '*', // default
  askTimeout: 30000, // default, in ms
});
```

---

### WebsiteProtocol Methods

#### `registerTool(tool)`

Registers a custom tool that the chatbot can invoke during conversations.

```typescript
await protocol.registerTool({
  name: 'search_products',
  description: 'Search for products in the catalog',
  schema: z.object({
    query: z.string(),
    category: z.string().optional(),
    maxResults: z.number().default(10),
  }),
  execute: async (args) => {
    const results = await searchProducts(args);
    return results;
  },
});
```

#### `unregisterTool(name)`

Removes a previously registered tool.

```typescript
await protocol.unregisterTool('search_products');
```

#### `addToContext(keyName, context)`

Adds contextual information that the chatbot should consider.

```typescript
protocol.addToContext('user_preferences', {
  name: 'user_preferences',
  value: JSON.stringify({ theme: 'dark', language: 'en' }),
  description: 'Current user preferences and settings',
});
```

#### `removeFromContext(keyName)`

Removes context from the chatbot.

```typescript
protocol.removeFromContext('user_preferences');
```

#### `setAvatarContext(context)`

Sets or clears the avatar-specific context.

```typescript
protocol.setAvatarContext('The user is currently on the pricing page.');
// Or clear it
protocol.setAvatarContext(null);
```

#### `onNewConversation(callback)`

Listens for when a new conversation is started.

```typescript
const unsubscribe = protocol.onNewConversation((conversationId) => {
  console.log('New conversation started:', conversationId);
});

// Later, to stop listening:
unsubscribe();
```

#### `onConnectionStatus(callback)`

Listens for connection status changes.

```typescript
const unsubscribe = protocol.onConnectionStatus((connected) => {
  console.log('Chatbot connected:', connected);
});
```

#### `dispose()`

Cleans up all resources and event listeners. Call this when removing the chatbot.

```typescript
protocol.dispose();
```

---

### `tool(definition)`

A helper function for defining tools with proper TypeScript inference.

```typescript
import { tool } from '@discerns/sdk';
import { z } from 'zod';

const myTool = tool({
  name: 'calculate',
  description: 'Performs a calculation',
  schema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: ({ operation, a, b }) => {
    switch (operation) {
      case 'add':
        return a + b;
      case 'subtract':
        return a - b;
      case 'multiply':
        return a * b;
      case 'divide':
        return a / b;
    }
  },
});
```

---

## React

### Quick Start

```tsx
import { DiscernsChatbot } from '@discerns/sdk/react';
import { useMemo } from 'react';
import { z } from 'zod';
import { tool } from '@discerns/sdk';

function App() {
  // Important: memoize tools to prevent unnecessary re-registrations
  const tools = useMemo(
    () => [
      tool({
        name: 'get_weather',
        description: 'Gets the current weather for a location',
        schema: z.object({
          city: z.string(),
        }),
        execute: async ({ city }) => {
          return { temperature: 22, condition: 'sunny', city };
        },
      }),
    ],
    []
  );

  return (
    <DiscernsChatbot
      avatarId={123}
      avatarInstanceId={456}
      memoizedTools={tools}
      style={{ width: '400px', height: '600px' }}
    />
  );
}
```

### `<DiscernsChatbot />`

A React component that handles embedding and lifecycle management.

#### Props

| Prop                        | Type                                   | Required | Default                   | Description                                              |
| --------------------------- | -------------------------------------- | -------- |---------------------------| -------------------------------------------------------- |
| `avatarId`                  | `number`                               | Yes      | -                         | The ID of the avatar to embed                            |
| `avatarInstanceId`          | `number \| null`                       | Yes      | -                         | Avatar instance ID                                       |
| `baseUrl`                   | `string`                               | No       | `https://app.discerns.ai` | Base URL for the Discerns app                            |
| `memoizedTools`             | `RegisteredTool[]`                     | No       | -                         | Tools to register (must be memoized)                     |
| `avatarContext`             | `string`                               | No       | -                         | Avatar-specific context string                           |
| `memoizedEnvironmentContext`| `Record<string, EnvironmentContext>`   | No       | -                         | Environment context key-value pairs (must be memoized)   |
| `onConnectionStatusChange`  | `(connected: boolean) => void`         | No       | -                         | Callback when connection status changes                  |
| `onNewConversation`         | `(conversationId: string) => void`     | No       | -                         | Callback when a new conversation starts                  |
| `style`                     | `CSSProperties`                        | No       | -                         | Inline styles for the iframe                             |
| `className`                 | `string`                               | No       | -                         | CSS class name for the iframe                            |

> **Important:** The `memoizedTools` and `memoizedEnvironmentContext` props must be memoized using `useMemo` to prevent unnecessary re-registrations on every render.

#### Full Example with Context and Events

```tsx
import { DiscernsChatbot } from '@discerns/sdk/react';
import { useMemo, useState } from 'react';
import { z } from 'zod';
import { tool } from '@discerns/sdk';
import type { EnvironmentContext } from '@discerns/sdk';

function App() {
  const [isConnected, setIsConnected] = useState(false);

  const tools = useMemo(
    () => [
      tool({
        name: 'get_weather',
        description: 'Gets the current weather for a location',
        schema: z.object({
          city: z.string(),
        }),
        execute: async ({ city }) => {
          return { temperature: 22, condition: 'sunny', city };
        },
      }),
    ],
    []
  );

  // Provide environment context to the chatbot
  const environmentContext = useMemo<Record<string, EnvironmentContext>>(
    () => ({
      user_preferences: {
        name: 'user_preferences',
        value: JSON.stringify({ theme: 'dark', language: 'en' }),
        description: 'Current user preferences and settings',
      },
      current_page: {
        name: 'current_page',
        value: '/pricing',
        description: 'The page the user is currently viewing',
      },
    }),
    []
  );

  return (
    <div>
      <p>Connection status: {isConnected ? 'Connected' : 'Disconnected'}</p>
      <DiscernsChatbot
        avatarId={123}
        avatarInstanceId={456}
        memoizedTools={tools}
        avatarContext="The user is a premium subscriber interested in enterprise features."
        memoizedEnvironmentContext={environmentContext}
        theme="dark"
        accent="#6366f1"
        onConnectionStatusChange={setIsConnected}
        onNewConversation={(conversationId) => {
          console.log('New conversation started:', conversationId);
        }}
        style={{ width: '400px', height: '600px' }}
      />
    </div>
  );
}
```

---

## Types

### `RegisteredTool<T>`

```typescript
type RegisteredTool<T extends z.ZodType> = {
  name: string;
  description: string;
  schema: T;
  execute: (args: z.infer<T>) => Promise<unknown> | unknown;
};
```

### `EnvironmentContext`

```typescript
type EnvironmentContext = {
  name: string;
  value: string;
  description: string;
};
```

### `WebsiteProtocol`

The return type of `connectToDiscernsChatbot` and `createDiscernsEmbed`.

---

## Peer Dependencies

This SDK requires `zod` version 4 or higher as a peer dependency for schema validation:

```bash
npm install zod@^4.0.0
```

---

## License

MIT

