# tools/ — how the 1.2 Store screenshots were actually finished (2026-09-28)

One-off Python scripts, kept so the next set doesn't start from zero.
They need Pillow + numpy (on the MacBook: a throwaway venv —
`python3 -m venv venv && ./venv/bin/pip install numpy pillow`; the
system python has neither). Paths are hard-coded near the top of each
file; edit them for the next run.

**Why these exist.** The plan in `../ASTRA-BRIEF.md` (Astra does
everything, including headlines in code, from one zip) FAILED: Astra
sat "thinking" forever on the 23 MB zip + brief. What worked:

1. **Astra makes the SCENE only** — one new chat per shot, one mockup
   attached, one short prompt pasted (the `../prompts/` scene + a
   trimmed style block). No zip, no brief, no headline, no sizing.
2. **Everything else is done here, in code:**

| Script | What it does |
|---|---|
| `rebuild-mockup-2x.py` | shots.so's FREE tier exports 1920×1440 only (phone ≈1100px tall — too small, text goes soft when enlarged). Rebuilds each mockup at 2×: frame upscaled from shots.so, SCREEN re-pasted from the full-res simulator screenshot, Dynamic Island kept (detected as a black pill — it's too close to the app's dark header for a plain diff). |
| `narrow.py` | Finds exactly where the screenshot sits inside Astra's scene (template match on the screen's interior) within a small search window. Seconds. `finish.py`'s full search takes 5–10 min per image — prefer this. |
| `finish2.py` | THE FINAL STEP: scales the scene so the phone is the same size in every iPhone shot (never smaller than full width — side bars look worse), pastes the REAL screenshot back over the phone's screen (sharp, and undoes any drift Astra introduced — it changed "+2" to "23" in one calendar), keeps the island, sets the headline with the fonts in `../fonts/`, exports exact Store size as JPEG with no alpha. |
| `compose.py` | The headline renderer (Chakra Petch Bold blue line + Inter SemiBold off-white line, `\n` for a forced break). |
| `finish.py` | First version of finish2 (scene fit by width only; slow full search). Superseded. |

Why pasting the real screen back matters: Astra's images come back as
small previews (≈850–1090px wide), and it DOES drift small text. The
scene can be a little soft; the screen can't.
