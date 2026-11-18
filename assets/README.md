# Winter environment assets (CC0)

This folder contains a reproducible downloader for realistic environment models and materials. **The GLB binaries are not yet committed.**

Sources:
- Poly Haven (CC0): https://polyhaven.com/models and https://polyhaven.com/license
- ambientCG (CC0): https://ambientcg.com and https://docs.ambientcg.com/license/

Use `python3 scripts/download_winter_assets.py` to search the official Poly Haven API for suitable environment models, review results, and write a JSON catalog. Use `--download` to fetch supported GLB files. Models are not automatically placed into the game scene. The official API requires a distinct User-Agent and credit if used live in an app; this offline developer script is not a runtime dependency.

Asset categories: buildings, terrain, vegetation, railway, props, materials. Do not assume all categories have suitable CC0 realistic models; the catalog records only available matches.

For GitHub, use Git LFS for large binary assets and optimize textures/meshes before serving them to browsers.
