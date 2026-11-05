# SpiderNote current implementation plan

The approved product is a fully offline Android-first note application:

1. Write a visually formatted note using the reference-style editor and SpiderNote colors.
2. Record voice or import audio. Save audio before automatically transcribing it with bundled Whisper base multilingual.
3. Optionally structure saved raw text with bundled Qwen3.5-0.8B Q4_0. Review before saving to the separate Structured view.

Keep local search, notebook management in the library, tags, pins, TXT/HTML export and confirmed deletion. Settings contains exports, deletion and help only. Hide Android phone navigation automatically. No authentication, cloud LLM, subscription, model picker or model download workflow is part of this product.

The editor includes title, undo/redo, Done, More, an Aa formatting panel and checklists. Camera attachments, drawing, tables, image OCR and iOS native AI are outside this iteration. Other platforms keep manual notes.

See ../README.md for setup and Local_AI_Implementation.md for runtime details. Android_Beta_Checks.md lists native release acceptance requirements.
