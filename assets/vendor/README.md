# Vendor Asset Drop Zone (Donarg + Cozy Furniture)

This project supports paid third-party furniture tilesets through a local import pipeline.

## 1) Place source files here

### Donarg Office Tileset
- Preferred zip filename: `assets/vendor/donarg/Donarg-Office-Tileset.zip`
- Preferred extracted png filename: `assets/vendor/donarg/donarg-office-tileset.png`

### Cozy Furniture
- Preferred zip filename: `assets/vendor/cozy-furniture/Cozy-Furniture.zip`
- Preferred extracted png filename: `assets/vendor/cozy-furniture/cozy-furniture-tileset.png`

You can provide either zip files or extracted png files. The importer will try zip extraction first when pngs are missing.

## 2) Import command

From repo root:

```bash
npm run import:vendor
```

This writes normalized runtime assets to:
- `frontend/public/assets/vendor/furniture.png`
- `frontend/public/assets/vendor/furniture.json`

## 3) Legal / licensing

Do not commit licensed third-party source files or derived atlases.
Keep vendor files local unless your license explicitly allows redistribution.
