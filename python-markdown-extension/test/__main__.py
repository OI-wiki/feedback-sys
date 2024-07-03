import textwrap
import unittest
import markdown
from html.parser import HTMLParser


class Tester:
    def __init__(self, case, test_case: unittest.TestCase):
        self.case = case
        self.result = markdown.markdown(
            self.case["document"], extensions=["document-offsets-injection"]
        )
        self.test_case = test_case

    def test(self):
        ParserTester(self.case, self.test_case).feed(self.result)


class ParserTester(HTMLParser):
    tag = None
    text = None
    offset_start = None
    offset_end = None

    def __init__(self, case, test_case: unittest.TestCase):
        super().__init__()
        self.test_case = test_case
        self.case = case
        self.idx = 0

    def handle_starttag(self, tag, attrs):
        self.tag = tag
        for attr in attrs:
            if attr[0] == "data-original-document-start":
                self.offset_start = int(attr[1])
            if attr[0] == "data-original-document-end":
                self.offset_end = int(attr[1])

    def handle_data(self, data):
        self.text = data

    def handle_endtag(self, tag):
        self._test()
        self._reset()

    def _test(self):
        self.test_case.assertEqual(
            self.tag,
            self.case["expected"][self.idx]["tag"],
            msg="Tag mismatch in index " + str(self.idx),
        )
        self.test_case.assertEqual(
            self.text,
            self.case["expected"][self.idx]["text"],
            msg="Text mismatch in index " + str(self.idx),
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
        self.text = None
        self.offset_start = None
        self.offset_end = None


class TestParser(unittest.TestCase):
    def test_normal(self):
        case = {
            "document": textwrap.dedent("""\
                    # Lorem ipsum
                    
                    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin sed lacus vitae neque vestibulum porttitor id et urna.
                    
                    ## Morbi neque lectus
                    
                    Morbi neque lectus, faucibus a mattis at, aliquam quis est. Maecenas sed luctus elit."""),
            "expected": [
                {"tag": "h1", "text": "Lorem ipsum", "offset": (0, 13)},
                {
                    "tag": "p",
                    "text": "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin sed lacus vitae neque vestibulum porttitor id et urna.",
                    "offset": (15, 132),
                },
                {"tag": "h2", "text": "Morbi neque lectus", "offset": (134, 155)},
                {
                    "tag": "p",
                    "text": "Morbi neque lectus, faucibus a mattis at, aliquam quis est. Maecenas sed luctus elit.",
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
                {"tag": "p", "text": "Lorem ipsum", "offset": (0, 11)},
            ],
        }
        Tester(case, self).test()


if __name__ == "__main__":
    unittest.main()
