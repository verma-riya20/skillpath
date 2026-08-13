

Claude wrote the first pass of the courses component, the fetch logic, the retry, the four states. I went through it line by line and rewrote the responsive grid myself. First version used media queries and it looked fine until I checked it across Framer's Desktop/Tablet/Mobile breakpoints, all three showed the same column count. Turned out media queries check the browser window's width, not the width of the individual frame you're looking at, so inside Framer's canvas they were all reading the same viewport. Switched to a ResizeObserver that measures the component's own width instead, and that fixed it properly.

Two more days, I'd fix: I never actually caught the zero-results state live, the API just didn't return an empty array while I was testing, so I'm trusting the code path but haven't seen it render for real. I'd mock that response to check. I'd also add search and price sorting if I had time, skipped both to get the core stuff solid first.

Not fully happy with: footer's a bit faint on mobile, and the Hero-to-Courses spacing could be tighter.
