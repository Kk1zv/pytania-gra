# Kamienna Twarz

A bluffing trivia party game in Polish, played on phones. Everyone writes a fake answer to an obscure question, then votes for the one they think is real. You score for finding the truth and for fooling your friends.

*Blefująca gra towarzyska na telefony: wymyśl fałszywą odpowiedź, zgadnij prawdziwą i nie daj się nabrać.*

> **Disclaimer:** This project was made with AI. The code, design and built-in questions were written with the help of Claude (Anthropic), so they may contain mistakes.
>
> *Zastrzeżenie: ten projekt powstał z pomocą AI (Claude od Anthropic). Kod, wygląd i wbudowane pytania mogą zawierać błędy.*

## How to play

1. One person opens the game and taps **Załóż grę** (start a game). Their phone hosts the game, and they play too.
2. Friends scan the QR code or type the 4-letter room code to join. 2 to 10 players.
3. Each round, a question appears with a blank. Everyone writes a believable fake answer (45 s).
4. All the answers are shuffled together with the real one, and everyone votes (25 s).
5. The reveal shows which answers were lies, who wrote them, and who fell for them. After 7 rounds, the highest score wins.

No phones handy? Tap **Dodaj bota** (add a bot) to fill the room with bots that write fakes and vote on their own.

## Questions

- **Built-in set:** hand-written questions in `questions.js`.
- **Wikipedia:** questions generated live from random entries in Polish Wikipedia categories (historical jobs, dances, kitchenware, superstitions and more), through Wikipedia's free public API. It needs no key or account.

## Running it

It's a static site with no build step and no server code.

- **Online:** open the GitHub Pages link. Phones connect to each other peer-to-peer through [PeerJS](https://peerjs.com/).
- **Locally:**
  ```sh
  python3 -m http.server 8000
  ```
  Open http://localhost:8000. On `localhost`, players join from other tabs of the same browser, which is handy for testing. To play on phones over Wi-Fi, open `http://<your-computer's-IP>:8000` on them instead, or add `?online=1` to the URL.

## License

[MIT](LICENSE)
