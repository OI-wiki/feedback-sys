import textwrap
import unittest
import markdown
from html.parser import HTMLParser

from pymdownx.emoji import to_svg
from pymdownx.slugs import uslugify
from pymdownx.arithmatex import fence_mathjax_format


class Tester:
    def __init__(self, case, test_case: unittest.TestCase):
        self.case = case
        """
        @see: https://github.com/OI-wiki/OI-wiki/blob/65983038c40716dd0644778fe7875e91c9043618/mkdocs.yml#L586
        
        # Extensions
        markdown_extensions:
          - admonition
          - def_list
          - footnotes
          - meta
          - toc:
              permalink: ""
              slugify: !!python/name:pymdownx.slugs.uslugify
          - pymdownx.arithmatex:
              generic: true
          - pymdownx.caret
          - pymdownx.critic
          - pymdownx.details
          - pymdownx.emoji:
              emoji_generator: !!python/name:pymdownx.emoji.to_svg
          - pymdownx.highlight:
              linenums: true
          - pymdownx.inlinehilite
          - pymdownx.keys
          - pymdownx.magiclink
          - pymdownx.mark
          - pymdownx.snippets:
              check_paths: true
          - pymdownx.progressbar
          - pymdownx.smartsymbols
          - pymdownx.superfences:
              custom_fences:
                - name: math
                  class: arithmatex
                  format: !!python/name:pymdownx.arithmatex.fence_mathjax_format
          - pymdownx.tasklist:
              custom_checkbox: true
          - pymdownx.tilde
          - pymdownx.tabbed:
              alternate_style: true
        """
        self.result = markdown.markdown(
            self.case["document"],
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
        self.test_case = test_case

    def test(self):
        tester = ParserTester(self.case, self.test_case)
        tester.feed(self.result)
        tester.check_integrity()


class ParserTester(HTMLParser):
    tag = None
    offset_start = None
    offset_end = None

    def __init__(self, case, test_case: unittest.TestCase):
        super().__init__()
        self.test_case = test_case
        self.case = case
        self.idx = 0

    def handle_starttag(self, tag, attrs):
        start = None
        end = None
        for attr in attrs:
            if attr[0] == "data-original-document-start":
                start = int(attr[1])
            if attr[0] == "data-original-document-end":
                end = int(attr[1])
        if start is not None and end is not None:
            self.tag = tag
            self.offset_start = start
            self.offset_end = end

    def handle_endtag(self, tag):
        if self.tag != tag:
            return  # ignore nested tags
        if self.idx == len(self.case["expected"]):
            return  # ignore extra tags
        self._test()
        self._reset()

    def _test(self):
        self.test_case.assertEqual(
            self.tag,
            self.case["expected"][self.idx]["tag"],
            msg="Tag mismatch in index " + str(self.idx),
        )
        self.test_case.assertEqual(
            self.offset_start,
            self.case["expected"][self.idx]["offset"][0],
            msg="Offset start mismatch in index " + str(self.idx),
        )
        self.test_case.assertEqual(
            self.offset_end,
            self.case["expected"][self.idx]["offset"][1],
            msg="Offset end mismatch in index " + str(self.idx),
        )
        self.idx += 1

    def _reset(self):
        self.tag = None
        self.offset_start = None
        self.offset_end = None

    def check_integrity(self):
        self.test_case.assertEqual(
            self.idx,
            len(self.case["expected"]),
            msg="Not all tags were found",
        )


class TestParser(unittest.TestCase):
    def test_normal(self):
        case = {
            "document": textwrap.dedent("""\
                    # Lorem ipsum

                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin sed lacus vitae neque vestibulum porttitor id et urna.

                    ## Morbi neque lectus

                    Morbi neque lectus, faucibus a mattis at, aliquam quis est. Maecenas sed luctus elit."""),
            "expected": [
                {"tag": "h1", "offset": (0, 13)},
                {
                    "tag": "p",
                    "offset": (15, 132),
                },
                {"tag": "h2", "offset": (134, 155)},
                {
                    "tag": "p",
                    "offset": (157, 242),
                },
            ],
        }
        Tester(case, self).test()

    def test_empty(self):
        case = {
            "document": "",
            "expected": [],
        }
        Tester(case, self).test()

    def test_single(self):
        case = {
            "document": "Lorem ipsum",
            "expected": [
                {"tag": "p", "offset": (0, 11)},
            ],
        }
        Tester(case, self).test()

    def test_oi_wiki_index(self):
        case = {
            "document": textwrap.dedent("""\
                disqus:
                pagetime:
                title: OI Wiki

                ## 欢迎来到 **OI Wiki**！[![GitHub watchers](https://img.shields.io/github/watchers/OI-wiki/OI-wiki.svg?style=social&label=Watch)](https://github.com/OI-wiki/OI-wiki)  [![GitHub stars](https://img.shields.io/github/stars/OI-wiki/OI-wiki.svg?style=social&label=Stars)](https://github.com/OI-wiki/OI-wiki)

                [![Word Art](images/wordArt.webp)](https://github.com/OI-wiki/OI-wiki)

                **OI**（Olympiad in Informatics，信息学奥林匹克竞赛）在中国起源于 1984 年，是五大高中学科竞赛之一。

                **ICPC**（International Collegiate Programming Contest，国际大学生程序设计竞赛）由 ICPC 基金会（ICPC Foundation）举办，是最具影响力的大学生计算机竞赛。由于以前 ACM 赞助这个竞赛，也有很多人习惯叫它 ACM 竞赛。

                **OI Wiki** 致力于成为一个免费开放且持续更新的 **编程竞赛（competitive programming）** 知识整合站点，大家可以在这里获取与竞赛相关的、有趣又实用的知识。我们为大家准备了竞赛中的基础知识、常见题型、解题思路以及常用工具等内容，帮助大家更快速深入地学习编程竞赛中涉及到的知识。

                本项目受 [CTF Wiki](https://ctf-wiki.org/) 的启发，在编写过程中参考了诸多资料，在此一并致谢。

                <div align="center">
                <a href="https://www.netlify.com/" target="_blank" style="margin-left: 60px;"><img style="height: 40px; " src="images/netlify.png"></a>
                </div>

                <script>
                  // #758
                  document.getElementsByClassName('md-nav__title')[1].click()
                </script>"""),
            "expected": [
                {
                    "tag": "h2",
                    "offset": (34, 332),
                },
                {
                    "tag": "p",
                    "offset": (334, 404),
                },
                {
                    "tag": "p",
                    "offset": (406, 473),
                },
                {
                    "tag": "p",
                    "offset": (475, 620),
                },
                {
                    "tag": "p",
                    "offset": (622, 778),
                },
                {
                    "tag": "p",
                    "offset": (780, 1101),  # FIXME: Correct one is (780, 1101)
                },
            ],
        }
        Tester(case, self).test()

    def test_oi_wiki_search_dfs(self):
        case = {
            "document": textwrap.dedent("""\
                ## 引入

                DFS 为图论中的概念，详见 [DFS（图论）](../graph/dfs.md) 页面。在 **搜索算法** 中，该词常常指利用递归函数方便地实现暴力枚举的算法，与图论中的 DFS 算法有一定相似之处，但并不完全相同。

                ## 解释

                考虑这个例子：

                ???+ note "例题"
                    把正整数 $n$ 分解为 $3$ 个不同的正整数，如 $6=1+2+3$，排在后面的数必须大于等于前面的数，输出所有方案。

                对于这个问题，如果不知道搜索，应该怎么办呢？

                当然是三重循环，参考代码如下：

                ???+ note "实现"
                    === "C++"
                        ```cpp
                        for (int i = 1; i <= n; ++i)
                          for (int j = i; j <= n; ++j)
                            for (int k = j; k <= n; ++k)
                              if (i + j + k == n) printf("%d = %d + %d + %d\\n", n, i, j, k);
                        ```

                    === "Python"
                        ```python
                        for i in range(1, n + 1):
                            for j in range(i, n + 1):
                                for k in range(j, n + 1):
                                    if i + j + k == n:
                                        print("%d = %d + %d + %d" % (n, i, j, k))
                        ```

                    === "Java"
                        ```Java
                        for (int i = 1; i < n + 1; i++) {
                            for (int j = i; j < n + 1; j++) {
                                for (int k = j; k < n + 1; k++) {
                                    if (i + j + k == n) System.out.printf("%d = %d + %d + %d%n", n, i, j, k);
                                }
                            }
                        }
                        ```

                那如果是分解成四个整数呢？再加一重循环？"""),
            "expected": [
                {
                    "tag": "h2",
                    "offset": (0, 5),
                },
                {
                    "tag": "p",
                    "offset": (7, 117),
                },
                {
                    "tag": "h2",
                    "offset": (119, 124),
                },
                {
                    "tag": "p",
                    "offset": (126, 133),
                },
                {
                    "tag": "details",
                    "offset": (135, 215),
                },
                {
                    "tag": "p",
                    "offset": (217, 239),
                },
                {
                    "tag": "p",
                    "offset": (241, 256),
                },
                {
                    "tag": "details",
                    "offset": (258, 1092),
                },
                {
                    "tag": "p",
                    "offset": (1094, 1114),
                },
            ],
        }
        Tester(case, self).test()


if __name__ == "__main__":
    unittest.main()
