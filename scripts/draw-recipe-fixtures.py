"""Draw original recipe cards for the scan harness. Not copied from any site."""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFont, ImageOps

OUT = Path("tests/fixtures/recipes")
OUT.mkdir(parents=True, exist_ok=True)

SERIF = "/usr/share/fonts/truetype/noto/NotoSerif-Regular.ttf"
SERIF_BOLD = "/usr/share/fonts/truetype/noto/NotoSerif-Bold.ttf"
SERIF_ITALIC = "/usr/share/fonts/truetype/noto/NotoSerif-Italic.ttf"
SANS = "/usr/share/fonts/truetype/macos/Inter-Regular.ttf"
SANS_BOLD = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"
MONO = "/usr/share/fonts/truetype/jetbrains-mono/JetBrainsMono-Regular.ttf"

PAPER = (248, 242, 230)
INK = (42, 32, 24)
RULE = (176, 132, 96)


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def wrap(draw: ImageDraw.ImageDraw, text: str, face: ImageFont.FreeTypeFont, width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in text.split("\n"):
        if paragraph == "":
            lines.append("")
            continue
        current = ""
        for word in paragraph.split(" "):
            trial = word if current == "" else f"{current} {word}"
            if draw.textlength(trial, font=face) <= width:
                current = trial
            else:
                if current:
                    lines.append(current)
                current = word
        if current:
            lines.append(current)
    return lines


def card(name: str, title: str, lines: list[str], size=(900, 1200)) -> Image.Image:
    image = Image.new("RGB", size, PAPER)
    draw = ImageDraw.Draw(image)
    draw.rectangle((28, 28, size[0] - 28, size[1] - 28), outline=RULE, width=3)
    title_face = font(SERIF_BOLD, 54)
    body = font(SERIF, 32)
    y = 70
    for row in wrap(draw, title, title_face, size[0] - 140):
        draw.text((70, y), row, fill=INK, font=title_face)
        y += 64
    y += 16
    draw.line((70, y, size[0] - 70, y), fill=RULE, width=2)
    y += 24
    for line in lines:
        face = body
        for row in wrap(draw, line, face, size[0] - 140) or [""]:
            draw.text((70, y), row, fill=INK, font=face)
            y += 42
    image.save(OUT / name, "PNG")
    return image


def main() -> None:
    card(
        "typed-card.png",
        "Sunday stew",
        [
            "Serves 6",
            "Prep 15 min",
            "Cook 40 min",
            "",
            "Ingredients",
            "1/2 cup flour",
            "2 onions",
            "1 lb beef",
            "salt",
            "",
            "Steps",
            "1. Toss the beef with the flour.",
            "2. Simmer until thick.",
            "",
            "Notes",
            "Better the next day.",
        ],
    )

    hand = Image.new("RGB", (900, 1200), (244, 236, 214))
    draw = ImageDraw.Draw(hand)
    italic = font(SERIF_ITALIC, 40)
    y = 80
    for index, line in enumerate(
        [
            "Weeknight beans",
            "Serves 4",
            "Prep 10 min",
            "Cook 25 min",
            "",
            "Ingredients",
            "2 cups cooked beans",
            "1 onion",
            "3 cloves garlic",
            "1 tsp chili",
            "",
            "Steps",
            "1. Soften the onion.",
            "2. Stir in the beans and chili.",
            "",
            "Notes",
            "Good cold, too.",
        ]
    ):
        draw.text((60 + (index % 3) * 6, y), line, fill=(58, 36, 28), font=italic)
        y += 48
    hand.rotate(2, expand=True, fillcolor=(244, 236, 214)).save(OUT / "handwritten.png", "PNG")

    page = Image.new("RGB", (1400, 900), (252, 248, 240))
    draw = ImageDraw.Draw(page)
    title_face = font(SERIF_BOLD, 48)
    body = font(SERIF, 28)
    draw.text((60, 40), "Apple skillet cake", fill=INK, font=title_face)
    draw.text((60, 110), "Serves 8    Prep 20 min    Cook 35 min", fill=INK, font=body)
    draw.line((60, 170, 1340, 170), fill=RULE, width=2)
    left = [
        "Ingredients",
        "1 1/2 cups flour",
        "1/2 cup sugar",
        "2 apples",
        "1 tsp cinnamon",
        "1/2 cup butter",
    ]
    right = [
        "Steps",
        "1. Stir the dry ingredients.",
        "2. Fold in the apples.",
        "3. Bake until the top is set.",
        "",
        "Notes",
        "Serve warm.",
    ]
    y = 200
    for line in left:
        draw.text((70, y), line, fill=INK, font=body)
        y += 46
    y = 200
    for line in right:
        draw.text((760, y), line, fill=INK, font=body)
        y += 46
    page.save(OUT / "two-column.png", "PNG")

    shot = Image.new("RGB", (900, 1400), (236, 236, 236))
    draw = ImageDraw.Draw(shot)
    draw.rectangle((0, 0, 900, 88), fill=(60, 60, 60))
    draw.rounded_rectangle((40, 24, 860, 64), radius=16, fill=(230, 230, 230))
    draw.text((56, 30), "family-notes.example/lemon-rice", fill=(40, 40, 40), font=font(SANS, 22))
    draw.rectangle((40, 110, 860, 1360), fill=(255, 255, 255))
    body = font(SANS, 30)
    y = 140
    for line in [
        "Lemon rice",
        "Serves 4",
        "Prep 10 min",
        "Cook 20 min",
        "",
        "Ingredients",
        "1 cup rice",
        "2 cups water",
        "1 lemon",
        "2 tbsp butter",
        "",
        "Steps",
        "1. Simmer the rice in the water.",
        "2. Stir in the lemon and butter.",
        "",
        "Notes",
        "Add herbs if you have them.",
    ]:
        face = font(SANS_BOLD, 40) if line == "Lemon rice" else body
        draw.text((70, y), line, fill=(20, 20, 20), font=face)
        y += 52
    shot.save(OUT / "screenshot.png", "PNG")

    card(
        "card-front.png",
        "Tomato soup",
        [
            "Serves 4",
            "Prep 10 min",
            "Cook 30 min",
            "",
            "Ingredients",
            "2 lb tomatoes",
            "1 onion",
            "2 cups stock",
            "salt",
        ],
        (800, 1000),
    )
    card(
        "card-back.png",
        "Tomato soup, continued",
        [
            "Steps",
            "1. Cook the onion.",
            "2. Add the tomatoes and stock.",
            "3. Blend until smooth.",
            "",
            "Notes",
            "A little cream is optional.",
        ],
        (800, 1000),
    )

    upright = card(
        "ginger-upright.png",
        "Ginger tea",
        [
            "Serves 2",
            "Prep 5 min",
            "Cook 10 min",
            "",
            "Ingredients",
            "2 inches ginger",
            "2 cups water",
            "1 tbsp honey",
            "",
            "Steps",
            "1. Simmer the ginger.",
            "2. Strain and stir in the honey.",
            "",
            "Notes",
            "Stronger if you grate it.",
        ],
        (800, 1100),
    )
    turned = upright.rotate(90, expand=True, fillcolor=PAPER)
    turned.save(OUT / "rotated.png", "PNG")
    (OUT / "ginger-upright.png").unlink()

    dim = card(
        "low-light.png",
        "Oat pan bread",
        [
            "Serves 6",
            "Prep 15 min",
            "Cook 30 min",
            "",
            "Ingredients",
            "2 cups oats",
            "1 cup flour",
            "1 tsp salt",
            "1 1/2 cups water",
            "",
            "Steps",
            "1. Stir everything together.",
            "2. Bake until firm.",
            "",
            "Notes",
            "Slice it the next morning.",
        ],
    )
    dark = ImageEnhance.Brightness(dim).enhance(0.45)
    dark.save(OUT / "low-light.png", "PNG")

    quiet = Image.new("RGB", (900, 700), (186, 168, 140))
    quiet_draw = ImageDraw.Draw(quiet)
    quiet_draw.ellipse((280, 160, 620, 500), fill=(120, 92, 64))
    quiet_draw.ellipse((360, 80, 540, 220), fill=(92, 122, 64))
    quiet.save(OUT / "not-a-recipe.png", "PNG")

    card(
        "fractions.png",
        "Honey custard",
        [
            "Serves 4",
            "Prep 15 min",
            "Cook 35 min",
            "",
            "Ingredients",
            "1/2 cup honey",
            "1 1/2 cups milk",
            "2-3 eggs",
            "1/4 tsp salt",
            "",
            "Steps",
            "1. Warm the milk and honey.",
            "2. Whisk in the eggs.",
            "3. Bake in a water bath.",
            "",
            "Notes",
            "It sets as it cools.",
        ],
    )

    expected = {
        "typed-card.png": {
            "title": "Sunday stew",
            "makes": "6",
            "prep": "15",
            "cook": "40",
            "ingredients": [
                {"quantity": "1/2", "unit": "cup", "item": "flour"},
                {"quantity": "2", "unit": "", "item": "onions"},
                {"quantity": "1", "unit": "lb", "item": "beef"},
                {"quantity": "", "unit": "", "item": "salt"},
            ],
            "steps": 2,
            "notes": "next day",
        },
        "handwritten.png": {
            "title": "Weeknight beans",
            "makes": "4",
            "prep": "10",
            "cook": "25",
            "ingredients": [
                {"quantity": "2", "unit": "cup", "item": "beans"},
                {"quantity": "1", "unit": "", "item": "onion"},
                {"quantity": "3", "unit": "clove", "item": "garlic"},
                {"quantity": "1", "unit": "tsp", "item": "chili"},
            ],
            "steps": 2,
            "notes": "cold",
        },
        "two-column.png": {
            "title": "Apple skillet cake",
            "makes": "8",
            "prep": "20",
            "cook": "35",
            "ingredients": [
                {"quantity": "1 1/2", "unit": "cup", "item": "flour"},
                {"quantity": "1/2", "unit": "cup", "item": "sugar"},
                {"quantity": "2", "unit": "", "item": "apples"},
                {"quantity": "1", "unit": "tsp", "item": "cinnamon"},
                {"quantity": "1/2", "unit": "cup", "item": "butter"},
            ],
            "steps": 3,
            "notes": "warm",
        },
        "screenshot.png": {
            "title": "Lemon rice",
            "makes": "4",
            "prep": "10",
            "cook": "20",
            "ingredients": [
                {"quantity": "1", "unit": "cup", "item": "rice"},
                {"quantity": "2", "unit": "cup", "item": "water"},
                {"quantity": "1", "unit": "", "item": "lemon"},
                {"quantity": "2", "unit": "tbsp", "item": "butter"},
            ],
            "steps": 2,
            "notes": "herbs",
        },
        "card-pair": {
            "images": ["card-front.png", "card-back.png"],
            "title": "Tomato soup",
            "makes": "4",
            "prep": "10",
            "cook": "30",
            "ingredients": [
                {"quantity": "2", "unit": "lb", "item": "tomatoes"},
                {"quantity": "1", "unit": "", "item": "onion"},
                {"quantity": "2", "unit": "cup", "item": "stock"},
                {"quantity": "", "unit": "", "item": "salt"},
            ],
            "steps": 3,
            "notes": "cream",
        },
        "rotated.png": {
            "title": "Ginger tea",
            "makes": "2",
            "prep": "5",
            "cook": "10",
            "ingredients": [
                {"quantity": "2", "unit": "inch", "item": "ginger"},
                {"quantity": "2", "unit": "cup", "item": "water"},
                {"quantity": "1", "unit": "tbsp", "item": "honey"},
            ],
            "steps": 2,
            "notes": "grate",
        },
        "low-light.png": {
            "title": "Oat pan bread",
            "makes": "6",
            "prep": "15",
            "cook": "30",
            "ingredients": [
                {"quantity": "2", "unit": "cup", "item": "oats"},
                {"quantity": "1", "unit": "cup", "item": "flour"},
                {"quantity": "1", "unit": "tsp", "item": "salt"},
                {"quantity": "1 1/2", "unit": "cup", "item": "water"},
            ],
            "steps": 2,
            "notes": "morning",
        },
        "fractions.png": {
            "title": "Honey custard",
            "makes": "4",
            "prep": "15",
            "cook": "35",
            "ingredients": [
                {"quantity": "1/2", "unit": "cup", "item": "honey"},
                {"quantity": "1 1/2", "unit": "cup", "item": "milk"},
                {"quantity": "2-3", "unit": "", "item": "eggs"},
                {"quantity": "1/4", "unit": "tsp", "item": "salt"},
            ],
            "steps": 3,
            "notes": "cools",
        },
    }
    (OUT / "expected.json").write_text(json.dumps(expected, indent=2) + "\n")
    print("wrote", len(list(OUT.glob('*.png'))), "pngs")


if __name__ == "__main__":
    main()
