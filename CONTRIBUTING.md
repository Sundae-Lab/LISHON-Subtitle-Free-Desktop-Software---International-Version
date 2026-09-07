# Contributing / 参与贡献

[English overview](README.md) · [中文介绍](README.zh-CN.md)

Please open an issue describing the behavior, Windows version, interface language, and reproduction steps before proposing a substantial change. For wording corrections, include the original label and suggested translation. Screenshots should not contain API keys, personal files, audio transcripts or private library records.

请先说明问题、Windows 版本、界面语言和复现步骤。文案修改请附上原文和建议译法；截图中请移除密钥、个人文件和私人语库内容。

1. Create a topic branch and keep the change focused.
2. Update the five translations in `shared/messages.json` when adding a Chinese message key. Preserve `{0}`, `{1}` placeholders; do not translate user content or model IDs.
3. Run `npm test` and `npm run build`. For desktop changes, use an isolated `LINGUA_DATA_DIR` and run the relevant Windows regression test.
4. Describe the change, evidence and remaining limitations in the pull request.

新增界面文案时，请在 `shared/messages.json` 中补齐英、日、韩、法、俄五种译文，保留占位符，不翻译用户内容或模型 ID。界面语言与内容语言必须独立。

Contributions are submitted under Apache-2.0 unless explicitly agreed otherwise. Preserve third-party attribution and license files. Do not commit model weights, generated databases, dependency folders, API keys or personal settings.
