# Development / 开发说明

[English introduction](../README.md) · [中文介绍](../README.zh-CN.md)

## Source setup

Use Windows 10 2004+ or Windows 11 x64. Install Node.js 22.12+ with npm, `uv`, and .NET 10 SDK. `uv` creates the Python 3.11 environment used by the engine. Run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/restore-dev.ps1
```

This installs the locked dependencies, downloads pinned ECDICT/WordNet dictionary inputs with SHA-256 verification, builds `dictionary.sqlite`, publishes the Windows helper and builds the frontend. It does **not** build an installer. Dictionary preparation was tested in an empty temporary directory; it builds 770,611 ECDICT entries plus WordNet senses. No global NLTK download is required.

Downloads require access to the public upstream URLs in [dictionary-sources.json](../engine/data/dictionary-sources.json). A restricted network may require an approved network configuration. The script does not change proxy settings. A failed setup can be retried; a dictionary database is only replaced after a successful build.

首次准备需要下载开发依赖与词典输入数据，网络受限时可能无法访问上游。脚本不会更改代理。源码仓库不包含模型权重；语言包下载源与校验值见 [model-sources.json](../engine/data/model-sources.json)。可以在应用中选择已有模型目录，避免重复下载。

## Start the desktop app

After setup, double-click `启动国际版.cmd`, or run:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/start.ps1
```

This rebuilds the frontend and starts Electron against local files. In **Languages & models**, select a folder containing compatible Argos direct translation packages and the Whisper Base speech model. UI-only previews do not require these models.

For hot reload, use two PowerShell terminals:

```powershell
# Terminal 1
npm run dev -- --port 5197 --strictPort
```

```powershell
# Terminal 2
$env:LINGUA_DEV_URL='http://127.0.0.1:5197'
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
npm run desktop
```

The international edition uses `%APPDATA%\lishon-international`, separate from the original edition. Model folders can be shared, while API settings, history and vocabulary remain separate. Closing behavior is configurable in Settings; minimizing does not end recognition.

## Internationalization

- `shared/messages.json` is the authoritative catalog. Chinese source messages are keys; each entry has `en`, `ja`, `ko`, `fr`, `ru` translations.
- Use `t('中文界面文案')` for labels and `t('第 {0} 个目标语种', [index])` for interpolation. Keep placeholder numbers identical across languages.
- Do not translate user text, dictionary meanings, translation results, API model IDs or user file paths as interface labels.
- `src/i18n.jsx` notifies renderer roots. `uiLanguage` is validated independently from `source`, `target` and ordered subtitle languages.
- `src/InterfaceLanguage.jsx` is shared by the title bar and Settings. Native dialog titles and region-selection instructions use the same catalog. Windows-owned picker buttons follow the OS display language.
- Keep icon proportions stable and test long French/Russian labels at narrow widths. Language autonyms are intentionally shown in their own scripts.

## Verification

```powershell
npm test
npm run build
$env:PYTHONIOENCODING='utf-8'
.venv\Scripts\python.exe -B -m unittest discover -s tests -p 'test_*.py'
```

For real Electron integration tests, first start Vite on port 5197. Set `LISHON_TEST_MODELS` to a folder containing all 14 direct translation directions and Whisper Base:

```powershell
$env:LISHON_TEST_MODELS='C:\Models\Lishon'
node tests/international-ui.cjs
node tests/international-details.cjs
```

The suite creates an isolated temporary profile and uses the source Python engine by default. It never reads the installed application's API credentials. `LISHON_ENGINE_EXE` and `LISHON_NATIVE_EXE` may optionally point to separately built test runtimes. `LISHON_UI_URL` overrides the Vite address. `LISHON_SCREENSHOTS` chooses the screenshot output folder; otherwise screenshots remain in the temporary evidence directory.

Set `LISHON_TEST_FILE_MODE=1` when running `international-details.cjs` to test the built `dist/` files without Vite. This production-file startup path was also verified.

Coverage includes six languages across seven pages, top/settings synchronization, preservation of content languages and translated text, reload persistence, live caption controls, two window widths and both themes. Secondary checks cover palettes, library filters, badges and dictionary controls. AI adapter tests use local fixtures; they do not prove a paid provider's current translation quality.

真实屏幕 OCR、声音采集、不同显卡的磨砂效果，以及外部 API 的网络可用性受设备与服务环境影响。本次国际化验收不代表所有硬件和 API 服务均已重新验证。

## Optional future packaging

`scripts/build.ps1` is the existing full offline installer pipeline. It downloads substantial model data and builds an installer. **It is not required to run from source and was not run for this internationalization delivery.** The international edition has a separate application ID and data directory. Installer UI localization is separate from runtime UI localization; the current NSIS configuration still uses Chinese installer text.

Before distributing any binary, verify the full installation/uninstallation flow and preserve the exact third-party licenses accompanying dependencies and weights. See [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md).

## Repository contents

Commit source, public configuration, tests, documentation and demonstration screenshots. `.gitignore` excludes development environments, generated binaries, model archives, downloaded dictionary inputs, generated databases, logs and local settings. Do not copy personal API configurations or user libraries into the repository.
