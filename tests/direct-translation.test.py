import ast
import time
from pathlib import Path
from contextlib import nullcontext
from unittest import TestCase, main

class DirectTranslation(TestCase):
    def test_non_english_pairs_never_pivot(self):
        tree=ast.parse((Path(__file__).parents[1]/'engine/service.py').read_text(encoding='utf-8'))
        function=next(n for n in tree.body if isinstance(n,ast.FunctionDef) and n.name=='translate')
        calls=[]
        def direct(text,source,target):
            calls.append((text,source,target))
            if target=='ko': raise ValueError('missing direct model')
            return '直接译文'
        env=dict(time=time,inference_lock=nullcontext(),translate_direct=direct,LANGUAGES={'zh':'中文','ja':'日语','en':'英语','ko':'韩语'},alignment_cache={})
        exec(compile(ast.Module(body=[function],type_ignores=[]),'translate','exec'),env)
        self.assertEqual(env['translate']('原文','zh','ja')['translation'],'直接译文')
        self.assertEqual(calls,[('原文','zh','ja')])
        with self.assertRaises(ValueError):env['translate']('原文','zh','ko')
        self.assertEqual(calls[-1],('原文','zh','ko'))
        self.assertFalse(any('en' in call[1:] for call in calls))
if __name__=='__main__': main()
