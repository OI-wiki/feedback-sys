import markdown
from html.parser import HTMLParser

test_cases = {
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent vel nulla ac diam dignissim congue ut sed ligula. Pellentesque aliquet ante sit amet risus iaculis, eget tincidunt nibh volutpat. Etiam non pulvinar enim. Mauris viverra augue urna, non aliquam ligula sodales in. Duis mattis ligula pretium dui bibendum, nec tincidunt neque placerat. Pellentesque eu est malesuada, dictum nulla quis, facilisis lectus. Fusce tempor mi ac tellus dictum porta. Cras venenatis pulvinar turpis. Suspendisse consequat nulla suscipit sagittis pretium.": (0, 544),
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin sed lacus vitae neque vestibulum porttitor id et urna. Quisque nisl nisi, fermentum at justo quis, varius aliquet lorem. Ut fringilla vel purus et fermentum. Mauris ac lacinia nisi, sed ultricies dolor. Nunc ut augue quis eros iaculis tempor vel eu erat. Vestibulum efficitur porta justo. Fusce cursus magna dui, eget posuere neque tristique id. Suspendisse varius mauris arcu, nec congue metus efficitur in. Etiam ac pretium justo. Proin non ante faucibus, mattis mi et, consectetur sapien. Proin feugiat commodo euismod.": (546, 1131),
    "Morbi neque lectus, faucibus a mattis at, aliquam quis est. Maecenas sed luctus elit. Nam vel consequat magna, ac dictum velit. Quisque non cursus enim, at ullamcorper massa. Integer quam mauris, scelerisque eu luctus et, facilisis nec ante. Proin feugiat vehicula felis at ornare. Maecenas est risus, tempus sit amet fermentum vel, sagittis in tellus. Integer ultrices velit at nulla tincidunt cursus. Curabitur non nunc in erat imperdiet imperdiet id sed felis. Quisque euismod velit a mi pellentesque, sit amet molestie eros dignissim. Morbi tincidunt dui vitae orci viverra, vitae gravida sapien semper. Pellentesque viverra a turpis blandit ornare. Quisque tincidunt quam a est facilisis, a fringilla augue sollicitudin. Pellentesque et eros sed arcu placerat sollicitudin. Donec diam eros, auctor non risus eu, interdum interdum mi.": (1133, 1971)
}

test_document = """Lorem ipsum dolor sit amet, consectetur adipiscing elit. Praesent vel nulla ac diam dignissim congue ut sed ligula. Pellentesque aliquet ante sit amet risus iaculis, eget tincidunt nibh volutpat. Etiam non pulvinar enim. Mauris viverra augue urna, non aliquam ligula sodales in. Duis mattis ligula pretium dui bibendum, nec tincidunt neque placerat. Pellentesque eu est malesuada, dictum nulla quis, facilisis lectus. Fusce tempor mi ac tellus dictum porta. Cras venenatis pulvinar turpis. Suspendisse consequat nulla suscipit sagittis pretium.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Proin sed lacus vitae neque vestibulum porttitor id et urna. Quisque nisl nisi, fermentum at justo quis, varius aliquet lorem. Ut fringilla vel purus et fermentum. Mauris ac lacinia nisi, sed ultricies dolor. Nunc ut augue quis eros iaculis tempor vel eu erat. Vestibulum efficitur porta justo. Fusce cursus magna dui, eget posuere neque tristique id. Suspendisse varius mauris arcu, nec congue metus efficitur in. Etiam ac pretium justo. Proin non ante faucibus, mattis mi et, consectetur sapien. Proin feugiat commodo euismod.

Morbi neque lectus, faucibus a mattis at, aliquam quis est. Maecenas sed luctus elit. Nam vel consequat magna, ac dictum velit. Quisque non cursus enim, at ullamcorper massa. Integer quam mauris, scelerisque eu luctus et, facilisis nec ante. Proin feugiat vehicula felis at ornare. Maecenas est risus, tempus sit amet fermentum vel, sagittis in tellus. Integer ultrices velit at nulla tincidunt cursus. Curabitur non nunc in erat imperdiet imperdiet id sed felis. Quisque euismod velit a mi pellentesque, sit amet molestie eros dignissim. Morbi tincidunt dui vitae orci viverra, vitae gravida sapien semper. Pellentesque viverra a turpis blandit ornare. Quisque tincidunt quam a est facilisis, a fringilla augue sollicitudin. Pellentesque et eros sed arcu placerat sollicitudin. Donec diam eros, auctor non risus eu, interdum interdum mi."""

html = markdown.markdown(test_document, extensions=['mark-words'])

class Tester(HTMLParser):
    start = None
    end = None
    data = None
    
    def handle_starttag(self, tag, attrs):
        for attr in attrs:
            if attr[0] == "data-original-document-start":
                self.start = int(attr[1])
            if attr[0] == "data-original-document-end":
                self.end = int(attr[1])
        
    def handle_data(self, data):
        self.data = data
        if(self.start is not None and self.end is not None and self.data is not None):
            self._test()
            self._reset()
        
    def _test(self):
        if self.start is None or self.end is None or self.data is None:
            raise AssertionError("Missing data")
        case = test_cases[self.data]
        print(f"Testing block offset ({self.start}, {self.end}) == {case}")
        if self.start != case[0] or self.end != case[1]:
            raise AssertionError(f"Block offset test failed, expected ({case[0]}, {case[1]}), got ({self.start}, {self.end})")
    
    def _reset(self):
        self.start = None
        self.end = None
        self.data = None

Tester().feed(html)

print("All tests passed!")