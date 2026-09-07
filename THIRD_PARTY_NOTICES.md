# Third-party components / 第三方组件

Lishon’s Apache-2.0 license applies to original project code. It does not relicense third-party software, data or weights. The source repository excludes installed dependencies and model weights. When redistributing binaries, retain the licenses supplied by each dependency and check the exact artifacts included in that build.

听现的 Apache-2.0 仅适用于原创代码，不改变第三方软件、数据及模型的许可。源码仓库不包含安装后的依赖和模型权重。分发二进制时，应保留对应构建产物附带的许可证。

| Component | Use | Upstream / license reference |
| --- | --- | --- |
| React, Electron, Vite | Interface and desktop runtime | Each package’s license in npm dependencies; Electron also includes Chromium notices. |
| Lucide | Interface icons | [Lucide license](https://github.com/lucide-icons/lucide/blob/main/LICENSE). |
| .NET / Windows App SDK interfaces | Native Windows integration | Runtime and SDK notices supplied by Microsoft. |
| CTranslate2 / Faster Whisper | Local model inference and speech recognition | [CTranslate2](https://github.com/OpenNMT/CTranslate2), [Faster Whisper](https://github.com/SYSTRAN/faster-whisper). |
| RapidOCR / ONNX Runtime / OpenCV | Screen recognition and image preprocessing | Notices supplied by their installed Python packages. |
| PyAV / FFmpeg | Audio and video decoding | Build-specific notices apply, including any enabled codec libraries. Do not assume every FFmpeg binary has identical licensing. |
| ECDICT | English/Chinese definitions and word forms | [Upstream](https://github.com/skywind3000/ECDICT), MIT text preserved in [ECDICT-LICENSE.txt](engine/data/ECDICT-LICENSE.txt). |
| WordNet 3.0 | Additional senses | Princeton University license preserved in [WORDNET-LICENSE.txt](engine/data/WORDNET-LICENSE.txt); [official terms](https://wordnet.princeton.edu/license-and-commercial-use). |
| Whisper Base | Optional speech weights | MIT notice preserved in [WHISPER-LICENSE.txt](engine/data/WHISPER-LICENSE.txt). |
| Argos translation models | Optional direct translation weights | Each downloaded archive includes its upstream author and license in README/metadata. The preparation script retains these files. |

Model sources and checksums are listed in `engine/data/model-sources.json`. Dictionary input sources are listed in `engine/data/dictionary-sources.json`. The generated SQLite dictionary remains derived third-party data, not newly Apache-licensed material.

The Lishon logo and screenshots are included as project documentation assets. Screenshots use demonstration content and contain no user API credentials. Third-party names identify integrations and do not imply endorsement.
