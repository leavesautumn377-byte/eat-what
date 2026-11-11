"""Rebuild the shared UI font from the official LXGW WenKai v1.530 TTF.

Usage: python scripts/rebuild-font-subset.py path/to/LXGWWenKai-Regular.ttf
"""

import base64
import re
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
FONT_PATHS = [
    ROOT / "assets/wenkai-ui.ttf",
    ROOT / "android-app/app/src/main/assets/wenkai-ui.ttf",
    ROOT / "ios-app/EatWhat/Web/wenkai-ui.ttf",
    ROOT / "harmony-app/entry/src/main/resources/rawfile/wenkai-ui.ttf",
]
TEXT_PATHS = [
    ROOT / "app.json",
    *ROOT.joinpath("pages").rglob("*.js"),
    *ROOT.joinpath("pages").rglob("*.wxml"),
    *ROOT.joinpath("utils").rglob("*.js"),
    ROOT / "android-app/app/src/main/assets/app.js",
    ROOT / "android-app/app/src/main/assets/index.html",
]


def ui_codepoints():
    points = set(TTFont(FONT_PATHS[0]).getBestCmap())
    for path in TEXT_PATHS:
        content = path.read_text(encoding="utf-8")
        points.update(ord(char) for char in content if ord(char) >= 0x3000)
        points.update(int(code, 16) for code in re.findall(r"\\u([0-9a-fA-F]{4})", content))
    return points


def main(source_path):
    font = TTFont(source_path)
    if round(font["head"].fontRevision, 3) != 1.530:
        raise ValueError("Expected LXGW WenKai v1.530, matching the existing app font")

    needed = ui_codepoints()
    missing = needed - set(font.getBestCmap())
    if missing:
        raise ValueError(f"Source font lacks {len(missing)} required characters")

    options = subset.Options()
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=needed)
    subsetter.subset(font)
    font.save(FONT_PATHS[0])

    font_bytes = FONT_PATHS[0].read_bytes()
    for path in FONT_PATHS[1:]:
        path.write_bytes(font_bytes)

    encoded = base64.b64encode(font_bytes).decode("ascii")
    (ROOT / "assets/wenkai-font.wxss").write_text(
        "@font-face { font-family: MealWenKai; "
        f"src: url('data:font/truetype;base64,{encoded}') format('truetype'); "
        "font-weight: normal; }\n",
        encoding="ascii",
    )
    print(f"Font subset: {len(font_bytes)} bytes, {len(needed)} codepoints")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        raise SystemExit("Usage: rebuild-font-subset.py LXGWWenKai-Regular.ttf")
    main(Path(sys.argv[1]))
