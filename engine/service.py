"""Local stdio RPC worker. No listening network port; downloads are explicit commands."""
import base64
import concurrent.futures
import io
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tempfile
import threading
import time
import zipfile

import requests
from collections import OrderedDict
import lexicon
from model_downloads import CATALOG, download, verified
from speech_models import SpeechModels
from context_terms import enrich
alignment_cache=OrderedDict()
# Initialize native numerical libraries on the main thread before blocking on stdin.
# On Windows loading NumPy DLLs for the first time on a pool thread can deadlock.
import ctranslate2
import cv2
import sentencepiece
from faster_whisper import WhisperModel

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / '.lingua-models').resolve()
ROOT.mkdir(parents=True, exist_ok=True)
speech_models = SpeechModels(ROOT, CATALOG['speech'], os.environ.get('LISHON_LEGACY_MODEL_DIR'))
LANGUAGES = {'en': 'English', 'zh': '中文', 'ja': '日本語', 'ko': '한국어', 'fr': 'Français', 'de': 'Deutsch', 'es': 'Español', 'ru': 'Русский'}
write_lock = threading.Lock()
inference_lock = threading.Lock()
download_lock = threading.RLock()
translators = {}
whisper = None

def emit(value):
    with write_lock:
        print(json.dumps(value, ensure_ascii=False), flush=True)

def progress(message, percent=None):
    emit({'event': 'download', 'message': message, 'percent': percent})

def package_dirs():
    found = {}
    for meta in (ROOT / 'translation').glob('*/metadata.json'):
        try:
            data = json.loads(meta.read_text(encoding='utf-8'))
            if (meta.parent / 'model' / 'model.bin').is_file() and any((meta.parent / name).is_file() for name in ['sentencepiece.model', 'bpe.model']):
                found[(data['from_code'], data['to_code'])] = meta.parent
        except (ValueError, KeyError, OSError):
            continue
    return found

def status():
    pairs = package_dirs()
    return {'path': str(ROOT), 'pairs': [list(p) for p in pairs], 'speech': speech_models.ready(), 'languages': LANGUAGES}

def safe_extract(archive, target):
    target = target.resolve()
    with zipfile.ZipFile(archive) as z:
        if sum(item.file_size for item in z.infolist()) > 4 * 1024 ** 3:
            raise ValueError('模型解压尺寸异常')
        for info in z.infolist():
            if not (target / info.filename).resolve().is_relative_to(target):
                raise ValueError('模型包含不安全路径')
            if (info.external_attr >> 16) & 0o170000 == 0o120000:
                raise ValueError('模型包含符号链接')
        z.extractall(target)

def install_language(code, upgrade=False):
    if code not in LANGUAGES or code == 'en':
        raise ValueError('请选择中文或其他语言包')
    with download_lock:
        progress('正在读取内置语言包目录，无需连接 GitHub')
        index = CATALOG['translation']
        folder = ROOT / 'translation'
        folder.mkdir(exist_ok=True)
        for source, target in [('en', code), (code, 'en')]:
            current = package_dirs().get((source, target))
            if current and not upgrade:
                continue
            candidates = [p for p in index if p['from_code'] == source and p['to_code'] == target]
            if not candidates:
                raise ValueError(f'官方目录暂未提供 {source} → {target}')
            version = lambda p: tuple(int(n) for n in re.findall(r'\d+', str(p.get('package_version', '0'))))
            pkg = max(candidates, key=version)
            if current and version(json.loads((current / 'metadata.json').read_text(encoding='utf-8'))) >= version(pkg):
                progress(f'{source} → {target} 已达到内置目录版本')
                continue
            archive = ROOT / '.downloads' / pkg['name']
            download(pkg, archive, f'下载 {source} → {target}', progress)
            with tempfile.TemporaryDirectory(dir=ROOT) as staging:
                staging = Path(staging)
                try:
                    safe_extract(archive, staging / 'unpack')
                except (zipfile.BadZipFile, ValueError):
                    archive.unlink(missing_ok=True)
                    raise ValueError('翻译包解压校验失败，请重新下载或导入离线包')
                meta = next((staging / 'unpack').rglob('metadata.json'))
                data = json.loads(meta.read_text(encoding='utf-8'))
                if data['from_code'] != source or data['to_code'] != target:
                    raise ValueError('语言包内容不匹配')
                if not any((meta.parent / name).is_file() for name in ['sentencepiece.model', 'bpe.model']) or not (meta.parent / 'model' / 'model.bin').exists():
                    raise ValueError('语言包缺少模型文件')
                final = folder / f'{source}_{target}'
                with inference_lock:
                    # Retain the old package outside the active model directory for recovery.
                    import gc
                    translators.pop((source, target), None)
                    gc.collect()
                    backup = None
                    if final.exists():
                        backups = ROOT / 'backups'
                        backups.mkdir(exist_ok=True)
                        backup = backups / f'{source}_{target}_{time.time_ns()}'
                        final.rename(backup)
                    try: shutil.move(str(meta.parent), final)
                    except Exception:
                        if backup and not final.exists(): backup.rename(final)
                        raise
            archive.unlink(missing_ok=True)
        progress('语言包安装完成', 100)
        return status()

def install_speech():
    with download_lock:
        dest = ROOT / 'speech' / 'base'
        if speech_models.ready():
            return status()
        dest.mkdir(parents=True, exist_ok=True)
        for item in CATALOG['speech']:
            download(item, dest / item['name'], '下载语音模型 ' + item['name'], progress)
        # Never expose a partially downloaded model as installed.
        if not all(verified(dest / item['name'], item) for item in CATALOG['speech']):
            raise ValueError('语音包校验失败，请重试')
        (dest / '.ready').write_text('base', encoding='utf-8')
        progress('语音模型安装完成', 100)
        return status()


def import_models(path):
    """Import the distributed, hash-pinned basic pack without any network request."""
    basic = [p for p in CATALOG['translation'] if 'zh' in (p['from_code'], p['to_code'])]
    entries = basic + CATALOG['speech']
    with download_lock, tempfile.TemporaryDirectory(dir=ROOT) as temp:
        staging = Path(temp)
        progress('正在校验基础离线包')
        with zipfile.ZipFile(path) as archive:
            names = archive.namelist()
            allowed = {p['name'] for p in entries} | {'README.txt', 'WHISPER-LICENSE.txt'}
            if len(names) != len(set(names)) or set(names) - allowed:
                raise ValueError('离线包格式不匹配，请选择 Lishon 基础离线语言包')
        safe_extract(path, staging)
        for item in entries:
            if not item.get('sha256') or not verified(staging / item['name'], item):
                raise ValueError(f'离线包缺失或校验失败：{item["name"]}')
        cache = ROOT / '.downloads'
        cache.mkdir(exist_ok=True)
        for item in basic:
            shutil.copyfile(staging / item['name'], cache / item['name'])
        install_language('zh')
        speech = ROOT / 'speech' / 'base'
        if not speech_models.ready():
            speech.mkdir(parents=True, exist_ok=True)
            for item in CATALOG['speech']:
                shutil.copyfile(staging / item['name'], speech / item['name'])
            install_speech()
        for item in basic:
            (cache / item['name']).unlink(missing_ok=True)
        progress('基础离线包导入完成，无需联网', 100)
        return status()

def detect(text):
    if re.search('[ぁ-ヿ]', text): return 'ja'
    if re.search('[가-힣]', text): return 'ko'
    if re.search('[\u4e00-\u9fff]', text): return 'zh'
    if re.search('[А-яЁё]', text): return 'ru'
    return 'en'

def translate_direct(text, source, target):
    key = (source, target)
    if key not in translators:
        import ctranslate2
        import sentencepiece
        folder = package_dirs().get(key)
        if folder is None:
            raise ValueError(f'本地未安装 {LANGUAGES.get(source, source)} → {LANGUAGES.get(target, target)} 直译包。请在「语言与模型」查看已安装方向，或启用 AI 直接翻译；不会使用英语中转。')
        if (folder / 'sentencepiece.model').is_file():
            # SentencePiece's Windows file loader cannot open every Unicode path.
            processor = sentencepiece.SentencePieceProcessor(model_proto=(folder / 'sentencepiece.model').read_bytes())
        else:
            from bpe_processor import BPEProcessor
            processor = BPEProcessor(folder / 'bpe.model', source, target)
        model = ctranslate2.Translator(str(folder / 'model'), device='cpu', compute_type='int8', inter_threads=1, intra_threads=4)
        translators[key] = (model, processor)
    model, sp = translators[key]
    # Preserve paragraph context instead of translating punctuation fragments independently.
    text = text.replace('\r\n','\n')
    model_input,source_positions=enrich(text,source)
    proto=sp.encode(model_input,out_type='immutable_proto')
    pieces=list(proto.pieces)
    outputs=[];links=[];target_base=0
    for offset in range(0,len(pieces),384):
        group=pieces[offset:offset+384]
        result=model.translate_batch([[p.piece for p in group]],beam_size=5,max_decoding_length=1024,disable_unk=True,return_attention=True)[0]
        hypothesis=result.hypotheses[0];decoded=sp.decode(hypothesis).replace('▁',' ').strip()
        separator=' ' if outputs and target not in ['zh','ja'] else ''
        target_base+=len(separator);outputs.append(separator+decoded)
        attention=result.attention[0] if result.attention else []
        prefixes=[sp.decode(hypothesis[:i]).replace('▁',' ').strip() for i in range(len(hypothesis)+1)]
        for j,weights in enumerate(attention[:len(hypothesis)]):
            if not weights or not group:continue
            best=max(range(min(len(weights),len(group))),key=lambda i:weights[i])
            piece=group[best]
            if weights[best]<.12:continue
            mapped=source_positions[piece.begin:piece.end]
            if not mapped:continue
            links.append({'s0':min(p[0] for p in mapped),'s1':max(p[1] for p in mapped),'t0':target_base+len(prefixes[j]),'t1':target_base+len(prefixes[j+1])})
        target_base+=len(decoded)
    output=''.join(outputs)
    # Renderer offsets use UTF-16, including supplementary Unicode characters.
    utf16=lambda value,n:len(value[:n].encode('utf-16-le'))//2
    links=[{'s0':utf16(text,a['s0']),'s1':utf16(text,a['s1']),'t0':utf16(output,a['t0']),'t1':utf16(output,a['t1'])} for a in links]
    key=(text,source,target);alignment_cache[key]=links
    while len(alignment_cache)>24:alignment_cache.popitem(last=False)
    return output

def translate(text, source='en', target='zh', targets=None):
    if not isinstance(text, str) or len(text) > 5000: raise ValueError('每次最多翻译 5000 字符')
    source = detect(text) if source == 'auto' else source
    destinations = list(dict.fromkeys(targets or [target]))
    if not 1 <= len(destinations) <= 3 or source not in LANGUAGES or any(t not in LANGUAGES for t in destinations): raise ValueError('请选择 1 至 3 种支持的目标语言')
    start = time.monotonic()
    with inference_lock:
        outputs = []
        for destination in destinations:
            if source == destination or not text.strip(): output = text
            else: output = translate_direct(text, source, destination)
            alignment=alignment_cache.get((text,source,destination),[])
            if source==destination:
                alignment=[];position=0
                for ch in text:
                    end=position+len(ch.encode('utf-16-le'))//2;alignment.append({'s0':position,'s1':end,'t0':position,'t1':end});position=end
            outputs.append({'target': destination, 'translation': output,'alignment':alignment})
    return {'text': text, 'translation': outputs[0]['translation'], 'translations': outputs, 'source': source, 'target': destinations[0], 'ms': round((time.monotonic()-start)*1000)}

def transcribe(data):
    global whisper
    from faster_whisper import WhisperModel
    start = time.monotonic()
    if not speech_models.ready(): raise ValueError(f'当前目录缺少完整语音识别包：{ROOT}。请重新运行新版安装程序补齐，或在「语言与模型」导入基础离线包。')
    audio = data.get('path') or io.BytesIO(base64.b64decode(data['audio'], validate=True))
    with inference_lock:
        if whisper is None:
            whisper = WhisperModel(str(ROOT / 'speech' / 'base'), device='cpu', compute_type='int8', cpu_threads=4)
        segments, info = whisper.transcribe(audio, language=None if data.get('source') == 'auto' else data.get('source', 'en'), beam_size=3, initial_prompt=data.get('context','')[-240:] or None, vad_filter=True, vad_parameters={'min_silence_duration_ms': 350}, condition_on_previous_text=True)
        segments = list(segments)
    output = []
    for s in segments:
        if not s.text.strip(): continue
        # Cloud translation receives recognized text only; it must not depend on local translation packages.
        item = {'text': s.text.strip(), 'source': info.language} if data.get('recognizeOnly') else translate(s.text.strip(), info.language, data.get('target', 'zh'), data.get('targets'))
        item.update({'start': s.start, 'end': s.end})
        output.append(item)
        if data.get('path') and not data.get('recognizeOnly'): emit({'event': 'segment', 'job': data.get('job'), 'segment': item})
    return {'segments': output, 'source': info.language, 'ms': round((time.monotonic()-start)*1000)}

ocr_engine=None
def recognize_screen(x,y,width,height):
    global ocr_engine
    if width<10 or height<8 or width*height>10000000:raise ValueError('字幕区域尺寸不合适，请重新框选')
    from PIL import ImageGrab,ImageOps
    from rapidocr_onnxruntime import RapidOCR
    import numpy as np
    import ctypes
    old=ctypes.windll.user32.SetThreadDpiAwarenessContext(ctypes.c_void_p(-4))
    try:image=ImageGrab.grab(bbox=(int(x),int(y),int(x+width),int(y+height)),all_screens=True)
    finally:ctypes.windll.user32.SetThreadDpiAwarenessContext(ctypes.c_void_p(old))
    if height<300 and width<1600:image=image.resize((width*2,height*2))
    image=ImageOps.autocontrast(image.convert('RGB'))
    with inference_lock:
        if ocr_engine is None:ocr_engine=RapidOCR(intra_op_num_threads=2,inter_op_num_threads=1,text_score=0.0)
        result,_=ocr_engine(np.array(image),use_cls=False)
    groups=[]
    for box,text,score in sorted(result or [],key=lambda r:min(p[1] for p in r[0])):
        x0=min(p[0] for p in box);x1=max(p[0] for p in box);y0=min(p[1] for p in box);y1=max(p[1] for p in box);cy=(y0+y1)/2
        found=next((g for g in groups if abs(g['cy']-cy)<max(g['height'],y1-y0)*.6),None)
        if found is None:found={'cy':cy,'height':y1-y0,'boxes':[]};groups.append(found)
        found['boxes'].append((x0,y0,x1,y1,text,float(score)))
    lines=[]
    for g in groups:
        boxes=sorted(g['boxes']);x0=max(0,int(min(b[0] for b in boxes))-4);y0=max(0,int(min(b[1] for b in boxes))-4);x1=min(image.width,int(max(b[2] for b in boxes))+4);y1=min(image.height,int(max(b[3] for b in boxes))+4)
        text=' '.join(b[4] if b[5]>=.65 else ' ' for b in boxes);score=sum(b[5] for b in boxes)/len(boxes)
        # Re-read each detected line as a whole to preserve word order and avoid overlapping fragments.
        with inference_lock:line_result,_=ocr_engine(np.array(image.crop((x0,y0,x1,y1))),use_det=False,use_cls=False)
        if line_result and line_result[0][1]>=.65:text,score=line_result[0]
        text=re.sub('[\ufffd\u25a1*]',' ',text)
        text=re.sub(r'\?{2,}|(?<=\w)\?(?=\w)',' ',text)
        if score<.65 or re.fullmatch(r'[?*\s]+',text):text=''
        lines.append(text)
    return {'text':'\n'.join(lines),'engine':'RapidOCR','lines':len(lines)}

def dispatch(command, args):
    if command == 'ocr': return recognize_screen(**args)
    if command == 'library': return lexicon.library(**args)
    if command == 'lookup':
        if args.get('source')=='auto':args['source']=detect(args.get('term',''))
        with inference_lock: return lexicon.lookup(**args,translate=translate_direct)
    if command == 'status': return status()
    if command == 'translate': return translate(**args)
    if command == 'install-language': return install_language(args['code'], args.get('upgrade', False))
    if command == 'install-speech': return install_speech()
    if command == 'import-models': return import_models(args['path'])
    if command == 'transcribe': return transcribe(args)
    raise ValueError('未知指令')

def handle(request):
    try: emit({'id': request['id'], 'result': dispatch(request['command'], request.get('args', {}))})
    except Exception as exc: emit({'id': request.get('id'), 'error': str(exc)})

if __name__ == '__main__':
    if os.environ.get('LINGUA_DEBUG'):
        import faulthandler
        faulthandler.dump_traceback_later(10)
    if hasattr(sys.stdout, 'reconfigure'): sys.stdout.reconfigure(encoding='utf-8')
    if hasattr(sys.stdin, 'reconfigure'): sys.stdin.reconfigure(encoding='utf-8')
    emit({'event': 'ready'})
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for line in sys.stdin:
            try: pool.submit(handle, json.loads(line))
            except ValueError: pass
