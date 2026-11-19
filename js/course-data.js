/**
 * Course Curriculum & Micro-Lesson Content: Learning the Web with Basics of Vanilla Front-End Tools
 * Track: Vanilla Web Foundations (druba.in)
 * Concise, minimalist single-topic lessons: plain prose upfront, extra tips in collapsed accordions.
 */

export const MODULES = [
  {
    id: 1,
    code: 'M1',
    title: 'The Internet and WWW',
    subtitle: 'How Websites Travel from a Server to Your Screen',
    co: 'Understand how the Internet and Web work, how DNS maps names to IPs, how HTTP works, and how to build your first HTML page.',
    icon: 'public',
    labIds: [],
    slideRefs: 'Slides 01 & 02 + Bigger Picture (Pages 1–34, 220–223)',
    summary: 'Discover how the Internet and the Web work behind the scenes—from web addresses and DNS to browsers, servers, and creating your very first web page.',
    sections: [
      {
        id: 'm1-internet-vs-www',
        badge: 'NETWORKING',
        title: 'Internet vs. World Wide Web',
        lead: 'The Internet is the global network of cables and routers. The World Wide Web is the system of linked pages running on top of it.',
        points: [
          { heading: 'Internet (Infrastructure)', text: 'Fibre cables, mobile towers, and satellites moving TCP/IP packets.' },
          { heading: 'World Wide Web (Hypertext)', text: 'HTML pages linked by URLs over HTTP/HTTPS. Email and WhatsApp use the Internet, not the Web.' }
        ],
        analogy: {
          title: 'Road & Bus Analogy',
          text: 'The Internet is the highway system; the Web is one bus line riding those roads alongside email and messaging vans.'
        },
        takeaway: {
          type: 'info',
          text: 'Without the Internet, nothing connects; without the Web, messaging and email still work.'
        },
        microCheck: {
          question: 'Which service uses the Internet WITHOUT being part of the World Wide Web?',
          options: [
            'Opening an HTML page in Chrome',
            'Sending a WhatsApp voice message',
            'Clicking a webpage hyperlink'
          ],
          correctIndex: 1,
          explanation: 'WhatsApp uses Internet TCP/IP protocols directly, whereas webpages run over HTTP/HTTPS on the Web.'
        },
        widget: { type: 'packet-toggle' }
      },
      {
        id: 'm1-url-dns-ip',
        badge: 'ADDRESSING',
        title: 'Website, URL, IP Address & DNS',
        lead: 'Computers locate servers by numeric IP address. DNS translates human domain names like druba.in into those numbers.',
        points: [
          { heading: 'URL Parts', text: 'Protocol (https://) + Domain (druba.in) + Path (/learn/index.html).' },
          { heading: 'IPv4 vs. IPv6', text: 'IPv4 uses four numbers (192.168.1.10); IPv6 uses hex blocks (2001:db8::1) for billions more devices.' }
        ],
        analogy: {
          title: 'Phone Book Analogy',
          text: 'DNS is the Internet’s phone book—you type a name, and it returns the exact IP number.'
        },
        takeaway: {
          type: 'info',
          text: 'Browser asks DNS -> DNS returns IP address -> Browser connects to the Web Server.'
        },
        microCheck: {
          question: 'What does a DNS server do?',
          options: [
            'Encrypts HTML form passwords',
            'Translates a domain name into an IP address',
            'Styles webpage colors and fonts'
          ],
          correctIndex: 1,
          explanation: 'DNS maps readable domain names like google.com to machine-routable IP addresses.'
        },
        widget: { type: 'url-dns-sim' }
      },
      {
        id: 'm1-how-web-works',
        badge: 'HTTP & HTTPS',
        title: 'Web Browsers, Servers & HTTP/HTTPS',
        lead: 'Your browser sends an HTTP request to a server, which replies with a status code and the HTML page.',
        points: [
          { heading: 'GET vs. POST', text: 'GET fetches pages via URL; POST sends form data inside the request body.' },
          { heading: 'Status Codes', text: '200 OK (success), 404 Not Found (missing), 500 (server error).' }
        ],
        analogy: {
          title: 'Postcard vs. Sealed Envelope',
          text: 'HTTP (Port 80) sends plain text like a postcard. HTTPS (Port 443) encrypts traffic with TLS.'
        },
        takeaway: {
          type: 'info',
          text: 'Always verify HTTPS (Port 443) before entering passwords or payment details.'
        },
        microCheck: {
          question: 'Which status code means the requested page was not found on the server?',
          options: ['200 OK', '404 Not Found', '500 Server Error'],
          correctIndex: 1,
          explanation: '404 Not Found indicates the requested path does not exist on the server.'
        },
        widget: { type: 'http-cycle' }
      },
      {
        id: 'm1-architecture',
        badge: 'ARCHITECTURE',
        title: 'Front End vs. Back End & Responsive Design',
        lead: 'Front End code runs inside your browser. Back End code runs on the server to process logins and data.',
        points: [
          { heading: 'Front End Trio', text: 'HTML builds structure, CSS styles layout, and JavaScript adds interaction.' },
          { heading: 'Responsive Design', text: 'Layouts adapt from 375px phones to 1200px desktops using fluid grids and @media.' }
        ],
        analogy: {
          title: 'Restaurant Analogy',
          text: 'The Front End is the dining hall you see; the Back End is the kitchen and storage room.'
        },
        takeaway: {
          type: 'info',
          text: 'Static sites send fixed HTML files; dynamic sites build custom pages from a database.'
        },
        microCheck: {
          question: 'Which language controls layout, colors, and responsive screen sizing?',
          options: ['HTML', 'CSS', 'MySQL'],
          correctIndex: 1,
          explanation: 'CSS controls visual presentation, layout, and responsive @media rules.'
        },
        widget: { type: 'arch-responsive-sim' }
      },
      {
        id: 'm1-first-page',
        badge: 'YOUR FIRST PAGE',
        title: 'Building Your First Web Page',
        lead: 'Webpages are plain text files saved with .html. Name your site’s home page index.html.',
        points: [
          { heading: 'Clean Naming', text: 'Use lowercase with hyphens (about-us.html), never spaces.' },
          { heading: 'Page Structure', text: 'Metadata (<title>) goes in <head>; visible content goes in <body>.' }
        ],
        analogy: {
          title: 'Shortcuts & Life Cycle',
          text: 'Type ! + Tab in VS Code for an instant HTML5 skeleton. Websites follow: Plan -> Design -> Develop -> Test -> Deploy -> Maintain.'
        },
        takeaway: {
          type: 'info',
          text: 'Always save your .html file (Ctrl + S) before refreshing the browser.'
        },
        microCheck: {
          question: 'What should the home page of a website be named?',
          options: ['home page.html', 'index.html', 'main.txt'],
          correctIndex: 1,
          explanation: 'Web servers load index.html automatically when opening a domain root.'
        },
        widget: {
          type: 'mini-editor',
          task: 'Edit the <h1> heading and <p> paragraph to see the preview update.',
          starterHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <title>My First Page</title>
</head>
<body style="font-family: sans-serif; padding: 16px;">
  <h1>Hello, World!</h1>
  <p>Edit this paragraph and watch the live preview update.</p>
</body>
</html>`,
          checks: [
            { label: 'Has <h1>', test: (code) => /<h1[\s>][\s\S]*?<\/h1>/i.test(code) },
            { label: 'Has <p>', test: (code) => /<p[\s>][\s\S]*?<\/p>/i.test(code) }
          ]
        }
      }
    ]
  },

  {
    id: 2,
    code: 'M2',
    title: 'HTML & HTML5',
    subtitle: 'Building Web Pages with Text, Links, Images, Tables, Lists & Forms',
    co: 'Build complete HTML5 documents with semantic headings, accessible images, nested lists, merged tables, validated forms, and embedded iframes.',
    icon: 'code',
    labIds: [1, 2, 3],
    slideRefs: 'Slides 03, 04 & 05 (Pages 35–98)',
    summary: 'Learn how to structure real web pages using HTML5 tags—add headings, paragraphs, images, links, merged tables, organized lists, and interactive sign-up forms.',
    sections: [
      {
        id: 'm2-text-headings',
        badge: 'TEXT & HEADINGS',
        title: 'Elements, Headings & Formatting',
        lead: 'HTML marks content by meaning. Use one <h1> for the main title, followed by <h2>–<h6> in outline order.',
        points: [
          { heading: 'Proper Nesting', text: 'Close the innermost tag first: <p>Agartala is <b>vibrant</b>.</p>.' },
          { heading: 'HTML5 Formatting', text: 'Use <strong>, <em>, <mark>, <sub>, <sup>, and <del>.' }
        ],
        analogy: {
          title: 'Newspaper Outline',
          text: '<h1> is the front-page headline, <h2> marks sections, and <mark> acts like a highlighter.'
        },
        takeaway: {
          type: 'info',
          text: 'Pick heading levels by document hierarchy, not font size.'
        },
        microCheck: {
          question: 'Which tag highlights text like a marker in HTML5?',
          options: ['<strike>', '<mark>', '<head>'],
          correctIndex: 1,
          explanation: '<mark> highlights text; <strike> was removed in HTML5.'
        },
        widget: {
          type: 'mini-editor',
          task: 'Change the second <h1> to <h2> and wrap "2" in <sub>2</sub>.',
          starterHtml: `<article style="font-family: sans-serif; line-height: 1.5;">
  <h1>Science Study Notes</h1>
  <h1>1. Water Formula</h1>
  <p>Pure water is written as H2O and boils at 100&deg;C.</p>
  <p>Key term: <mark>Evaporation</mark></p>
</article>`,
          checks: [
            { label: 'One <h1> + <h2>', test: (c) => (c.match(/<h1[\s>]/gi) || []).length === 1 && /<h2[\s>]/i.test(c) },
            { label: 'Uses <sub>2</sub>', test: (c) => /<sub>\s*2\s*<\/sub>/i.test(c) }
          ]
        }
      },
      {
        id: 'm2-links-images',
        badge: 'LINKS & IMAGES',
        title: 'Hyperlinks & Accessible Images',
        lead: 'Use <a href="..."> to link pages and <img src="..." alt="..."> to display images.',
        points: [
          { heading: 'Link Targets', text: 'target="_blank" opens external sites in a new tab; #id jumps within the page.' },
          { heading: 'Descriptive alt', text: '<img> is a self-closing tag and requires alt text for accessibility.' }
        ],
        analogy: {
          title: 'Signpost & Caption',
          text: 'Links are road signs to another page; alt text is a spoken caption if an image cannot load.'
        },
        takeaway: {
          type: 'info',
          text: 'Never omit the alt attribute on an <img> element.'
        },
        microCheck: {
          question: 'Which attribute provides fallback text when an <img> fails to load?',
          options: ['title', 'alt', 'href'],
          correctIndex: 1,
          explanation: 'alt describes the image for screen readers and broken-image fallbacks.'
        },
        widget: {
          type: 'mini-editor',
          task: 'Add alt="Vanilla Web Lab" to <img> and target="_blank" to <a>.',
          starterHtml: `<div style="font-family: sans-serif;">
  <h3>Campus Portal</h3>
  <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='80'%3E%3Crect width='220' height='80' rx='10' fill='%230e7a3a'/%3E%3Ctext x='18' y='46' fill='white' font-size='16' font-family='sans-serif'%3EVanilla Web Lab%3C/text%3E%3C/svg%3E">
  <p>Visit <a href="https://swayam.gov.in">SWAYAM Courses</a> for free lectures.</p>
</div>`,
          checks: [
            { label: '<img> has alt', test: (c) => /<img[^>]+alt\s*=\s*["'][^"']+["']/i.test(c) },
            { label: '<a> has target="_blank"', test: (c) => /<a[^>]+target\s*=\s*["']_blank["']/i.test(c) }
          ]
        }
      },
      {
        id: 'm2-lists',
        badge: 'LISTS',
        title: 'Ordered, Unordered & Nested Lists',
        lead: 'Group items with <ul> (bullets) or <ol> (numbers). Nested sub-lists must sit inside an <li>.',
        points: [
          { heading: 'Ordered Options', text: '<ol type="A" start="3"> starts lettering from C.' },
          { heading: 'Valid Nesting', text: 'Place the inner <ul> inside the parent <li> before </li>.' }
        ],
        analogy: {
          title: 'Folder Analogy',
          text: 'A sub-folder belongs inside a main folder—never floating between two list items.'
        },
        takeaway: {
          type: 'info',
          text: 'Only <li> elements may be direct children of <ul> or <ol>.'
        },
        microCheck: {
          question: 'Where should a nested <ul> be placed inside an outer list?',
          options: [
            'Between two <li> tags',
            'Inside one of the parent <li> elements',
            'Inside <head>'
          ],
          correctIndex: 1,
          explanation: 'Placing the sub-list inside its parent <li> keeps the HTML tree valid.'
        },
        widget: {
          type: 'mini-editor',
          task: 'Move the inner <ul> ("Potato", "Tomato") inside the "Vegetables" <li>.',
          starterHtml: `<div style="font-family: sans-serif;">
  <h3>Grocery Checklist</h3>
  <ul>
    <li>Vegetables</li>
    <ul>
      <li>Potato</li>
      <li>Tomato</li>
    </ul>
    <li>Milk</li>
  </ul>
</div>`,
          checks: [
            { label: 'Nested <ul> inside <li>', test: (c) => /<li>\s*Vegetables[\s\S]*?<ul>[\s\S]*?<\/ul>\s*<\/li>/i.test(c) }
          ]
        }
      },
      {
        id: 'm2-tables',
        badge: 'TABLES',
        title: 'Tables with colspan & rowspan',
        lead: 'Build data grids using <table>, <tr> (row), <th> (header), and <td> (cell).',
        points: [
          { heading: 'colspan', text: 'Stretches a cell horizontally across multiple columns.' },
          { heading: 'rowspan', text: 'Stretches a cell vertically down rows (omit covered cells below).' }
        ],
        analogy: {
          title: 'Spreadsheet Merge',
          text: 'colspan merges across columns like a banner title; rowspan merges down rows.'
        },
        takeaway: {
          type: 'info',
          text: 'When a cell uses rowspan="2", the next row needs one fewer <td>.'
        },
        microCheck: {
          question: 'Which attribute stretches a header cell across 3 columns?',
          options: ['rowspan="3"', 'colspan="3"', 'width="3"'],
          correctIndex: 1,
          explanation: 'colspan="3" merges 3 horizontal columns into one cell.'
        },
        widget: {
          type: 'mini-editor',
          task: 'Add colspan="2" to the <th> header and rowspan="2" to the "Monday" <td>.',
          starterHtml: `<table border="1" cellpadding="8" style="border-collapse: collapse; font-family: sans-serif;">
  <tr>
    <th>Class Time Table</th>
  </tr>
  <tr>
    <td>Monday</td>
    <td>10:30 · HTML5</td>
  </tr>
  <tr>
    <td>12:00 · CSS3</td>
  </tr>
</table>`,
          checks: [
            { label: 'th colspan="2"', test: (c) => /<th[^>]+colspan\s*=\s*["']2["']/i.test(c) },
            { label: 'td rowspan="2"', test: (c) => /<td[^>]+rowspan\s*=\s*["']2["']/i.test(c) }
          ]
        }
      },
      {
        id: 'm2-forms',
        badge: 'FORMS',
        title: 'Forms & HTML5 Validation',
        lead: 'Collect user input with <form>, paired <label> tags, smart input types, and required checks.',
        points: [
          { heading: 'GET vs. POST', text: 'Use GET for searches (in URL); use POST for logins and private data.' },
          { heading: 'Validation', text: 'Add type="email", required, and pattern="..." to block bad inputs.' }
        ],
        analogy: {
          title: 'Radio Group Rule',
          text: 'Give radio buttons the exact same name="..." so only one option can be selected.'
        },
        takeaway: {
          type: 'info',
          text: 'Always match <label for="id"> to the input id for accessibility.'
        },
        microCheck: {
          question: 'How do you link radio buttons so only ONE can be selected at a time?',
          options: [
            'Give them the same id',
            'Give them the same name attribute',
            'Put them inside <pre>'
          ],
          correctIndex: 1,
          explanation: 'Sharing the same name="..." groups radio buttons into one exclusive choice.'
        },
        widget: {
          type: 'mini-editor',
          task: 'Change the email input to type="email" and add required to both inputs.',
          starterHtml: `<form onsubmit="event.preventDefault(); alert('Form looks valid!');" style="font-family: sans-serif; display: grid; gap: 8px; max-width: 280px;">
  <label for="u-name">Full Name</label>
  <input id="u-name" type="text" placeholder="Drubajyoti Debnath">
  <label for="u-mail">Email Address</label>
  <input id="u-mail" type="text" placeholder="ananya@example.in">
  <button type="submit" style="padding: 6px 12px; margin-top: 4px;">Register</button>
</form>`,
          checks: [
            { label: 'type="email"', test: (c) => /type\s*=\s*["']email["']/i.test(c) },
            { label: 'required inputs', test: (c) => (c.match(/\brequired\b/gi) || []).length >= 2 }
          ]
        }
      },
      {
        id: 'm2-semantics-iframes',
        badge: 'SEMANTICS & MEDIA',
        title: 'Semantic Layout, Media & Iframes',
        lead: 'Replace generic <div> wrappers with semantic landmarks: <header>, <nav>, <main>, <article>, and <footer>.',
        points: [
          { heading: 'Landmarks', text: 'Screen readers and search engines navigate <header>, <main>, and <footer> directly.' },
          { heading: '<iframe> & Media', text: 'Use <iframe> to embed pages and <video controls> for native media.' }
        ],
        analogy: {
          title: 'Labeled Moving Boxes',
          text: 'Generic <div> tags are blank boxes; semantic tags label each region clearly.'
        },
        takeaway: {
          type: 'info',
          text: 'Legacy <frameset> is removed from HTML5; always include controls on <audio>/<video>.'
        },
        microCheck: {
          question: 'Which HTML5 tag wraps the unique primary content of a webpage?',
          options: ['<frameset>', '<main>', '<div id="top">'],
          correctIndex: 1,
          explanation: '<main> marks the primary content landmark; <frameset> is obsolete.'
        },
        widget: {
          type: 'mini-editor',
          task: 'Replace <div class="top"> with <header> and <div class="bottom"> with <footer>.',
          starterHtml: `<div style="font-family: sans-serif; border: 1px solid #cbd5e1; border-radius: 10px; overflow: hidden;">
  <div class="top" style="background: #d1e8d4; padding: 10px; font-weight: bold;">My Tech Blog</div>
  <main style="padding: 12px;">
    <article>
      <h4 style="margin: 0 0 4px;">Why Semantics Matter</h4>
      <p style="margin: 0; font-size: 13px;">Screen readers navigate landmarks effortlessly.</p>
    </article>
  </main>
  <div class="bottom" style="background: #f1f5f9; padding: 8px 10px; font-size: 12px;">&copy; 2026 Vanilla Web</div>
</div>`,
          checks: [
            { label: '<header> tag', test: (c) => /<header[\s>][\s\S]*?<\/header>/i.test(c) },
            { label: '<footer> tag', test: (c) => /<footer[\s>][\s\S]*?<\/footer>/i.test(c) }
          ]
        }
      }
    ]
  },

  {
    id: 3,
    code: 'M3',
    title: 'JavaScript Fundamentals & Objects',
    subtitle: 'Making Pages Interactive with Variables, Logic, Functions & Live Timers',
    co: 'Store data with let/const, control logic with loops and try...catch, and inspect built-in Date, Array, and Math objects.',
    icon: 'javascript',
    labIds: [5, 6],
    slideRefs: 'Slides 09 & 10 (Pages 170–194, 207–213)',
    summary: 'Bring your pages to life with JavaScript—store information in variables, make decisions with if/else, repeat tasks with loops, handle errors cleanly, and build a live digital clock.',
    sections: [
      {
        id: 'm3-vars-operators',
        badge: 'VARIABLES',
        title: 'Variables, Types & Strict Equality',
        lead: 'Use const by default and let when a value changes. Compare values safely with strict ===.',
        points: [
          { heading: 'Avoid var', text: 'Prefer const and let; inspect any value’s type with typeof.' },
          { heading: 'String + Number Trap', text: '"5" + 5 joins text into "55". Convert strings with Number("5") first.' }
        ],
        analogy: {
          title: 'Strict vs. Loose Equality',
          text: '"5" == 5 ignores type and returns true; "5" === 5 checks both value and type (false).'
        },
        takeaway: {
          type: 'info',
          text: 'Always use === and convert form inputs with Number() before doing math.'
        },
        microCheck: {
          question: 'What does ("5" + 5) evaluate to in JavaScript?',
          options: ['10', '"55"', 'NaN'],
          correctIndex: 1,
          explanation: 'When + sees a string, it concatenates the values into "55".'
        },
        widget: {
          type: 'js-sandbox',
          presets: [
            {
              label: 'Test == vs ===',
              code: `const city = "Agartala";\nlet marks = 82;\nmarks = marks + 8;\nconsole.log("Loose '5' == 5:", "5" == 5);\nconsole.log("Strict '5' === 5:", "5" === 5);\nreturn { city, marks, typeofMarks: typeof marks };`
            },
            {
              label: 'Fix "25" + 5',
              code: `const rawInput = "25";\nconst buggySum = rawInput + 5;\nconst fixedSum = Number(rawInput) + 5;\nconsole.log("Without Number():", buggySum);\nconsole.log("With Number():", fixedSum);\nreturn { rawInput, buggySum, fixedSum };`
            }
          ]
        }
      },
      {
        id: 'm3-popup-boxes',
        badge: 'POPUP BOXES',
        title: 'Popup Boxes: alert, confirm & prompt',
        lead: 'JavaScript includes three dialog boxes for quick alerts, yes/no checks, and text input.',
        points: [
          { heading: 'alert() & confirm()', text: 'alert() shows a notice; confirm() returns true (OK) or false (Cancel).' },
          { heading: 'prompt()', text: 'prompt("Name?", "Guest") returns the typed string or null if cancelled.' }
        ],
        analogy: {
          title: 'Reception Desk',
          text: 'alert() announces, confirm() asks yes/no, and prompt() collects a short written reply.'
        },
        takeaway: {
          type: 'info',
          text: 'prompt() always returns a string—wrap numeric replies in Number().'
        },
        microCheck: {
          question: 'What does confirm("Delete draft?") return if the user clicks Cancel?',
          options: ['null', 'false', '"Cancel"'],
          correctIndex: 1,
          explanation: 'confirm() returns boolean true for OK and false for Cancel.'
        },
        widget: {
          type: 'js-sandbox',
          presets: [
            {
              label: 'Simulate alert()',
              code: `alert("Progress saved successfully!");\nconsole.log("Alert dismissed by user.");\nreturn { popupType: "alert", returned: undefined };`
            },
            {
              label: 'Simulate confirm()',
              code: `const agreed = confirm("Submit Lab 5 now?");\nconsole.log("User confirmed?", agreed);\nreturn { popupType: "confirm", agreed };`
            },
            {
              label: 'Simulate prompt()',
              code: `const student = prompt("Enter your name:", "Ananya");\nconsole.log("Greeting:", "Hello, " + student);\nreturn { popupType: "prompt", student, type: typeof student };`
            }
          ]
        }
      },
      {
        id: 'm3-control-flow',
        badge: 'CONTROL FLOW',
        title: 'Conditionals & Loops',
        lead: 'Steer execution with if...else or switch, and repeat steps using for, while, or do...while.',
        points: [
          { heading: 'if & switch', text: 'End each switch case with break; so execution does not fall through.' },
          { heading: 'while vs. do...while', text: 'while checks first; do...while always runs once before checking.' }
        ],
        analogy: {
          title: 'Railway Switch',
          text: 'if/else picks one track based on a condition; a for loop repeats an exact number of laps.'
        },
        takeaway: {
          type: 'info',
          text: 'Always include break; inside switch cases.'
        },
        microCheck: {
          question: 'Which loop runs its body at least ONCE even if the condition is false?',
          options: ['for loop', 'while loop', 'do...while loop'],
          correctIndex: 2,
          explanation: 'do...while checks its condition only after executing once.'
        },
        widget: {
          type: 'js-sandbox',
          presets: [
            {
              label: 'Loop 1 to 5',
              code: `const limit = 5;\nconst table = [];\nfor (let i = 1; i <= limit; i++) {\n  const line = "7 x " + i + " = " + (7 * i);\n  console.log(line);\n  table.push(line);\n}\nreturn { limit, count: table.length };`
            },
            {
              label: 'Test if / else',
              code: `const score = 78;\nlet grade = "Needs Review";\nif (score >= 85) grade = "Distinction";\nelse if (score >= 60) grade = "Passed";\nconsole.log("Score:", score, "->", grade);\nreturn { score, grade };`
            },
            {
              label: 'do...while Once',
              code: `let n = 10;\ndo {\n  console.log("Ran once even though n =", n);\n} while (n < 5);\nreturn { finalN: n };`
            }
          ]
        }
      },
      {
        id: 'm3-try-catch',
        badge: 'ERROR HANDLING',
        title: 'try, catch, finally & throw',
        lead: 'Wrap risky code in try...catch so runtime errors are handled cleanly instead of crashing the script.',
        points: [
          { heading: 'try & catch(err)', text: 'If try throws an error, execution jumps directly to catch with err.message.' },
          { heading: 'throw & finally', text: 'throw new Error("...") enforces custom rules; finally always runs.' }
        ],
        analogy: {
          title: 'Safety Net',
          text: 'try performs the stunt, catch is the safety net below, and finally cleans up afterward.'
        },
        takeaway: {
          type: 'info',
          text: 'Display err.message clearly in the UI instead of failing silently.'
        },
        microCheck: {
          question: 'When does a finally { ... } block run?',
          options: [
            'Only when an error occurs',
            'Only when no error occurs',
            'Always, whether an error occurred or not'
          ],
          correctIndex: 2,
          explanation: 'finally always runs after try and catch finish.'
        },
        widget: {
          type: 'js-sandbox',
          presets: [
            {
              label: 'Trigger throw (50000)',
              code: `function withdraw(amount) {\n  if (amount > 10000) {\n    throw new Error("Daily limit is 10000");\n  }\n  return "Dispensed: " + amount;\n}\n\nlet status = "";\ntry {\n  status = withdraw(50000);\n} catch (err) {\n  status = "Caught: " + err.message;\n  console.error(status);\n} finally {\n  console.log("finally: Session closed safely.");\n}\nreturn { status };`
            },
            {
              label: 'Valid Input (2500)',
              code: `function withdraw(amount) {\n  if (amount > 10000) {\n    throw new Error("Daily limit is 10000");\n  }\n  return "Dispensed: " + amount;\n}\n\nlet status = "";\ntry {\n  status = withdraw(2500);\n  console.log(status);\n} catch (err) {\n  status = "Caught: " + err.message;\n} finally {\n  console.log("finally: Session closed safely.");\n}\nreturn { status };`
            }
          ]
        }
      },
      {
        id: 'm3-builtin-es6',
        badge: 'OBJECTS & ES6',
        title: 'Built-in Objects (Array, Date, Math)',
        lead: 'JavaScript provides built-in objects like Array, Date, and Math so you never have to write common utilities from scratch.',
        points: [
          { heading: 'Arrays Start at 0', text: 'Use .push(), .map(), and .filter() to work with lists.' },
          { heading: 'Date & Math', text: 'new Date() reads live time; Math.floor(Math.random() * 6) + 1 rolls a die.' }
        ],
        analogy: {
          title: 'Calendar & Dice',
          text: 'In Date(), getMonth() is zero-based (January = 0, December = 11).'
        },
        takeaway: {
          type: 'info',
          text: 'ES6 template literals (`Hi ${name}`) and arrow functions keep code concise.'
        },
        microCheck: {
          question: 'Given const fruits = ["Mango", "Banana", "Litchi"]; what is fruits[1]?',
          options: ['"Mango"', '"Banana"', '"Litchi"'],
          correctIndex: 1,
          explanation: 'Index 0 is "Mango", so index 1 is "Banana".'
        },
        widget: {
          type: 'js-sandbox',
          presets: [
            {
              label: 'Call new Date()',
              code: `const now = new Date();\nconst dateStr = now.toLocaleDateString("en-IN");\nconst timeStr = now.toLocaleTimeString();\nconsole.log("Date:", dateStr, "| Time:", timeStr);\nreturn { year: now.getFullYear(), monthIndex: now.getMonth(), timeStr };`
            },
            {
              label: 'Roll Math.random()',
              code: `const roll = Math.floor(Math.random() * 6) + 1;\nconst maxVal = Math.max(12, 45, 7);\nconsole.log("Dice roll (1-6):", roll);\nreturn { roll, maxVal };`
            },
            {
              label: 'Array .push & .map',
              code: `const marks = [72, 85];\nmarks.push(91);\nconst bonus = marks.map((m) => m + 5);\nconsole.log("Updated marks:", bonus);\nreturn { count: marks.length, bonus };`
            }
          ]
        }
      }
    ]
  },

  {
    id: 4,
    code: 'M4',
    title: 'CSS & DOM Techniques',
    subtitle: 'Styling Layouts with Colors, Fonts, the Box Model, Flexbox & Live Page Updates',
    co: 'Master CSS specificity, the Box Model, Flexbox layouts, and live DOM updates using innerHTML and event listeners.',
    icon: 'palette',
    labIds: [4, 7, 8],
    slideRefs: 'Slides 06, 07 & 10 (Pages 99–147, 195–206)',
    summary: 'Make your websites look great on any screen using CSS colors, fonts, the Box Model, and Flexbox—and use JavaScript to update text and styles on the fly.',
    sections: [
      {
        id: 'm4-css-types-selectors',
        badge: 'SELECTORS & CASCADE',
        title: 'CSS Types, Selectors & Specificity',
        lead: 'CSS can be Inline, Internal (<style>), or External (style.css). Specificity decides which rule wins when selectors clash.',
        points: [
          { heading: 'Specificity Order', text: 'Tag (0,0,1) < Class (0,1,0) < ID (1,0,0) < Inline style.' },
          { heading: 'External CSS', text: 'Use <link rel="stylesheet" href="style.css"> to style all pages consistently.' }
        ],
        analogy: {
          title: 'Jersey vs. Name Badge',
          text: 'Tag is a uniform, .class is a team jersey, #id is a unique badge, and inline style="..." overrides them all.'
        },
        takeaway: {
          type: 'info',
          text: 'Prefer reusable .class selectors in external stylesheets over inline styles.'
        },
        microCheck: {
          question: 'If both p { color: gray; } and .alert { color: red; } match, which color wins?',
          options: ['gray (Tag)', 'red (Class)', 'Neither'],
          correctIndex: 1,
          explanation: 'A class selector (.alert) has higher specificity than a tag selector (p).'
        },
        widget: { type: 'css-specificity-sim' }
      },
      {
        id: 'm4-box-model-div-span',
        badge: 'BOX MODEL',
        title: 'The CSS Box Model, div & span',
        lead: 'Every element is a box with four layers: Content -> Padding -> Border -> Margin.',
        points: [
          { heading: 'div vs. span', text: '<div> is a full-width block; <span> flows inline inside text.' },
          { heading: 'border-box', text: 'box-sizing: border-box keeps padding and border inside your declared width.' }
        ],
        analogy: {
          title: 'Framed Picture',
          text: 'Content is the photo, Padding is the inner mat, Border is the frame, and Margin is the wall gap outside.'
        },
        takeaway: {
          type: 'info',
          text: 'With content-box, padding and border add extra pixels to width.'
        },
        microCheck: {
          question: 'Under default content-box, what is the rendered width for width: 200px, padding: 20px, border: 5px?',
          options: ['200px', '225px', '250px'],
          correctIndex: 2,
          explanation: '200 + (20 * 2) + (5 * 2) = 250px across left and right sides.'
        },
        widget: { type: 'box-model-sliders' }
      },
      {
        id: 'm4-layout-effects',
        badge: 'LAYOUT & FLEXBOX',
        title: 'Positioning, Flexbox & @media',
        lead: 'Set display: flex on a parent container to align child items cleanly in rows or columns.',
        points: [
          { heading: 'Flex Axes', text: 'justify-content aligns along the main axis; align-items aligns across it.' },
          { heading: 'position & @media', text: 'sticky pins headers during scroll; @media adapts layouts for larger screens.' }
        ],
        analogy: {
          title: 'Shelf Organizer',
          text: 'justify-content spaces items horizontally along the shelf; align-items lines up their height.'
        },
        takeaway: {
          type: 'info',
          text: 'Apply display: flex to the parent container, not the child items.'
        },
        microCheck: {
          question: 'Which property pushes flex items to the outer edges with equal space between?',
          options: ['align-items: center', 'justify-content: space-between', 'position: static'],
          correctIndex: 1,
          explanation: 'justify-content: space-between distributes space evenly between items.'
        },
        widget: { type: 'flexbox-playground' }
      },
      {
        id: 'm4-dom-dhtml',
        badge: 'HTML DOM',
        title: 'HTML DOM, innerHTML & Events',
        lead: 'The DOM is the browser’s live node tree. JavaScript reads and updates elements in real time.',
        points: [
          { heading: 'innerHTML vs. textContent', text: 'innerHTML renders HTML tags; textContent sets plain text safely.' },
          { heading: 'Events & XML DOM', text: 'addEventListener("click", fn) reacts to user actions; DOMParser reads XML trees.' }
        ],
        analogy: {
          title: 'Live Stage Controls',
          text: 'HTML builds the stage once; DOM methods let JavaScript swap text and styles live.'
        },
        takeaway: {
          type: 'info',
          text: 'Use textContent for untrusted user input to prevent XSS script injection.'
        },
        microCheck: {
          question: 'Which property renders HTML tags (like <b>Hello</b>) inside an element?',
          options: ['textContent', 'innerHTML', 'nodeName'],
          correctIndex: 1,
          explanation: 'innerHTML parses HTML markup, while textContent treats tags as plain text.'
        },
        widget: { type: 'dom-clicker' }
      }
    ]
  },

  {
    id: 5,
    code: 'M5',
    title: 'Internet Security Management',
    subtitle: 'Keeping Websites, Passwords, and User Data Safe Online',
    co: 'Defend web apps using CIA Triad principles, packet-filtering firewalls, phishing detection, and legal copyright/open-source practices.',
    icon: 'security',
    labIds: [],
    slideRefs: 'Module 5 · Web Security & HTTPS Principles',
    summary: 'Learn how to keep websites and visitors safe—understand HTTPS padlocks, firewalls, safe password habits, user privacy, and how copyright works on the web.',
    sections: [
      {
        id: 'm5-security-overview',
        badge: 'CIA TRIAD',
        title: 'The CIA Triad & Common Threats',
        lead: 'Web security rests on Confidentiality (privacy), Integrity (no tampering), and Availability (staying online).',
        points: [
          { heading: 'XSS & SQLi', text: 'XSS injects scripts into unsafe innerHTML; SQLi injects database commands.' },
          { heading: 'HTTPS / TLS', text: 'Encrypts data in transit so Wi-Fi sniffers cannot read passwords.' }
        ],
        analogy: {
          title: 'Armored Bank Vault',
          text: 'Confidentiality locks the vault (HTTPS), Integrity seals records, and Availability keeps doors open.'
        },
        takeaway: {
          type: 'info',
          text: 'Prefer textContent over innerHTML, sanitize inputs, and enforce HTTPS.'
        },
        microCheck: {
          question: 'Which CIA pillar guarantees data has NOT been altered in transit?',
          options: ['Confidentiality', 'Integrity', 'Availability'],
          correctIndex: 1,
          explanation: 'Integrity ensures data stays accurate and untampered.'
        },
        widget: { type: 'security-checklist' }
      },
      {
        id: 'm5-firewalls',
        badge: 'FIREWALLS',
        title: 'Firewalls & Packet Filtering',
        lead: 'A firewall filters incoming and outgoing network traffic between your server and the public Internet.',
        points: [
          { heading: 'Packet Filter', text: 'Allows or blocks IP addresses and ports (keep 443 open, block unused ports).' },
          { heading: 'WAF', text: 'Inspects HTTP payloads to block XSS, SQL injection, and bot floods.' }
        ],
        analogy: {
          title: 'Airport Security',
          text: 'A packet filter checks boarding passes (ports/IPs); a WAF scans inside the luggage (HTTP payloads).'
        },
        takeaway: {
          type: 'info',
          text: 'Close unused ports like 22 or unknown ports while keeping HTTPS (443) open.'
        },
        microCheck: {
          question: 'Which firewall inspects HTTP requests to stop XSS and SQL Injection?',
          options: ['Basic Packet Filter', 'Web Application Firewall (WAF)', 'Loopback'],
          correctIndex: 1,
          explanation: 'A WAF inspects application-layer HTTP/HTTPS payloads.'
        },
        widget: { type: 'firewall-sim' }
      },
      {
        id: 'm5-management-privacy',
        badge: 'PRIVACY & PHISHING',
        title: 'Privacy, Passwords & Phishing',
        lead: 'Protect accounts with Multi-Factor Authentication, salted server hashes, and sharp phishing checks.',
        points: [
          { heading: 'Never Store Plain Passwords', text: 'Never save passwords in localStorage; servers store salted bcrypt/Argon2 hashes.' },
          { heading: 'Phishing & Privacy', text: 'Verify the exact root domain + HTTPS padlock, and follow DPDP Act privacy rules.' }
        ],
        analogy: {
          title: 'Look-Alike Shopfront',
          text: 'Phishers copy logos on fake domains (sbi-verify.xyz). Always check the exact domain name.'
        },
        takeaway: {
          type: 'info',
          text: 'Check the root domain before typing any password or OTP.'
        },
        microCheck: {
          question: 'Where should passwords NEVER be stored?',
          options: [
            'Browser localStorage in plain text',
            'Server-side salted hashes',
            'Protected behind MFA'
          ],
          correctIndex: 0,
          explanation: 'Any script on a page can read localStorage; passwords belong only as salted hashes on the server.'
        },
        widget: { type: 'phishing-inspector' }
      },
      {
        id: 'm5-copyright',
        badge: 'COPYRIGHT & LICENSES',
        title: 'Copyright, Creative Commons & Open Source',
        lead: 'Public websites and images remain protected by copyright unless a license grants permission to reuse them.',
        points: [
          { heading: 'Creative Commons', text: 'CC0 waives rights; CC BY permits free reuse as long as you credit the creator.' },
          { heading: 'Open Source', text: 'MIT/Apache allow reuse keeping notices; GPL requires derivatives to stay open source.' }
        ],
        analogy: {
          title: 'Public View vs. Ownership',
          text: 'Seeing a photo online doesn’t grant ownership—look for an explicit CC or MIT license.'
        },
        takeaway: {
          type: 'warning',
          text: 'Academic Integrity: Always write your own code in the labs—never copy uncredited work.'
        },
        microCheck: {
          question: 'What does a Creative Commons "CC BY" license require?',
          options: [
            'Paying a royalty fee',
            'Giving attribution (credit) to the creator',
            'Releasing your site under GPL'
          ],
          correctIndex: 1,
          explanation: 'CC BY permits reuse when proper credit is given to the author.'
        },
        widget: { type: 'license-inspector' }
      }
    ]
  }
];

export const BONUS_MODULE = {
  id: 'bonus',
  title: 'Bonus Sandbox: Bootstrap 5',
  subtitle: 'Optional Practice Playground — Explore Ready-Made Bootstrap 5 Styles',
  slideRefs: 'Slides 08 (Pages 148–169)',
  sections: [
    {
      title: 'What is Bootstrap & How It Works',
      text: 'Bootstrap is a free, open-source, mobile-first CSS framework (ready-made classes for grids, buttons, navbars, cards, alerts, and forms). You can load it via CDN from getbootstrap.com or download it locally.',
      points: [
        'Containers: .container (centred with max-width) vs .container-fluid (always 100% width).',
        '12-Column Grid System: container → row → col-* (numbers in a row add up to 12, e.g., col-8 + col-4 or col-12 col-md-6 col-lg-3).',
        'Breakpoints: col- (all), col-sm- (>=576px), col-md- (>=768px), col-lg- (>=992px), col-xl- (>=1200px), col-xxl- (>=1400px).',
        'Components & Utilities: btn btn-success, alert alert-success, card, form-control, d-flex, m-3, p-2, bg-light. Never edit the Bootstrap file itself—override with your own CSS linked after Bootstrap!'
      ],
      starterHtml: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link rel="stylesheet" href="./vendor/bootstrap/bootstrap.min.css">
</head>
<body class="p-3">
  <div class="container">
    <div class="d-flex justify-content-between align-items-center p-3 bg-light border rounded shadow-sm mb-3">
      <span class="fw-bold text-primary fs-4">My Institute</span>
      <span class="badge bg-danger">Admissions open</span>
      <a href="#" class="btn btn-success btn-sm">Apply</a>
    </div>
    <div class="row g-2 text-center">
      <div class="col-12 col-md-6 col-lg-3 border p-3 bg-warning-subtle rounded">HTML5</div>
      <div class="col-12 col-md-6 col-lg-3 border p-3 bg-info-subtle rounded">CSS3</div>
      <div class="col-12 col-md-6 col-lg-3 border p-3 bg-success-subtle rounded">Bootstrap 5</div>
      <div class="col-12 col-md-6 col-lg-3 border p-3 bg-primary-subtle rounded">JavaScript</div>
    </div>
  </div>
</body>
</html>`
    }
  ]
};

export function getModuleById(id) {
  return MODULES.find((m) => m.id === Number(id)) || null;
}
