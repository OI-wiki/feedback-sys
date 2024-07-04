import re
from markdown import Extension, Markdown
from markdown.preprocessors import Preprocessor
from markdown.blockprocessors import BlockProcessor
from markdown.blockparser import BlockParser
import xml.etree.ElementTree as etree

MARK_PREVENT_RECURSION: str = "\t\t\t\r\r\rMARK_PREVENT_RECURSION\r\r\r\t\t\t"

MARK_CONTINUE: str = "\t\t\t\r\r\rMARK_CONTINUE\r\r\r\t\t\t"

# @see: markdown.util.HTML_PLACEHOLDER_RE
# PYTHON_MARKDOWN_HTML_PLACEHOLDER_RE: re.Pattern[str] = re.compile(
#     "\u0002wzxhzdk:%s\u0003" % r"([0-9]+)"
# )


class MainExtension(Extension):
    def extendMarkdown(self, md: Markdown):
        meta: dict = {
            "document_offsets": [],
            "used_document_offsets": {},
            "last_parent": None,
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
        offset: int = 0
        for line in lines:
            # Skip empty lines
            if len(line) == 0:
                store: tuple[str, int, int] = (line, offset, offset + 1)
                self.meta["document_offsets"].append(store)
                self.meta["used_document_offsets"][store] = False
                offset += 1
                continue
            # store the line and offset
            store: tuple[str, int, int] = (line, offset, offset + len(line))
            self.meta["document_offsets"].append(store)
            self.meta["used_document_offsets"][store] = False
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
        document_offsets: list[tuple[str, int, int]] = self.meta["document_offsets"]

        # 最后一次成功匹配的文档偏移量字典索引末，开区间
        last_success_match_end: int = 0
        num_lines: int = 0
        num_document_offsets: int = 0
        while num_document_offsets < len(document_offsets) and num_lines < len(lines):
            line = lines[num_lines]
            document_offset: tuple[str, int, int] = document_offsets[
                num_document_offsets
            ]

            # 如果精准匹配
            if document_offset[0] == line:
                # 匹配该行
                self.match(line, num_document_offsets, num_document_offsets + 1)
                # 如果上次成功匹配的原文档偏移量未连续，匹配当前行到这部分未连续的原文档偏移量
                if num_document_offsets > last_success_match_end and num_lines > 0:
                    self.match(
                        lines[num_lines - 1],
                        last_success_match_end,
                        num_document_offsets,
                    )
                last_success_match_end = num_document_offsets + 1
                num_lines += 1
                num_document_offsets += 1
            # 如果未能精准匹配，查找该行在原文档偏移量字典中的位置
            else:
                remain: list[str] = [
                    line for line, _, _ in document_offsets[num_document_offsets:]
                ]
                # 如果存在这样的行
                if line in remain:
                    # 找到第一次匹配的位置，匹配该行到此处
                    idx = remain.index(line) + num_document_offsets
                    self.match(line, idx, idx + 1)
                    # 如果上次成功匹配的原文档偏移量未连续，匹配当前行到这部分未连续的原文档偏移量
                    if idx > last_success_match_end and num_lines > 0:
                        self.match(lines[num_lines - 1], last_success_match_end, idx)
                    last_success_match_end = idx + 1
                    num_lines += 1
                    num_document_offsets = idx + 1
                # 如果未找到匹配的位置，继续查找下一行
                else:
                    num_lines += 1

        # 如果行匹配完成，但原文档偏移量未匹配完成，匹配剩余的原文档偏移量
        if last_success_match_end < len(document_offsets):
            self.match(
                lines[num_lines - 1], last_success_match_end, len(document_offsets)
            )

        return lines

    def match(
        self,
        matched_line: str,
        num_document_offsets_start: int,
        num_document_offsets_end: int,
    ):
        """
        将单个匹配行设置到多个原文档偏移量字典，索引范围为[num_document_offsets_start, num_document_offsets_end)
        """
        document_offsets: list[tuple[str, int, int]] = self.meta["document_offsets"]
        used_document_offsets: dict[tuple[str, int, int], bool] = self.meta[
            "used_document_offsets"
        ]
        for i in range(num_document_offsets_start, num_document_offsets_end):
            document_offset = document_offsets[i]
            # 如果是第一个匹配的原文档偏移量，设置为匹配行，否则设置为 MARK_CONTINUE
            if i == num_document_offsets_start:
                document_offsets[i] = (
                    matched_line,
                    document_offset[1],
                    document_offset[2],
                )
            else:
                document_offsets[i] = (
                    MARK_CONTINUE,
                    document_offset[1],
                    document_offset[2],
                )
            del used_document_offsets[document_offset]
            used_document_offsets[document_offsets[i]] = False


class OffsetsInjectionBlockProcessor(BlockProcessor):
    """
    A block processor to mark the words in the document and inject the offset of the block to the HTML element
    """

    def __init__(self, parser: BlockParser, meta: dict):
        super(OffsetsInjectionBlockProcessor, self).__init__(parser)
        self.meta = meta

    def test(self, _, block) -> bool:
        # Test if there is any line in the block
        for line in [line for (line, _, _) in self.meta["document_offsets"]]:
            if line in block:
                return True
        return False

    def run(self, parent: etree.Element, blocks: list[str]) -> bool:
        """
        注入文档中的偏移量到HTML元素中，以便在后续的处理中可以使用这些偏移量来定位文档中的位置。目前的算法如下：
        1. 从文档中查找第一个包含文本的块
        2. 查找这个块在文档中的位置，这通过遍历文档中的每一行，以找到所有被包含在该块中的行，通过获取这些行的起始和结束位置，来确定这个块在文档中的位置
        3. 注入这个块的起始和结束位置到HTML元素中，这会先递归的解析这个块，然后再注入这个块的起始和结束位置注入到最后一个被生成的HTML元素中
        由于递归解析块时该块仍会被本处理器捕获，为了避免循环递归，我们在块的末尾添加了MARK_PREVENT_RECURSION标记，当本处理器再次捕获到这个块时，会直接跳过这个块，并清除这个标记。
        """

        block: str = blocks[0]

        # If the first block is handled, remove the marker and return, so that other block processors can process it
        if MARK_PREVENT_RECURSION in blocks[0]:
            blocks[0] = blocks[0].replace(MARK_PREVENT_RECURSION, "")
            return False

        start: int | None = None
        end: int | None = None
        used: dict[tuple[str, int, int], bool] = {}
        # Search for the block fragment in the document_offsets
        for store in self.meta["document_offsets"]:
            # Skip empty lines
            if len(store[0]) == 0:
                continue
            # If already used, skip
            if self.meta["used_document_offsets"][store]:
                continue
            (line, offset, end_offset) = store
            # 如果收到 MARK_CONTINUE 标记，直接认为该标记之前的行是连续的
            if line == MARK_CONTINUE:
                end = end_offset
                used[store] = True
                continue
            # If found one
            if line in block:
                # If the line already scanned (usually some lines with same content in different place), skip
                if line in [line for (line, _, _) in used.keys()]:
                    continue
                # If none yet set, set the start offset
                if start is None:
                    start = offset
                    end = end_offset
                # Or, continuing searching for the end offset until the end of the block
                else:
                    end = end_offset
                # Mark the fragment as used
                used[store] = True
            # If end is not found but new line not in block, reset the search and restart from the next line
            elif end is None:
                start = None
                # Clear the used list
                used = {}
                continue
            # If both start and end are both set and no continuously block found, break the loop
            else:
                break
        # If both start and end are found, store the result
        if start is not None and end is not None:
            blocks.pop(0)
            self.meta["used_document_offsets"].update(used)
            # append MARK_PREVENT_RECURSION to tail of the block to prevent recursion, we don't use a handled
            # flaglist because we don't know if there's some same block in the document
            self.parser.parseBlocks(parent, [block + MARK_PREVENT_RECURSION])
            # fix multi blocks in same parents
            if self.meta["last_parent"] == parent[-1]:
                parent[-1].set("data-original-document-end", str(end))
                return True
            parent[-1].set("data-original-document-start", str(start))
            parent[-1].set("data-original-document-end", str(end))
            self.meta["last_parent"] = parent[-1]
            return True
        return False
