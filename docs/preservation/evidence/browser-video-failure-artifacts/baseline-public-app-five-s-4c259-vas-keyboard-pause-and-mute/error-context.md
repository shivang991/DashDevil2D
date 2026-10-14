# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: baseline.spec.ts >> public app: five-second start, actual canvas, keyboard pause and mute
- Location: tests/browser/baseline.spec.ts:6:1

# Error details

```
Error: browserContext.newPage: Executable doesn't exist at /Users/shivang/Library/Caches/ms-playwright/ffmpeg-1013/ffmpeg-mac
╔═════════════════════════════════════════════════════════════════╗
║ Video rendering requires ffmpeg binary.                         ║
║ Downloading it will not affect any of the system-wide settings. ║
║ Please run the following command:                               ║
║                                                                 ║
║     npx playwright install ffmpeg                               ║
║                                                                 ║
║ <3 Playwright Team                                              ║
╚═════════════════════════════════════════════════════════════════╝
```