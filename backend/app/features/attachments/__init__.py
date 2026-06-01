"""Polymorphic attachments — any file linked to any entity.

Replaces the per-feature JSON arrays (``devices.photos``,
``purchases.seller_photos``, ``purchases.doc_photos`` on counterparties,
``sales.buyer_photos``, ``catalog_items.photos``) with one row-per-file
table. The win is operational, not just architectural:

* a user can attach files **after** the parent record is closed (warranty
  card scanned a week after the sale, repair invoice attached to a sold
  device) — the JSON-array approach forced edits within an arbitrary
  24-hour window;
* non-image files (PDF, CSV, .heic) carry their original filename and
  MIME type, so the UI can render «passport.pdf · 1.2 MB» instead of an
  opaque S3 key;
* a single GET against device-id streams the full chronological story
  (purchase docs → device photos → sale docs → post-sale receipts) by
  resolving the device's purchase/sale ids on the server.

Legacy JSON columns stay populated during the transition for backward
compatibility — the backfill migration mirrors every existing key into
this table on upgrade.
"""
