# practice-games

This workspace contains small browser games (HTML/JS) used for practice.

Dictionary / wordlist notes
--------------------------

The Baker's Dozen game supports validating player words against a wordlist. By default
the game tries to load `wordlist.txt` (one word per line) from the same folder. If
`wordlist.txt` is missing or fails to load, the game falls back to a small embedded
dictionary included in the HTML.

Important: the official Scrabble dictionaries (OSPD / Collins) are copyrighted and
cannot be redistributed here. If you have a licensed copy of an official Scrabble
word list, replace `wordlist.txt` with that file (or adjust the game to query a
licensed API). Alternatively, use a public-domain or open wordlist such as the
SCOWL/word-lists or other permissively licensed lists.

To replace the wordlist:

1. Put a file named `wordlist.txt` in the project root (same folder as the game HTML).
2. Each line should contain a single word. Case doesn't matter; the loader upper-cases words.
3. Reload the page — the game will load the file on startup.

If you'd like, I can add an option to fetch a hosted wordlist or integrate a licensed
dictionary API; tell me which source you prefer and I will wire it up.
