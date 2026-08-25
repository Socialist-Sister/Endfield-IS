from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(r"D:\ChatGPT files\Endfield-IS")
DOWNLOADS = Path(r"C:\Users\ZengYiming\Downloads")


def fit(image: Image.Image, size: tuple[int, int]) -> Image.Image:
    copy = image.copy()
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    return copy


def make_board(source_path: Path, implementation_path: Path, output_path: Path, title: str) -> None:
    board = Image.new("RGB", (1680, 940), "#111313")
    draw = ImageDraw.Draw(board)
    font = ImageFont.load_default()
    draw.text((30, 20), title, fill="#fff200", font=font)
    draw.text((30, 48), f"SOURCE: {source_path.name}", fill="#f5f5f1", font=font)
    draw.text((855, 48), f"IMPLEMENTATION: {implementation_path.name}", fill="#f5f5f1", font=font)

    source = fit(Image.open(source_path).convert("RGB"), (795, 820))
    implementation = fit(Image.open(implementation_path).convert("RGB"), (795, 820))
    board.paste(source, (30 + (795 - source.width) // 2, 88 + (820 - source.height) // 2))
    board.paste(implementation, (855 + (795 - implementation.width) // 2, 88 + (820 - implementation.height) // 2))
    board.save(output_path, quality=95)


make_board(
    DOWNLOADS / "IMG_0109.PNG",
    ROOT / "implementation-endfield-web-config-selected.png",
    ROOT / "design-qa-endfield-config-comparison.png",
    "ENDFIELD WEB CALCULATOR / CONFIGURATION ART-DIRECTION COMPARISON",
)
make_board(
    DOWNLOADS / "IMG_0107.PNG",
    ROOT / "implementation-endfield-web-shift-result.png",
    ROOT / "design-qa-endfield-result-comparison.png",
    "ENDFIELD WEB CALCULATOR / RESULT DENSITY COMPARISON",
)

print("wrote design QA comparison boards")
