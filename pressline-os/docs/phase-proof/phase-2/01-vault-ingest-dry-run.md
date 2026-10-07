# Phase 2 — vault ingest dry run (2026-10-07)

`scripts/vault-ingest.ts` now walks a local folder **or** a Google Drive folder (`--src drive:<folderId>`, service account) through the same pipeline: sha256 dedupe → sharp metadata → 400px webp thumbnail → `vault_assets` row tagged by folder path + file name. Resumable via a progress file, batches of 500 (`--batch`), `--dry` never touches the DB or Storage.

Sample set: 4 images + 1 text file in two brand folders, one image a byte-identical copy.

```
[vault] source=vault-samples brand=death_corps license=mcg batch=500 resume=0 DRY RUN (no DB, no uploads)
[dry] reaper-skull_front COPY.png → vault/death_corps/20/208ab22986e61e53ff85c3355b3a06a20ed412b85f7938d05c661485f76ce8a3.png (1200×1500, ? dpi, thumb 314B) tags=death corps,skulls,reaper,skull,front,copy
[dry] eagle-banner.jpg → vault/death_corps/2b/2b09f9b507941ac7f660bea45a276a145b381dd66c0cb0a13f8f3bdee94b987b.jpg (900×600, 72 dpi, thumb 256B) tags=death corps,eagle,banner
[dry] valknut_300dpi.png → vault/death_corps/41/4168f8e37716ec7829a9b64d2604556ec2c19b5817c47ce6191a0d13c264f5b7.png (3000×3000, 300 dpi, thumb 366B) tags=odins reich,valknut,300dpi
[vault] done: +3 would insert, 1 duplicates, 0 failed, 4 processed this run (re-run to continue; progress in .vault-ingest.dbdb571f.json)
```

Result: 3 would insert, 1 duplicate dropped, the `.txt` ignored, 300 DPI detected from the pHYs tag. Full 75K run is blocked only on Open Item #5 (where the vault lives) and Drive credentials.
