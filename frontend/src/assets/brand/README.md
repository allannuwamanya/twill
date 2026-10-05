# Twill brand assets

Twill's mark is one continuous thread tied in a knot: three strands passing over and under each other. The palette comes from denim, which is a twill weave.

## Colors

| Name | Hex | Use |
|---|---|---|
| Indigo dye | #3A5BC0 | Strand 1, primary brand color |
| Faded wash | #7FA3E8 | Strand 2 |
| Sand thread | #D9B98A | Strand 3 |
| Deep indigo | #1B2A63 | App icon background |

On dark backgrounds use `twill-logo-on-dark` (lighter blues). Reserve these state colors for status only, never for the brand: amber #E8A317 (waiting), green #2FB67C (done), red #E5484D (failed).

## Folders

- `svg/` color, on-dark, black, white, app icon and favicon (all scalable)
- `png/` the same at standard sizes (logo 16 to 1024, app icon 16 to 1024 including 180 for Apple touch and 192/512 for web apps, on-dark, black, white)
- `favicon.ico` 16, 32 and 48 px
- `animated/` standalone animated SVGs (thinking, working, streaming) that play inside an `<img>` tag
- `code/` CSS, an HTML snippet and a React component (`TwillLogo.jsx`) with all states

## Notes

- Keep clear space around the logo of at least one strand width.
- Below 24 px use the app icon or favicon version, not the bare knot.
- No wordmark yet. It needs a font choice, so it is not part of this pack.
