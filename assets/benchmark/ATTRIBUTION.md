# Built-in benchmark audio

`jfk.wav` is the short John F. Kennedy inaugural-address sample distributed with whisper.cpp:

- Source: https://github.com/ggml-org/whisper.cpp/blob/482279b8a18855ba741d7b88c30fcb3874691f59/samples/jfk.wav
- SHA-256: `59dfb9a4acb36fe2a2affc14bacbee2920ff435cb13cc314a08c13f66ba7860e`
- Size: 352078 bytes.
- Speech: President John F. Kennedy, January 20, 1961, inaugural address (US federal government work).
- Project source: https://github.com/ggml-org/whisper.cpp (MIT).

The app also creates five seconds of digital silence and includes original fictional English, Filipino and Taglish text fixtures. These text fixtures test note generation, not speech recognition. The bundled pack does not establish conversational Taglish or meeting-transcription accuracy. Users can import an existing licensed/consented audio file and optionally supply a reference transcript; no new recording is required.

A small FLEURS Filipino audio sample was considered, but the dataset preview service currently fails with a row-group scan limit. No inaccessible dataset sample or fabricated Filipino speech accuracy score is shipped.
