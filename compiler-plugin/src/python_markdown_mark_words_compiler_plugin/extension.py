from markdown import Extension
from markdown.preprocessors import Preprocessor
from markdown.blockprocessors import BlockProcessor
import xml.etree.ElementTree as etree

MARK_PREVENT_RECURSION = "\t\t\t\r\r\rMARK_PREVENT_RECURSION\r\r\r\t\t\t"

class MarkWordsExtension(Extension):
    def extendMarkdown(self, md):
        meta = {
            "document_offsets": []
        }
        md.preprocessors.register(CalculateDocumentOffsetPreprocessor(md, meta),
                                   'capture_document', 
                                   1000) # Highest priority is required because we need to calc words offset from original document
        md.parser.blockprocessors.register(MarkWordsBlockProcessor(md.parser, meta), 
                                           'mark_words',
                                           100) # high priority, usually larger than every other block processor

class CalculateDocumentOffsetPreprocessor(Preprocessor):
    def __init__(self, md, meta):
        super(CalculateDocumentOffsetPreprocessor, self).__init__(md)
        self.meta = meta
    
    def run(self, lines):
        offset = 0
        for line_num, line in enumerate(lines):
            # Skip empty lines
            if len(line) == 0:
                offset += 1
                continue
            # store the line and offset
            self.meta["document_offsets"].append((line, offset, offset + len(line)))
            ## plus 1 is for the newline character (\n), use the CRLF file is unknown behavior
            offset += (len(line) + 1)
        return lines


class MarkWordsBlockProcessor(BlockProcessor):
    def __init__(self, parser, meta):
        super(MarkWordsBlockProcessor, self).__init__(parser)
        self.meta = meta
    
    def test(self, parent, block):
        ## Test if there is any line in the block
        for line in [line for (line, _, _) in self.meta["document_offsets"]]:
            if line in block:
                return True
        return False
    
    def run(self, parent: etree.Element, blocks):
        block = blocks[0]
        
        ## If the first block is handled, remove the marker and return, so that other block processors can process it
        if MARK_PREVENT_RECURSION in blocks[0]:
            blocks[0] = blocks[0].replace(MARK_PREVENT_RECURSION, "")
            return False
        
        start = None
        end = None
        # Search for the block fragment in the document_offsets
        for (line, offset, end_offset) in self.meta["document_offsets"]:
            # If found one
            if line in block:
                # If none yet set, set the start offset
                if start is None:
                    start = offset
                    end = end_offset
                # Or, continuing searching for the end offset until the end of the block
                else:
                    end = end_offset
            # If end is not found but new line not in block, reset the search and restart from the next line
            elif end is None:
                start = None
                continue
            # If both start and end are both set and no continuously block found, break the loop
            else:
                break
        # If both start and end are found, store the result
        if start is not None and end is not None:
            blocks.pop(0)
            ## append MARK_PREVENT_RECURSION to tail of the block to prevent recursion, we don't use a handled flaglist because we don't know if there's some same block in the document
            self.parser.parseBlocks(parent, [block + MARK_PREVENT_RECURSION])
            parent[-1].set("data-original-document-start", str(start))
            parent[-1].set("data-original-document-end", str(end))
            return True
        return False