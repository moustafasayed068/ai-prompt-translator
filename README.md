# AI Prompt Translator

A small Chrome extension that adds a **文→EN** button next to the send button on AI chat sites. Write your prompt in any language, click the button (or press **Alt+T**), and the message box is replaced with the English translation, ready to send.

Many languages, such as Arabic, Hindi, Russian, Chinese or Japanese, take more tokens than the same text in English, so this helps your usage go further.

## Supported sites

| Site | Address |
|---|---|
| Claude | claude.ai |
| ChatGPT | chatgpt.com |
| Gemini | gemini.google.com |
| Grok | grok.com |
| Perplexity | perplexity.ai |
| DeepSeek | chat.deepseek.com |
| Microsoft Copilot | copilot.microsoft.com |
| Mistral Le Chat | chat.mistral.ai |

If the button can't find a site's send button, it floats in the bottom-right corner instead and works the same way.

## Features

- Works from **any language**: the language you write in is detected automatically
- Translate **to any language** (English by default), picked from the toolbar icon
- One-click button beside the send button, or **Alt+T**
- Optional "Reply in English." line at the end, so answers stay cheap in tokens too
- Skips text that's already in the target language
- Keeps line breaks and paragraphs
- **Ctrl+Z** undoes a translation
- If it ever can't write into the box, your original text stays and a panel shows the translation with a Copy button
- Free: uses Google Translate's public endpoint, no API key needed

## Install (from source)

1. Download this repository (green **Code** button → **Download ZIP**) and unzip it.
2. Open `chrome://extensions` in Chrome (also works in Edge, Brave and Opera).
3. Turn on **Developer mode** (top right).
4. Click **Load unpacked** and pick the unzipped folder.
5. Open or refresh one of the supported sites.

## Adding another site

Open `content.js`, add an entry to the `SITES` list with the site's address and CSS selectors for its message box and send button, and add the address to `matches` in `manifest.json`.

## How it works

- `content.js` finds the message box, adds the button and replaces the text.
- `background.js` sends the text to Google Translate and returns the result.
- Nothing else is collected or stored.

## Notes

- Chat sites change their pages often. If a button lands in an odd spot, open an issue with a screenshot.
- Google's free endpoint has rate limits. If you translate a lot very quickly it may fail for a few minutes.

## License

MIT
