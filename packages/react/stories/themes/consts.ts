import logo from '../../../../docs/assets/logo.png?no-inline';

export const THEME_MARKDOWN = `# A little room for good ideas

Flowdown gives Markdown a considered home: **clear emphasis**, *a quieter voice*, ~~an earlier thought~~, and an [open door to the documentation][docs]. Inline code like \`theme.tokens.heading\` stays easy to scan.

<img src="${logo}" alt="Flowdown logo" width="192" />

## Make space for the details

A useful document has a steady rhythm. Paragraphs have room to breathe, long links can wrap, and the same content feels at home in light, dark, and custom themes.

### A heading for a section

A section can mix **bold with *nested emphasis***, *emphasis with **a strong point***, and ***both together***. Underscores work too: _a gentle aside_, __a firm decision__, and ~~a **retired** plan~~.

#### A heading for a detail

Literal characters deserve their own space: \\*asterisks\\*, &lbrack;brackets&rbrack;, \\# a hash, an escaped dollar \\$20, and a backslash \\\\. Entities read naturally: AT&amp;T, &copy; 2026, 5 &lt; 8, and &#x2192;.

##### A heading for a note

Code spans preserve punctuation: \`\` \`backticks\` inside code \`\`, \`a < b && b > c\`, and \`snake_case\`.

###### A heading for a small aside

Soft lines can continue
without a new paragraph. A deliberate hard break ends here.\\
This line belongs to the same paragraph.

Two trailing spaces also create a hard break.${'  '}
The next line follows it.

A second way to write a heading
==============================

Setext headings are useful when a plain-text document should be easy to skim.

A smaller setext heading
------------------------

Try an [inline link](https://example.com/guide "A short guide"), a [reference link][docs], a [collapsed reference][], or a [shortcut]. Automatic links work as <https://example.com>, https://example.org/notes, and <hello@example.com>.

## Lists that keep their place

3. Start from the third item when continuing an earlier list.
4. Build the answer in small steps.
   - Keep related ideas together.
     1. Add a specific detail.
     2. Add a second detail.
        - [x] Confirm the nesting.
        - [ ] Revisit the open question.
   - Give important ideas a little emphasis.
5. Review the result.

- [x] Clear typography and consistent spacing
- [x] Nested lists, tables, and links
  - [x] A completed subtask
  - [ ] A subtask that needs a closer look
- [ ] A final read before sharing

- A loose list item can contain more than one paragraph.

  The follow-up paragraph keeps the same indentation and explains why the item matters.

- Another item can hold a quotation and a code sample.

  > Keep the example close to the explanation.

  \`\`\`json
  { "reviewed": true, "remaining": 2 }
  \`\`\`

## A quiet place for context

> The details should support the idea.
>
> **Good defaults** make the first draft feel finished.
>
> > A nested note can add context without losing its place.
> >
> > - The first observation
> > - A useful follow-up with \`inline code\`
>
> \`\`\`ts
> const nextStep = 'Keep reading';
> \`\`\`

## Code that reads like code

\`\`\`tsx title="document.tsx"
import { Flowdown } from 'flowdown';

const theme = {
  tokens: {
    heading: { h1: { fontSize: '2.25rem' } },
  },
};

export const Document = () => (
  <Flowdown text="# Hello, world" theme={theme} />
);
\`\`\`

~~~python
# Small ideas can travel a long way.
def reading_time(words: int) -> float:
    return round(words / 200, 1)

print(f"About {reading_time(840)} minutes")
~~~

Four-backtick fences can show a Markdown example containing its own fence:

\`\`\`\`markdown
\`\`\`js
const message = \`Hello, \${reader}!\`;
\`\`\`
\`\`\`\`

An indented example can remain plain text:

    A small note without a language label.
    Whitespace keeps the lines together.

A long line scrolls inside its code block:

\`\`\`sh
curl --request GET --header 'Accept: application/json' 'https://example.com/api/documents?sort=updated&direction=descending&include=metadata'
\`\`\`

## Compare at a glance

| Detail | Light | Dark | Custom |
| :--- | :---: | :---: | ---: |
| **Headings** | Clear hierarchy | *Soft contrast* | \`fontSize\` |
| [Code blocks][docs] | Syntax colors | Syntax colors | \`syntax\` |
| ~~Old spacing~~ | Room to read | Room to read | \`lineHeight\` |
| A literal pipe | \`a\\|b\` | left \\| right | **Aligned** |
| Inline formulas | $a^2 + b^2$ | $\\sqrt{2}$ | $\\frac{1}{2}$ |

## Give an equation its own space

An inline expression such as $E = mc^2$ follows the rhythm of the sentence. Subscripts, superscripts, and Greek letters can stay inline too: $x_i^2 + \\alpha \\beta$.

$$
\\int_0^1 x^2\\,dx = \\frac{1}{3}
$$

$$
\\begin{aligned}
(a + b)^2 &= a^2 + 2ab + b^2 \\\\
\\nabla \\cdot \\mathbf{E} &= \\frac{\\rho}{\\varepsilon_0}
\\end{aligned}
$$

$$
A = \\begin{pmatrix}
1 & 2 \\\\
3 & 4
\\end{pmatrix},
\\qquad
f(x) = \\begin{cases}
x^2 & x \\ge 0 \\\\
-x & x < 0
\\end{cases}
$$

$$
\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6},
\\qquad
\\lim_{n \\to \\infty} \\left(1 + \\frac{1}{n}\\right)^n = e
$$

## A few useful HTML elements

Inline HTML can express <sub>subscripts</sub>, <sup>superscripts</sup>, a <kbd>⌘</kbd> + <kbd>K</kbd> shortcut, and a <mark>highlighted thought</mark>.

<details>
<summary>Open the final review notes</summary>

This disclosure contains a **formatted paragraph**, a [useful reference][docs], and a small list:

- Review the wording.
- Check the examples.
- Keep the reader in mind.

</details>

## A final reference

Horizontal rules can mark a new thought.

---

Three asterisks work as well.

***

And so do three underscores.

___

A reference-style image can share the same definition throughout a document:

[![Flowdown wordmark][flowdown-logo]][repository]

Good documents invite you to keep reading.[^note] A second reference can return to the same note.[^note]

A longer observation belongs in its own footnote.[^review]

[^note]: A short note about the reading experience.

[^review]: The first paragraph of a longer review note.

    A second paragraph can contain **emphasis** and \`code\`.

[docs]: https://example.com/docs "Documentation"
[collapsed reference]: https://example.com/references
[shortcut]: https://example.com/shortcuts
[repository]: https://github.com/hexmora/flowdown
[flowdown-logo]: ${logo} "Flowdown"
`;
