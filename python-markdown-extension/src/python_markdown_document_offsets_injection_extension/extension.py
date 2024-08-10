from markdown import Extension, Markdown
from markdown.preprocessors import Preprocessor
from markdown.blockprocessors import BlockProcessor
from markdown.blockparser import BlockParser
from difflib import SequenceMatcher
import xml.etree.ElementTree as etree
import logging

logging.basicConfig(format="%(levelname)s - %(message)s")
logger = logging.getLogger("document-offsets-injection")


class MainExtension(Extension):
    def __init__(self, **kwargs):
        self.config = {
            "debug": [False, "Debug mode"],
        }
        super(MainExtension, self).__init__(**kwargs)

    def extendMarkdown(self, md: Markdown):
        meta: dict = {
            "document": "",
            "document_offsets": [],
            "preprocessed_document": "",
            "preprocessed_document_restore_opcodes": [],
            "debug_enabled": self.getConfig("debug"),
        }
        md.preprocessors.register(
            CalculateDocumentOffsetPreprocessor(md, meta), "capture_document", 1000
        )  # Highest priority is required because we need to calc words offset from original document
        md.preprocessors.register(
            FixDocumentOffsetPreprocessor(md, meta), "fix_document", 0
        )  # Lowest priority is required because we need to fix the offset after all other block processors
        md.parser.blockprocessors.register(
            OffsetsInjectionBlockProcessor(md.parser, meta), "mark_words", 200
        )  # high priority, usually larger than every other block processor


class CalculateDocumentOffsetPreprocessor(Preprocessor):
    """
    A preprocessor to calculate the offset of each line in the document
    """

    def __init__(self, md: Markdown, meta: dict):
        super(CalculateDocumentOffsetPreprocessor, self).__init__(md)
        self.meta = meta

    def run(self, lines: list[str]) -> list[str]:
        self.meta["document"] = lines

        offset: int = 0
        for line in lines:
            # store the line and offset
            store: tuple[str, int, int] = (line, offset, offset + len(line))
            self.meta["document_offsets"].append(store)
            # plus 1 is for the newline character (\n), use the CRLF file is unknown behavior
            offset += len(line) + 1

        return lines


class FixDocumentOffsetPreprocessor(Preprocessor):
    """
    A preprocessor to fix the offset of each line after the 3rd party extension processed the document
    """

    def __init__(self, md: Markdown, meta: dict):
        super(FixDocumentOffsetPreprocessor, self).__init__(md)
        self.meta = meta

    def run(self, lines: list[str]) -> list[str]:
        self.meta["preprocessed_document"] = lines

        a = self.meta["preprocessed_document"]
        b = self.meta["document"]

        s = SequenceMatcher(lambda x: len(x) == 0, a, b)

        for tag, i1, i2, j1, j2 in s.get_opcodes():
            self.meta["preprocessed_document_restore_opcodes"].append(
                (tag, i1, i2, j1, j2)
            )

        return lines


class OffsetsInjectionBlockProcessor(BlockProcessor):
    """
    A block processor to mark the words in the document and inject the offset of the block to the HTML element
    """

    last_processed_line_idx: int = -1

    is_in_prerender: bool = False

    def __init__(self, parser: BlockParser, meta: dict):
        super(OffsetsInjectionBlockProcessor, self).__init__(parser)
        self.meta = meta

    def test(self, _, block) -> bool:
        if self.is_in_prerender:
            return False
        for i in range(0, len(self.meta["preprocessed_document"])):
            line: str = self.meta["preprocessed_document"][i]
            if len(line) == 0:
                continue
            if line in block:
                # 如果该行在块中，且该行的索引大于上次处理的索引，从此块开始处理
                return i > self.last_processed_line_idx
        # 如果始终找不到符合条件的行，则不处理整个块
        return False

    def run(self, parent: etree.Element, blocks: list[str]):
        block: str = blocks[0]

        start: int = -1
        end: int = -1

        for i in range(
            self.last_processed_line_idx + 1, len(self.meta["preprocessed_document"])
        ):
            line: str = self.meta["preprocessed_document"][i]
            if len(line) == 0:
                continue
            if line in block:
                if start == -1:
                    start = i
                end = i + 1
                self.last_processed_line_idx = i
            elif start != -1:
                break

        if start == -1:
            return

        self.is_in_prerender = True
        previous_len = len(parent)
        self.parser.parseBlocks(parent, [block])
        parsed_len = len(parent)
        self.is_in_prerender = False

        blocks.pop(0)

        restored_start = -1
        restored_end = -1
        restored_accurate = (False, False)

        # 查找删除行
        for _, i1, i2, j1, j2 in [
            r
            for r in self.meta["preprocessed_document_restore_opcodes"]
            if r[0] == "delete"
        ]:
            # 如果删除的行在开始和结束之间，就更新开始和结束的行号
            if i1 <= start < i2:
                start = i2
            if i1 < end <= i2:
                end = i1
            # 如果这导致开始大于结束，则没有与之匹配的原文档行，直接返回
            if start >= end:
                return

        for tag, i1, i2, j1, j2 in self.meta["preprocessed_document_restore_opcodes"]:
            # 插入行（原文档有但处理后文档没有）无意义，直接跳过
            if tag == "insert":
                continue
            # 模糊匹配替换行
            if tag == "replace":
                if i1 <= start < i2:
                    restored_start = j1
                if i1 < end <= i2:
                    restored_end = j2

        # 匹配相等行
        for _, i1, i2, j1, j2 in [
            r
            for r in self.meta["preprocessed_document_restore_opcodes"]
            if r[0] == "equal"
        ]:
            if i1 <= start < i2:
                restored_start = j1 + start - i1
                restored_accurate = (True, restored_accurate[1])
            if i1 < end <= i2:
                restored_end = j1 + end - i1
                restored_accurate = (restored_accurate[0], True)

        if restored_start == -1 or restored_end == -1:
            if self.meta["debug_enabled"]:
                logger.error(
                    "Failed to restore the document offsets for the block {}-{}, restored {}-{}".format(
                        start, end, restored_start, restored_end
                    )
                )
            return

        offset_start = self.meta["document_offsets"][restored_start][1]
        offset_end = self.meta["document_offsets"][restored_end - 1][2]

        if previous_len == parsed_len and len(parent) > 0:
            child = parent[-1]
            if child.get("data-original-document-start") is None:
                child.set("data-original-document-start", str(offset_start))
                if self.meta["debug_enabled"]:
                    logger.warning(
                        "Trying to patch a block without original document start, patching to current block offset in {}-{}".format(
                            offset_start, offset_end
                        )
                    )
            child.set("data-original-document-end", str(offset_end))
            if self.meta["debug_enabled"]:
                child.set(
                    "data-original-document",
                    child.get("data-original-document", "")
                    + "\n".join(self.meta["document"])[offset_start:offset_end],
                )
                child.set("data-offset-accurate-end", str(restored_accurate[1]).lower())

        for i in range(parsed_len - previous_len):
            child = parent[-1 - i]
            child.set("data-original-document-start", str(offset_start))
            child.set("data-original-document-end", str(offset_end))
            if self.meta["debug_enabled"]:
                child.set(
                    "data-original-document",
                    "\n".join(self.meta["document"])[offset_start:offset_end],
                )
                child.set(
                    "data-offset-accurate-start", str(restored_accurate[0]).lower()
                )
                child.set("data-offset-accurate-end", str(restored_accurate[1]).lower())
