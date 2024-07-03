from markdown import Extension, Markdown
from markdown.preprocessors import Preprocessor
from markdown.blockprocessors import BlockProcessor
from markdown.blockparser import BlockParser
import xml.etree.ElementTree as etree

MARK_PREVENT_RECURSION: str = "\t\t\t\r\r\rMARK_PREVENT_RECURSION\r\r\r\t\t\t"


class MainExtension(Extension):
    def extendMarkdown(self, md: Markdown):
        meta: dict = {"document_offsets": [], "used_document_offsets": {}}
        md.preprocessors.register(
            CalculateDocumentOffsetPreprocessor(md, meta), "capture_document", 1000
        )  # Highest priority is required because we need to calc words offset from original document
        md.parser.blockprocessors.register(
            OffsetsInjectionBlockProcessor(md.parser, meta), "mark_words", 100
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
                offset += 1
                continue
            # store the line and offset
            store: tuple[str, int, int] = (line, offset, offset + len(line))
            self.meta["document_offsets"].append(store)
            self.meta["used_document_offsets"][store] = False
            # plus 1 is for the newline character (\n), use the CRLF file is unknown behavior
            offset += len(line) + 1
        return lines


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
            # If already used, skip
            if self.meta["used_document_offsets"][store]:
                continue
            (line, offset, end_offset) = store
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
            # append MARK_PREVENT_RECURSION to tail of the block to prevent recursion, we don't use a handled flaglist because we don't know if there's some same block in the document
            self.parser.parseBlocks(parent, [block + MARK_PREVENT_RECURSION])
            parent[-1].set("data-original-document-start", str(start))
            parent[-1].set("data-original-document-end", str(end))
            return True
        return False
