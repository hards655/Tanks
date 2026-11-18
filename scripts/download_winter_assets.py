#!/usr/bin/env python3
"""Discover and optionally download CC0 realistic environmental GLBs from Poly Haven.

Usage: python3 scripts/download_winter_assets.py [--download] [--limit 25]
Official API: https://api.polyhaven.com (requires distinctive User-Agent).
"""
import argparse
import json
import pathlib
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "https://api.polyhaven.com"
UA = "SteelThunderWinterAssetCatalog/1.0 (offline asset discovery)"
TERMS = {
    "terrain": ("rock", "boulder", "cliff", "stone", "snow", "ice"),
    "vegetation": ("pine", "spruce", "tree", "log", "stump", "branch"),
    "buildings": ("warehouse", "factory", "industrial", "building", "shed"),
    "railway": ("railway", "railroad", "train", "track", "rail"),
    "props": ("barrel", "crate", "container", "pipe", "concrete", "fence", "pallet"),
}

def api(path):
    req = urllib.request.Request(BASE + path, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=45) as response:
        return json.load(response)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--download", action="store_true")
    parser.add_argument("--limit", type=int, default=25)
    args = parser.parse_args()
    data = api("/assets?t=models")
    selected = []
    for asset_id, info in data.items():
        searchable = " ".join([asset_id, info.get("name", ""), info.get("category", ""), *info.get("tags", [])]).lower()
        categories = [folder for folder, terms in TERMS.items() if any(term in searchable for term in terms)]
        if categories:
            selected.append({"id": asset_id, "name": info.get("name", asset_id), "category": categories[0], "source": "https://polyhaven.com/a/" + asset_id, "license": "CC0-1.0"})
    selected = selected[:max(0, min(args.limit, 200))]
    catalog = ROOT / "assets" / "winter_asset_catalog.json"
    catalog.parent.mkdir(exist_ok=True)
    catalog.write_text(json.dumps(selected, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Cataloged {len(selected)} candidate models in {catalog}")
    if args.download:
        print("Model binaries need format verification and optimization before importing into the game. Download is intentionally not automatic: Poly Haven models may require conversion from source formats to GLB.")
        print("Review each source URL in the catalog and export GLB via Blender or another glTF exporter.")

if __name__ == "__main__":
    main()
