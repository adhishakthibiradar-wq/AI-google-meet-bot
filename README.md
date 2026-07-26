# AI Google Meet Bot

Joins a Google Meet call with Puppeteer, records the real meeting audio, and generates the
transcript, executive summary, action items and task assignments from that recording with Gemini.
No transcript or summary is ever produced without an actual recording.

**Prerequisites:** Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Meeting bot configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Required for speech-to-text and analysis |
| `MEET_BOT_HEADLESS` | `true` | Set to `false` to watch the bot join in a visible Chrome window |
| `MEET_BOT_USER_DATA_DIR` | — | Chrome profile directory. Point this at a profile that is signed in to Google when the meeting does not allow anonymous guests |
| `MEET_BOT_CHROME_PATH` | Puppeteer's Chrome | Absolute path to a specific Chrome binary |
| `MOONGODB_URL` | Required to save the data |

Google Meet only lets the bot in when the meeting accepts guests or a host admits it. If the bot is
not admitted, if the join button is behind a sign-in wall, or if no audio is captured, the meeting is
marked `error` with the reason and nothing is transcribed.


