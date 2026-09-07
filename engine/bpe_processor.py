"""Adapter for official Argos Moses/BPE packages, including source-word alignment."""
from difflib import SequenceMatcher
from html import unescape
from types import SimpleNamespace

from sacremoses import MosesTokenizer, MosesDetokenizer, MosesPunctNormalizer
from subword_nmt.apply_bpe import BPE


class BPEProcessor:
    def __init__(self, model_file, source, target):
        self.normalizer = MosesPunctNormalizer(lang=source)
        self.tokenizer = MosesTokenizer(lang=source)
        self.detokenizer = MosesDetokenizer(lang=target)
        with open(model_file, encoding='utf-8') as stream:
            self.bpe = BPE(stream)

    def encode(self, text, out_type='immutable_proto'):
        normalized = self.normalizer.normalize(text)
        positions = [(0, 0)] * len(normalized)
        for tag, i0, i1, j0, j1 in SequenceMatcher(None, text, normalized, autojunk=False).get_opcodes():
            for j in range(j0, j1):
                positions[j] = (i0 + j - j0, i0 + j - j0 + 1) if tag == 'equal' else (i0, i1)
        pieces, cursor = [], 0
        for token in self.tokenizer.tokenize(normalized):
            surface = unescape(token)
            start = normalized.find(surface, cursor)
            mapped = positions[start:start + len(surface)] if start >= 0 else []
            begin = min((p[0] for p in mapped), default=0)
            end = max((p[1] for p in mapped), default=0)
            if start >= 0:
                cursor = start + len(surface)
            for piece in self.bpe.segment_tokens([token]):
                pieces.append(SimpleNamespace(piece=piece, begin=begin, end=end))
        return [p.piece for p in pieces] if out_type is str else SimpleNamespace(pieces=pieces)

    def decode(self, pieces):
        return self.detokenizer.detokenize(' '.join(pieces).replace('@@ ', '').split())
