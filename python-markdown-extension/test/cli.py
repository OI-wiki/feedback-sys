import argparse
from argparse import FileType
import markdown

from pymdownx.emoji import to_svg
from pymdownx.slugs import uslugify
from pymdownx.arithmatex import fence_mathjax_format

parser = argparse.ArgumentParser("cli")
parser.add_argument(
    "file", help="Markdown file to be rendered", type=FileType(encoding="utf-8")
)
args = parser.parse_args()

result = markdown.markdown(
    args.file.read(),
    extensions=[
        "document-offsets-injection",
        "admonition",
        "def_list",
        "footnotes",
        "meta",
        "toc",
        "pymdownx.arithmatex",
        "pymdownx.caret",
        "pymdownx.critic",
        "pymdownx.details",
        "pymdownx.emoji",
        "pymdownx.highlight",
        "pymdownx.inlinehilite",
        "pymdownx.keys",
        "pymdownx.magiclink",
        "pymdownx.mark",
        "pymdownx.snippets",
        "pymdownx.progressbar",
        "pymdownx.smartsymbols",
        "pymdownx.superfences",
        "pymdownx.tasklist",
        "pymdownx.tilde",
        "pymdownx.tabbed",
    ],
    extension_configs={
        "toc": {
            "permalink": "",
            "slugify": uslugify,
        },
        "pymdownx.arithmatex": {
            "generic": True,
        },
        "pymdownx.emoji": {
            "emoji_generator": to_svg,
        },
        "pymdownx.highlight": {
            "linenums": True,
        },
        "pymdownx.snippets": {
            "check_paths": True,
        },
        "pymdownx.superfences": {
            "custom_fences": [
                {
                    "name": "math",
                    "class": "arithmatex",
                    "format": fence_mathjax_format,
                },
            ],
        },
        "pymdownx.tasklist": {
            "custom_checkbox": True,
        },
        "pymdownx.tabbed": {
            "alternate_style": True,
        },
    },
)

print(result)
