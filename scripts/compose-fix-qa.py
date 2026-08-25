from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"D:\ChatGPT files\Endfield-IS")
TEMP = Path(r"C:\Users\ZENGYI~1\AppData\Local\Temp")


def fit(path: Path, size: tuple[int, int]) -> Image.Image:
    image = Image.open(path).convert("RGB")
    image.thumbnail(size, Image.Resampling.LANCZOS)
    return image


board = Image.new("RGB", (1800, 1000), "#111313")
draw = ImageDraw.Draw(board)
font = ImageFont.load_default()
draw.text((24, 18), "TARGETED UI FIX / BEFORE AND AFTER", fill="#fff200", font=font)
draw.text((24, 46), "BEFORE: reported issues", fill="#f5f5f1", font=font)
draw.text((905, 46), "AFTER: browser-rendered implementation", fill="#f5f5f1", font=font)

page = fit(TEMP / "codex-clipboard-0ae42263-ac0c-432d-b6f3-6c53662fe22e.png", (240, 120))
rail = fit(TEMP / "codex-clipboard-4b76b8b5-57fb-473f-bff5-6dc3f7ab5d81.png", (250, 680))
alignment = fit(TEMP / "codex-clipboard-33bfcecf-eb18-460a-9f43-829f86f5d3b0.png", (840, 260))
after = fit(ROOT / "implementation-endfield-web-alignment-fix.png", (870, 820))

board.paste(page, (24, 88))
board.paste(rail, (24, 230))
board.paste(alignment, (300, 230))
board.paste(after, (905, 88))
board.save(ROOT / "design-qa-targeted-fix-comparison.png", quality=95)
print("wrote targeted fix comparison")
