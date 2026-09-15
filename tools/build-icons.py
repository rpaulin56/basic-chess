"""
Le icone PNG dell'app, disegnate con le stesse forme di public/favicon.svg.

Servono dove l'SVG non basta: la scorciatoia installata da Chrome o Brave e l'app di
Android vogliono PNG da 192 e 512 nel manifest (senza, mostrano la lettera "G");
Safari, l'iPhone e l'iPad vogliono apple-touch-icon da 180. Le forme sono ricopiate
qui a mano: se si cambia il disegno, va cambiato in tutti e due i posti.

Le PNG sono a pieno quadrato, senza gli angoli arrotondati dell'SVG: li arrotonda il
sistema (iOS, macOS, Android), e un angolo gia' arrotondato lascerebbe un bordo chiaro.

    python tools/build-icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / 'public'
LIGHT = '#f0d9b5'
DARK = '#c0ae91'
INK = '#111111'
SUPER = 8  # disegno in grande e riduzione: bordi lisci senza antialias nativo


def icon(size: int) -> Image.Image:
    scale = size * SUPER / 64
    image = Image.new('RGB', (size * SUPER, size * SUPER), LIGHT)
    draw = ImageDraw.Draw(image)

    def point(x: float, y: float) -> tuple[float, float]:
        return (x * scale, y * scale)

    for row in range(4):
        for col in range(4):
            if (row + col) % 2 == 1:
                draw.rectangle([point(col * 16, row * 16), point(col * 16 + 16, row * 16 + 16)], fill=DARK)

    crown = [(12, 22), (21, 40), (26, 19), (32, 36), (38, 19), (43, 40), (52, 22), (48, 46), (16, 46)]
    draw.polygon([point(x, y) for x, y in crown], fill=INK)
    draw.polygon([point(x, y) for x, y in [(15, 48), (49, 48), (51, 55), (13, 55)]], fill=INK)
    for cx, cy, r in [(12, 19, 3.2), (26, 15.5, 3.4), (38, 15.5, 3.4), (52, 19, 3.2)]:
        draw.ellipse([point(cx - r, cy - r), point(cx + r, cy + r)], fill=INK)

    return image.resize((size, size), Image.LANCZOS)


for name, size in [('apple-touch-icon.png', 180), ('icon-192.png', 192), ('icon-512.png', 512)]:
    icon(size).save(OUT / name, optimize=True)
    print(name, size)
