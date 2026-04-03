# Developer Mode Toggle

## Problem

The chat interface currently shows system-level messages that break the human-like
conversation feel:
- Pre-compaction memory flush directives
- System reminders (task tool nudges, context compression notices)
- Tool call results and embeddings (partially fixed but some still leak through)
- Agent orchestration messages ("use this agent", "delegate to X")
- JSON payloads from gateway events

Users want a clean, Telegram/iMessage-like experience by default — only seeing
human-written messages and agent responses.

## Solution

Add a **Developer Mode** toggle (off by default) that controls message visibility:

### Normal Mode (default)
- Show only `role: user` and `role: assistant` messages with clean text content
- Hide all `role: system` messages
- Hide messages matching system directive patterns (see filter list below)
- Hide tool call output, embeddings, JSON blobs
- Hide gateway event metadata
- Clean, human-like conversation UX

### Developer Mode
- Show all messages including system, tool, and metadata
- Show raw content without sanitization
- Show message role badges (user/assistant/system/tool)
- Show timestamps with more precision
- Show session key and run IDs in header
- Useful for debugging agent behavior

## Filter Patterns (Normal Mode)

Messages should be hidden when content matches any of these patterns:

```
- /^Pre-compaction memory flush/
- /IMPORTANT:.*address the user's message/
- /task tools haven't been used recently/
- /\bsystem-reminder\b/
- /You have exited plan mode/
- /You have entered plan mode/
- /After completing your current task/
- /Co-Authored-By:/
- /^\s*\{[\s\S]*"type"\s*:\s*"tool_/  (tool JSON blocks)
- /^\s*\[[\d.,\s\-]+\]\s*$/            (embedding arrays)
- Messages where stripped content is empty
```

## Implementation Plan

### 1. State & Persistence

File: `src/pages/Chat.tsx`

```ts
const [developerMode, setDeveloperMode] = useState(() => {
  return localStorage.getItem('remchat:developerMode') === '1';
});
```

Persist to `localStorage` so the setting survives page reloads.

### 2. Filter Function

New function in `Chat.tsx` (or extract to `src/lib/message-filters.ts`):

```ts
function isSystemDirective(text: string): boolean {
  const patterns = [
    /^Pre-compaction memory flush/,
    /IMPORTANT:.*address the user's message/,
    /task tools haven't been used recently/,
    /<system-reminder>/,
    /You have exited plan mode/,
    /You have entered plan mode/,
    /After completing your current task/,
    /Co-Authored-By:/,
  ];
  return patterns.some(p => p.test(text));
}
```

### 3. Apply Filter in Message Rendering

In the messages `.map()` render block, wrap with:

```tsx
messages
  .filter(msg => {
    if (developerMode) return true;
    if (msg.role === 'system') return false;
    if (isSystemDirective(msg.content)) return false;
    return true;
  })
  .map(msg => ...)
```

Also apply in `mapHistoryMessage()` so filtered messages never enter state.

### 4. Toggle UI

Add a toggle in the chat header (right panel), near the connection status badge:

```tsx
<button
  onClick={() => {
    const next = !developerMode;
    setDeveloperMode(next);
    localStorage.setItem('remchat:developerMode', next ? '1' : '0');
  }}
  className={`text-xs px-2 py-0.5 rounded-full transition-colors ${
    developerMode
      ? 'bg-amber-100 text-amber-700'
      : 'bg-gray-100 text-gray-400 hover:text-gray-600'
  }`}
  title={developerMode ? 'Developer mode ON' : 'Developer mode OFF'}
>
  {developerMode ? '{ }' : '{ }'}
</button>
```

- Off state: subtle gray, blends in
- On state: amber highlight so it's obvious dev mode is active

### 5. Enhanced Sanitization in Normal Mode

Update `sanitizeMessageText()` to also strip:
- `<system-reminder>...</system-reminder>` XML blocks
- `IMPORTANT: After completing...` directives
- `Pre-compaction memory flush...` blocks
- Any line starting with `Co-Authored-By:`

### 6. Preview Snippet Awareness

`sanitizePreviewSnippet()` should always filter system directives regardless of
developer mode — the left sidebar should never show raw system text.

## Files to Change

| File | Change |
|------|--------|
| `src/pages/Chat.tsx` | Add state, toggle UI, filter logic, apply to render |
| `src/lib/message-filters.ts` | (optional) Extract filter patterns for reuse |

## Testing

- Toggle off: send a message, verify no system directives appear
- Toggle on: verify all raw messages visible with role badges
- Refresh page: verify toggle state persists
- Preview snippets: verify always clean regardless of toggle
- Switching agents: verify filter applies correctly per session

## Future Considerations

- Could add a settings page with more granular controls (show/hide tool calls,
  show/hide system, show/hide metadata separately)
- Could add a "copy raw" button per message in dev mode for debugging
- Could persist per-agent dev mode preferences
