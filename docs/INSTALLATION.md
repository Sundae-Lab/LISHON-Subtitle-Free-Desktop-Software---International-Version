# Lishon International 0.7.2 — Installation

Windows 10 version 2004 or newer / Windows 11, x64.

## All-in-one installer

Run `Lishon-International-0.7.2-x64.exe` from the locally built distribution folder. Installer binaries and model weights are not committed to the source repository.

1. Choose the application folder.
2. Choose the model folder on the next page. Use **与软件放在同一目录** (same folder as the application) or browse to a separate folder or drive.
3. Install and wait for extraction and model validation to finish, then launch Lishon.

The installer wizard currently uses Chinese. The application supports Chinese, English, Japanese, Korean, French and Russian. Paths with spaces and Chinese characters are supported. The exact selected application directory is respected, without automatically appending a product folder.

Models may share the application directory, reside in a subfolder, or use another drive. The selected model root contains `translation` and `speech`. Installation-local metadata connects the app to that location automatically. Both destinations must be writable. Keep at least 8 GB free on the system drive and destination drive for temporary extraction and installed files.

## Included offline resources

- Application, Windows helper, local inference runtime and dictionary data.
- English ↔ Chinese, Japanese, Korean, French, German, Spanish and Russian: 14 direct translation directions across 8 languages.
- Whisper Base speech recognition for audio capture and imported media.

The single EXE is about 2.06 GiB, mainly because it includes offline model weights. Installation of these resources does not need additional model downloads, a VPN or an API key. Switch AI off to use local translation. Unsupported direct language pairs require another compatible direct model or AI; the app does not silently pivot through English. Some screen OCR languages still require Windows language features.

## Updates and removal

The installation records its model location. Later changes made in **Languages & models** survive restarts. Changing that setting does not move existing model files. A new installation's selected location takes effect on its first launch.

Upgrades preserve data. Uninstall offers two unchecked-by-default options: delete local translation history, and delete inventoried translation/speech models. With neither selected, only application files are removed. With an option selected, only its recorded files are removed; unrelated files and personal vocabulary data are retained. Other applications sharing those model files will also be affected. The international edition uses its own `lishon-international` profile and does not overwrite the original edition.

The installer is not publisher-signed. Its accompanying `.sha256` file can verify file integrity; a checksum is not a publisher signature.

中文：[安装说明](../安装说明.md)

## Local history

Open **My library → Translation history** and choose a storage folder. Files are stored in its `Lishon-History` subfolder. **Settings → Processing & privacy** contains the recording switch and storage location. Screen and live audio sessions longer than 15 active seconds are saved locally as structured JSONL records, including their source language and all translations. Paused time does not count. Both local-model and AI results can be saved locally. Turning recording off preserves existing files.

Double-click a name to edit the document title, or its preview to open the themed reader beside the application. The reader supports paired entries or paragraphs grouped by language, full-screen reading, and Markdown or PDF export. PDF uses white paper, black body text and gray language labels. Markdown labels use inline HTML color styles; rendering depends on the Markdown viewer. The numbering/languages toggle applies to both the reader and exports. Drag the reader away to detach it, then release within 28 logical pixels of the main window’s right edge to dock again. Earlier Markdown history records remain readable. Folder buttons reveal the file, and deletion removes the corresponding file. Stable file identifiers are retained when titles change. Selecting another folder does not move old records.
