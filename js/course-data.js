/**
 * Course Curriculum & Lesson Content: Learning the Web with Basics of Vanilla Front-End Tools
 * Primary Source: presentation3.pdf ("Building the Front End of the Web" by Drubajyoti Debnath, druba.in)
 * Track: Vanilla Web Foundations (druba.in)
 */

export const MODULES = [
  {
    id: 1,
    code: 'M1',
    title: 'The Internet and WWW',
    subtitle: 'How Websites Travel from a Server to Your Screen',
    co: 'What you will learn: Understand what happens when you type a web address, how browsers talk to servers, and how to create your first HTML file.',
    icon: 'public',
    labIds: [],
    slideRefs: 'Slides 01 & 02 + Bigger Picture (Pages 1–34, 220–223)',
    summary: 'Discover how the Internet and the Web work behind the scenes—from web addresses and DNS to browsers, servers, and creating your very first web page.',
    sections: [
      {
        id: 'm1-internet-vs-www',
        badge: '01 · THE INTERNET AND THE WEB',
        title: 'What is the Internet vs World Wide Web?',
        lead: 'Think of the Internet as the physical roads of a country, and the World Wide Web as the buses running on those roads.',
        points: [
          {
            icon: 'lan',
            heading: 'The Internet (The Network)',
            text: 'A worldwide network of networks—devices joined by undersea cables, fibre optics, mobile towers, and satellites following common rules called protocols. No single company or country owns it.'
          },
          {
            icon: 'language',
            heading: 'The World Wide Web (WWW)',
            text: 'Web pages linked to each other via hyperlinks, travelling over the Internet. Note: Email, WhatsApp, and UPI also use the Internet, but they are not the Web.'
          },
          {
            icon: 'history',
            heading: 'Emergence of the Web',
            text: 'Invented by Tim Berners-Lee at CERN in 1989–1991, combining HyperText, URLs, HTTP, and HTML so documents could link across any connected computer.'
          },
          {
            icon: 'apps',
            heading: 'Where We Use the Internet Daily',
            text: 'Communication (email, WhatsApp), Money (UPI, net banking), Government services (DigiLocker, UMANG, IRCTC), Learning (SWAYAM, NPTEL, YouTube), and Shopping/OTT.'
          }
        ],
        callout: {
          type: 'info',
          text: 'Key Distinction: The Internet is the hardware/protocol infrastructure; the World Wide Web is the hypertext information system running on top of it.'
        }
      },
      {
        id: 'm1-url-dns-ip',
        badge: '01 · ADDRESSING ON THE WEB',
        title: 'Website, URL, IP Address & DNS',
        lead: 'Names are for people, numbers are for machines. Every device on the Internet has an IP address, and DNS translates human-friendly domain names into those numbers.',
        points: [
          {
            icon: 'description',
            heading: 'Web Page, Website & Home Page',
            text: 'A Web page is one document in the browser; a Website is related pages kept under one domain; the Home page (typically index.html) is the first page; a Hyperlink takes us to another page.'
          },
          {
            icon: 'tag',
            heading: 'IPv4 vs IPv6 Addresses',
            text: 'IPv4 uses four numbers from 0 to 255 (e.g., 192.168.1.10). IPv6 is longer hexadecimal notation (e.g., 2001:db8::1) built so the world never runs out of addresses.'
          },
          {
            icon: 'menu_book',
            heading: 'DNS: The Phone Book of the Internet',
            text: 'Browser asks DNS server → DNS returns IP address → Browser connects to Web server. Try running "nslookup google.com" in Command Prompt to see the real IP behind a name.'
          }
        ],
        widget: 'url-anatomy',
        codeExamples: [
          {
            filename: 'Command Prompt',
            lang: 'text',
            code: `$ nslookup google.com\n# Browser -> DNS Server -> IP Address -> Web Server`
          }
        ]
      },
      {
        id: 'm1-how-web-works',
        badge: '01 · REQUEST & RESPONSE',
        title: 'Web Browsers, Web Servers & HTTP/HTTPS',
        lead: 'Every time you open a website, a 6-step Request and Response cycle repeats for every HTML page, image, CSS, and JavaScript file.',
        steps: [
          '1. Type the URL in the browser (Chrome, Edge, Firefox, Safari).',
          '2. DNS gives the IP address of the server.',
          '3. Browser sends an HTTP/HTTPS Request.',
          '4. Web Server finds or builds the page.',
          '5. Server returns a Response (e.g., 200 OK, 404 Not Found, 500 Server Error).',
          '6. Browser reads HTML, CSS, and JavaScript and draws the page (Press F12 for Developer Tools).'
        ],
        comparison: {
          leftTitle: 'HTTP (HyperText Transfer Protocol)',
          leftPoints: [
            'The standard rules for request and response on the web',
            'Data travels in plain text—anyone on the network could read it',
            'Default port 80'
          ],
          rightTitle: 'HTTPS (HTTP Secure)',
          rightPoints: [
            'The exact same request/response rules, encrypted with TLS/SSL',
            'Protects passwords, UPI details, and form data in transit',
            'Default port 443 · Shown with a padlock icon'
          ]
        },
        widget: 'http-cycle'
      },
      {
        id: 'm1-architecture',
        badge: '01 · ARCHITECTURE & LANGUAGES',
        title: 'Front End vs Back End, Static vs Dynamic, Responsive Design',
        lead: 'In a restaurant, the dining hall is the front end and the kitchen is the back end. On the web, HTML gives structure, CSS gives presentation, and JavaScript gives behaviour.',
        comparison: {
          leftTitle: 'Front End & Client-Side',
          leftPoints: [
            'What the user sees and touches inside the browser',
            'Quick response with no waiting for the server',
            'Languages: HTML (walls & rooms), CSS (paint & tiles), JavaScript (switches, fans & lift)'
          ],
          rightTitle: 'Back End & Server-Side',
          rightPoints: [
            'Business logic and database operations running on the web server',
            'User cannot see the server-side source code',
            'Technologies: PHP, Python, Java, C#, Node.js, MySQL'
          ]
        },
        points: [
          {
            icon: 'article',
            heading: 'Static vs Dynamic Websites',
            text: 'Static sites send ready-made HTML files—every visitor gets the exact same page (e.g., a school info site or portfolio). Dynamic sites prepare a custom page per request from a database (e.g., IRCTC bookings, net banking, online shopping).'
          },
          {
            icon: 'devices',
            heading: 'Responsive Web Design',
            text: 'One website that fits mobile, tablet, and desktop using fluid layouts, scalable images, and CSS media queries (@media).'
          }
        ]
      },
      {
        id: 'm1-editors-lifecycle',
        badge: '02 · EDITORS & THE FIRST PAGE',
        title: 'Code Editors, VS Code, Emmet & Front-End Life Cycle',
        lead: 'HTML, CSS, and JavaScript are plain text files. Tools like VS Code give syntax colours, Emmet auto-complete, and Live Server refresh.',
        points: [
          {
            icon: 'edit_note',
            heading: 'Naming & Saving Rules',
            text: 'Always end HTML files with .html, use lowercase letters with no spaces (about-us.html), name the home page index.html, and press Ctrl + S before checking.'
          },
          {
            icon: 'bolt',
            heading: 'VS Code Helpers & Shortcuts',
            text: 'Type "!" and press Tab (Emmet) for a full HTML5 boilerplate. Useful shortcuts: Ctrl + S (Save), Ctrl + / (Toggle comment), Shift + Alt + F (Format), Alt + Up/Down (Move line), F12 (Browser DevTools).'
          },
          {
            icon: 'sync',
            heading: 'The 6-Stage Front-End Life Cycle',
            text: '1. Plan → 2. Design (Figma / paper) → 3. Develop (VS Code) → 4. Test (DevTools & mobiles) → 5. Deploy (GitHub Pages) → 6. Maintain (update links, libraries, backups, HTTPS).'
          }
        ],
        codeExamples: [
          {
            filename: 'index.html',
            lang: 'html',
            code: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <title>My First Page</title>\n</head>\n<body>\n  <h1>Hello, World!</h1>\n  <p>This is my first web page.</p>\n</body>\n</html>`
          }
        ]
      }
    ]
  },

  {
    id: 2,
    code: 'M2',
    title: 'HTML & HTML5',
    subtitle: 'Building Web Pages with Text, Links, Images, Tables, Lists & Forms',
    co: 'What you will build: Create complete web pages with headings, formatted text, images, clickable links, schedule tables, nested lists, and sign-up forms.',
    icon: 'code',
    labIds: [1, 2, 3],
    slideRefs: 'Slides 03, 04 & 05 (Pages 35–98)',
    summary: 'Learn how to structure real web pages using HTML5 tags—add headings, paragraphs, images, links, merged tables, organized lists, and interactive sign-up forms.',
    sections: [
      {
        id: 'm2-basics-tags',
        badge: '03 · HTML BASICS',
        title: 'Tags, Elements, Attributes & Nesting',
        lead: 'HTML stands for HyperText Markup Language. It marks content with tags—it is a markup language, not a programming language.',
        points: [
          {
            icon: 'data_object',
            heading: 'Anatomy of an Element',
            text: 'Opening tag + Attribute (name="value") + Content + Closing tag (with a slash). Example: <a href="https://www.india.gov.in">National Portal of India</a>.'
          },
          {
            icon: 'layers',
            heading: 'Nesting & Empty Elements',
            text: 'The tag that opens last must close first: <p>Agartala is the <b>capital</b> of Tripura.</p>. Empty (void) elements have no closing tag: <br>, <hr>, <img>, <input>.'
          },
          {
            icon: 'tune',
            heading: 'Inside the <head> Section',
            text: 'Contains metadata not shown on the page canvas: <meta charset="UTF-8">, viewport meta for mobile responsiveness, <title>, <link rel="stylesheet">, <style>, and <script defer>.'
          }
        ],
        codeExamples: [
          {
            filename: 'index.html',
            lang: 'html',
            code: `<!DOCTYPE html> <!-- this is an HTML5 page -->\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>Home | My Institute</title>\n</head>\n<body>\n  <!-- everything that the user sees -->\n  <h1>Vanilla Web Foundations</h1>\n  <p>Agartala is the <b>capital</b> of Tripura.</p>\n</body>\n</html>`
          }
        ]
      },
      {
        id: 'm2-text-links-images',
        badge: '03 · TEXT, LINKS & IMAGES',
        title: 'Headings, Formatting Tags, Links & Images',
        lead: 'Choose headings (h1 to h6) by document meaning, not by font size—and use only one <h1> per page.',
        points: [
          {
            icon: 'format_bold',
            heading: 'Formatting & <pre>',
            text: 'Use <b>/<strong>, <i>/<em>, <u>, <mark>, <small>, <sub>, <sup>, and <s>/<del> (note: <strike> is removed in HTML5). <pre> keeps spaces and line breaks exactly as typed.'
          },
          {
            icon: 'link',
            heading: 'Anchor Links & Paths',
            text: 'Absolute URLs (https://swayam.gov.in) vs Relative paths (about.html, images/logo.png, ../index.html). Special links: mailto:, tel:, target="_blank", and HTML5 fragment IDs (#fees).'
          },
          {
            icon: 'image',
            heading: 'The <img> Tag',
            text: 'Always include src and descriptive alt text: <img src="images/ujjayanta-palace.jpg" alt="Ujjayanta Palace in Agartala" width="400" height="300">. Common web formats: JPG (photos), PNG (logos), SVG (icons), WebP (smaller size).'
          }
        ],
        codeExamples: [
          {
            filename: 'format-and-links.html',
            lang: 'html',
            code: `<p>Formula: H<sub>2</sub>O and x<sup>2</sup> | <mark>Highlighted</mark></p>\n<p><a href="https://swayam.gov.in" target="_blank">SWAYAM (new tab)</a></p>\n<p><a href="#fees">Go to fee details</a></p>\n<h2 id="fees">Fee Details</h2>`
          }
        ]
      },
      {
        id: 'm2-tables-lists',
        badge: '04 · TABLES & LISTS',
        title: 'HTML Tables (colspan/rowspan) & Lists (ol, ul, dl)',
        lead: 'Organize tabular schedules with <table>, <tr>, <th>, <td> and merge cells using colspan and rowspan.',
        points: [
          {
            icon: 'table_chart',
            heading: 'Tables & Cell Merging',
            text: 'colspan="3" spreads one header/cell across 3 columns. rowspan="2" spreads a cell across 2 rows. Modern HTML5 uses CSS instead of border/cellpadding/cellspacing attributes.'
          },
          {
            icon: 'format_list_numbered',
            heading: 'Ordered (<ol>), Unordered (<ul>) & Definition (<dl>) Lists',
            text: '<ol type="A" start="3"> starts at C. For nested lists, place the inner <ul> or <ol> strictly INSIDE an <li> of the outer list! <dl> pairs <dt> (term) with <dd> (description).'
          }
        ],
        codeExamples: [
          {
            filename: 'merge.html & lists.html',
            lang: 'html',
            code: `<table border="1" cellpadding="8">\n  <tr><th colspan="3">Time Table</th></tr>\n  <tr><td rowspan="2">Monday</td><td>10:30</td><td>HTML</td></tr>\n  <tr><td>12:00</td><td>CSS</td></tr>\n</table>\n\n<ul>\n  <li>Vegetables\n    <ul>\n      <li>Potato</li>\n      <li>Tomato</li>\n    </ul>\n  </li>\n  <li>Milk</li>\n</ul>`
          }
        ]
      },
      {
        id: 'm2-forms-frames',
        badge: '04 · FORMS & FRAMES',
        title: 'Interactive Forms (GET vs POST) & Frames vs Iframes',
        lead: 'Forms collect user input via <form action="..." method="post">. Always pair <label for="..."> with input id for accessibility.',
        comparison: {
          leftTitle: 'method="get"',
          leftPoints: [
            'Appends form data to the URL query string (?q=...)',
            'Good for searches because the page can be bookmarked',
            'NEVER use GET for passwords or sensitive data'
          ],
          rightTitle: 'method="post"',
          rightPoints: [
            'Sends data inside the HTTP request body, hidden from URL',
            'Good for login, registration, and file uploads',
            'Can carry large payloads and binary files'
          ]
        },
        points: [
          {
            icon: 'input',
            heading: 'Form Controls & Radio/Checkbox Rules',
            text: 'Types: text, password, email, number, tel, url, date, time, checkbox, radio, file, range, color, hidden, submit, reset, button. Radio buttons sharing the same name="..." allow ONLY ONE selection.'
          },
          {
            icon: 'web',
            heading: 'Framesets (Legacy) vs <iframe> (HTML5)',
            text: 'Old HTML4 replaced <body> with <frameset cols="25%,75%"><frame src="..."></frameset>. Framesets are removed from HTML5! Today we build layouts with CSS and use <iframe> to embed another page or YouTube video.'
          }
        ],
        codeExamples: [
          {
            filename: 'register.html',
            lang: 'html',
            code: `<form action="register.php" method="post">\n  <p><label for="name">Full Name</label>\n  <input id="name" type="text" name="name" placeholder="Your full name" required></p>\n  <p>Batch:\n    <input type="radio" name="batch" value="morning" id="m" checked><label for="m">Morning</label>\n    <input type="radio" name="batch" value="evening" id="e"><label for="e">Evening</label>\n  </p>\n  <input type="submit" value="Register">\n  <input type="reset" value="Clear">\n</form>`
          }
        ]
      },
      {
        id: 'm2-html5-semantic',
        badge: '05 · HTML5 FEATURES',
        title: 'Semantic Layout, Audio/Video & Smart HTML5 Validation',
        lead: 'Semantic means the tag itself describes the meaning of its content—replacing generic <div id="header"> with <header>, <nav>, <main>, <article>, <aside>, and <footer>.',
        points: [
          {
            icon: 'view_quilt',
            heading: 'HTML5 Semantic Elements',
            text: '<header> (top logo/title), <nav> (navigation menu), <main> (unique primary content), <section> (thematic group), <article> (self-contained post/news), <aside> (sidebar/notices), <footer> (copyright/contact).'
          },
          {
            icon: 'play_circle',
            heading: 'Native <audio> and <video> Without Plugins',
            text: 'Include the "controls" attribute so the play button, timeline, and volume appear! Use <source> elements and optional poster, autoplay, loop, and muted attributes.'
          },
          {
            icon: 'verified',
            heading: 'Built-in HTML5 Form Validation',
            text: 'Use required (prevents empty submission), autofocus, min/max/step on number/range, and pattern="[6-9][0-9]{9}" for Indian 10-digit mobile numbers or "[1-9][0-9]{5}" for 6-digit PIN codes.'
          }
        ],
        codeExamples: [
          {
            filename: 'media-and-validation.html',
            lang: 'html',
            code: `<video width="640" height="360" controls poster="cover.jpg">\n  <source src="lesson.mp4" type="video/mp4">\n  Your browser does not support the video tag.\n</video>\n\n<form>\n  <input type="tel" name="mobile" pattern="[6-9][0-9]{9}" title="10 digits starting with 6-9" required>\n  <input type="submit" value="Check">\n</form>`
          }
        ]
      }
    ]
  },

  {
    id: 3,
    code: 'M3',
    title: 'JavaScript Fundamentals & Objects',
    subtitle: 'Making Pages Interactive with Variables, Logic, Functions & Live Timers',
    co: 'What you will build: Write JavaScript to check form inputs, show helpful messages, work with dates and arrays, and build a live ticking clock.',
    icon: 'javascript',
    labIds: [5, 6],
    slideRefs: 'Slides 09 & 10 (Pages 170–194, 207–213)',
    summary: 'Bring your pages to life with JavaScript—store information in variables, make decisions with if/else, repeat tasks with loops, handle errors cleanly, and build a live digital clock.',
    sections: [
      {
        id: 'm3-basics-vars-ops',
        badge: '09 · JAVASCRIPT BASICS',
        title: 'Variables, Data Types & Operators',
        lead: 'JavaScript is the programming language of the browser (NOT Java—only the name is similar!). Place <script> at the end of <body> or use defer so the HTML is ready first.',
        points: [
          {
            icon: 'data_array',
            heading: 'let, const & Data Types',
            text: 'Use const by default, let when values change, and avoid legacy var. Types include string, number (82, 1500.50), boolean (true/false), undefined, null, array, and object (checked with typeof).'
          },
          {
            icon: 'calculate',
            heading: 'Operators & String Concatenation Pitfall',
            text: 'Arithmetic (+, -, *, /, %, **), Assignment (+=, ++). Watch out: "5" + 5 becomes "55" (string concatenation)! Convert inputs with Number("25") + 5 = 30.'
          },
          {
            icon: 'compare_arrows',
            heading: 'Strict Equality (===) vs Loose (==) & Logical Ops',
            text: '"5" == 5 is true (value only), whereas "5" === 5 is false (checks BOTH value and type). Always prefer === and !==. Logical operators: && (AND), || (OR), ! (NOT).'
          }
        ],
        codeExamples: [
          {
            filename: 'app.js',
            lang: 'javascript',
            code: `const city = "Agartala";\nlet marks = 82;\nmarks = 90;\nconsole.log("5" == 5);   // true\nconsole.log("5" === 5);  // false (prefer ===)\nconsole.log(Number("25") + 5); // 30`
          }
        ]
      },
      {
        id: 'm3-control-loops-funcs',
        badge: '09 · FLOW & FUNCTIONS',
        title: 'Conditionals, Loops & Functions',
        lead: 'Write once, use many times with functions—and control execution with if/else, switch, for, while, and do...while.',
        points: [
          {
            icon: 'alt_route',
            heading: 'if...else if...else & switch',
            text: 'In an if/else chain, only the first block whose condition is true runs. In switch(day), always include break; at the end of each case to prevent fall-through.'
          },
          {
            icon: 'loop',
            heading: 'for, while, and do...while',
            text: 'while checks the condition first before running. do...while runs the block at least ONCE, then checks the condition.'
          },
          {
            icon: 'functions',
            heading: 'Functions & Default Parameters',
            text: 'function greet(name = "Friend") { return "Hello, " + name + "!"; } returns "Hello, Friend!" if no argument is passed.'
          }
        ],
        codeExamples: [
          {
            filename: 'control.js',
            lang: 'javascript',
            code: `for (let i = 1; i <= 5; i++) {\n  console.log("7 x " + i + " = " + 7 * i);\n}\n\nlet n = 10;\ndo {\n  console.log("Runs once, n is " + n);\n} while (n < 5);`
          }
        ]
      },
      {
        id: 'm3-objects-builtin',
        badge: '09 · OBJECTS OF JAVASCRIPT',
        title: 'Arrays, Custom Objects & Built-in Objects (Date, Math, Boolean, String)',
        lead: 'Arrays count from index 0, not 1. JavaScript also gives us powerful built-in objects ready to use.',
        points: [
          {
            icon: 'list',
            heading: 'Array Object',
            text: 'let fruits = ["Mango", "Banana", "Litchi"]; → fruits[1] is "Banana". Methods: .length, .push("Guava"), .pop(), .map(), .filter(), and for (let f of fruits).'
          },
          {
            icon: 'calendar_month',
            heading: 'Date Object',
            text: 'let today = new Date(); provides .getFullYear(), .getMonth() (0-11), .getDate(), .getHours(), .getMinutes(), .getSeconds(), .toLocaleDateString("en-IN"), and .toLocaleTimeString().'
          },
          {
            icon: 'functions',
            heading: 'Math, Boolean & String Objects',
            text: 'Math.round(4.6) → 5, Math.max(12, 45, 7) → 45, Math.floor(Math.random() * 6) + 1 (dice roll 1–6). Boolean(value) checks truthiness (0, "", null, undefined are false). String has .length, .trim(), .toUpperCase(), .includes().'
          }
        ],
        codeExamples: [
          {
            filename: 'objects.js',
            lang: 'javascript',
            code: `const student = {\n  name: "Ananya",\n  rollNo: 12,\n  marks: [82, 76, 91],\n  greet() { return "I am " + this.name; }\n};\nconst today = new Date();\nconsole.log(today.toLocaleDateString("en-IN"));\nconsole.log(Math.floor(Math.random() * 6) + 1);`
          }
        ]
      },
      {
        id: 'm3-popups-try-catch',
        badge: '09 · POPUPS & EXCEPTION HANDLING',
        title: 'Popup Boxes & Error Handling (try, catch, finally, throw)',
        lead: 'Never let an unexpected runtime error crash your entire script—wrap risky logic in try...catch and raise custom validation rules with throw.',
        points: [
          {
            icon: 'chat_bubble',
            heading: 'Three Popup Boxes',
            text: 'alert("Saved!") shows a message; confirm("Delete?") returns true/false; prompt("Your name?", "Guest") returns entered string or null.'
          },
          {
            icon: 'bug_report',
            heading: 'try...catch...finally',
            text: 'try runs code; if an error occurs, execution jumps straight to catch(error) with error.message; finally ALWAYS runs whether an error happened or not.'
          },
          {
            icon: 'warning',
            heading: 'Custom Rules with throw',
            text: 'throw new Error("Limit is 10000") lets you enforce your own validation rules (like empty name, invalid email, or short password) and catch them cleanly!'
          }
        ],
        codeExamples: [
          {
            filename: 'errors.js',
            lang: 'javascript',
            code: `function withdraw(amount) {\n  if (amount > 10000) {\n    throw new Error("Limit is 10000");\n  }\n  return "Please collect " + amount;\n}\n\ntry {\n  console.log(withdraw(50000));\n} catch (error) {\n  console.log("Error: " + error.message);\n} finally {\n  console.log("Transaction check finished.");\n}`
          }
        ]
      },
      {
        id: 'm3-es6-modern',
        badge: '10 · ES6 & MODERN JAVASCRIPT',
        title: 'Template Literals, Arrow Functions, Destructuring, Modules & Fetch',
        lead: 'Modern ES6+ JavaScript makes code cleaner, shorter, and modular.',
        points: [
          {
            icon: 'code',
            heading: 'Template Literals & Arrow Functions',
            text: 'Backticks allow interpolation: `Hi ${student}, marks: ${marks}`. Arrow functions: const cube = (n) => n * n * n; work cleanly with .filter() and .map().'
          },
          {
            icon: 'call_split',
            heading: 'Destructuring, Spread & ES Modules',
            text: 'const { fullName, city } = student; and const fullDay = [...morning, "JavaScript"];. Modules use export and import with <script type="module"> (requires an HTTP server, not file:// double-click).'
          },
          {
            icon: 'cloud_download',
            heading: 'JSON & async fetch()',
            text: 'fetch() loads JSON data asynchronously without reloading the whole page, updating only the needed part of the DOM.'
          }
        ]
      }
    ]
  },

  {
    id: 4,
    code: 'M4',
    title: 'CSS & DOM Techniques',
    subtitle: 'Styling Layouts with Colors, Fonts, the Box Model, Flexbox & Live Page Updates',
    co: 'What you will build: Style web pages with custom colors, spacing, borders, and flexible layouts, and use JavaScript to update page content when a button is clicked.',
    icon: 'palette',
    labIds: [4, 7, 8],
    slideRefs: 'Slides 06, 07 & 10 (Pages 99–147, 195–206)',
    summary: 'Make your websites look great on any screen using CSS colors, fonts, the Box Model, and Flexbox—and use JavaScript to update text and styles on the fly.',
    sections: [
      {
        id: 'm4-css-types-selectors',
        badge: '06 · CSS FUNDAMENTALS',
        title: 'Three Types of CSS, Selectors & Specificity',
        lead: 'CSS (Cascading Style Sheets) separates design from HTML content so one stylesheet can style an entire website.',
        points: [
          {
            icon: 'style',
            heading: 'Inline, Internal & External CSS',
            text: 'Inline: style="..." inside one tag. Internal: <style> inside <head> for one page. External: <link rel="stylesheet" href="style.css"> for all pages (always preferred for real sites).'
          },
          {
            icon: 'ads_click',
            heading: 'Tag, Class (.alert), ID (#title), Universal & Sub-selectors',
            text: 'A dot (.) selects a reusable class; a hash (#) selects a unique id. Group with comma (h1, h2). Space (.box p) selects any descendant; > (.box > p) selects only direct children. Attribute selector: input[type="text"].'
          },
          {
            icon: 'balance',
            heading: 'Specificity Order (When Rules Clash)',
            text: 'Tag < Class < ID < Inline style. The more specific selector wins; if equal, the rule written last wins.'
          }
        ],
        codeExamples: [
          {
            filename: 'style.css',
            lang: 'css',
            code: `p { color: gray; }            /* tag */\n.alert { color: red; }        /* class (reusable) */\n#title { color: darkblue; }   /* id (unique) */\n.box > p { font-weight: bold; } /* direct child */`
          }
        ]
      },
      {
        id: 'm4-box-model-div-span',
        badge: '06 · BOX MODEL, DIV & SPAN',
        title: 'The CSS Box Model, Display, div & span',
        lead: 'Every HTML element is a rectangular box made of four layers: Content → Padding → Border → Margin.',
        points: [
          {
            icon: 'check_box_outline_blank',
            heading: 'div (Block) vs span (Inline)',
            text: '<div> is a block container that starts on a new line and spans full width; <span> is inline and stays inside a line of text. display: inline-block lets elements sit side by side while respecting width/height!'
          },
          {
            icon: 'crop_square',
            heading: 'Total Box Width & box-sizing: border-box',
            text: 'With content-box (default), width: 200px + padding: 20px (x2) + border: 5px (x2) = 250px! Setting box-sizing: border-box keeps the total rendered width strictly at 200px.'
          }
        ],
        widget: 'box-model',
        codeExamples: [
          {
            filename: 'box-model.css',
            lang: 'css',
            code: `.box {\n  width: 200px;\n  padding: 20px;          /* inside the border */\n  border: 5px solid green;\n  margin: 30px;           /* outside the border */\n  box-sizing: border-box; /* keeps total width at 200px */\n}`
          }
        ]
      },
      {
        id: 'm4-layout-effects',
        badge: '07 · CSS LAYOUT & EFFECTS',
        title: 'Positioning, Flexbox, Pseudo-classes, Transitions & Media Queries',
        lead: 'Arrange page regions side by side with Flexbox, keep headers sticky or buttons fixed, and adapt layouts across screens with @media queries.',
        points: [
          {
            icon: 'push_pin',
            heading: 'The position Property',
            text: 'static (default flow), relative (offset from normal place), absolute (placed inside nearest positioned parent), fixed (stuck to viewport during scroll), sticky (scrolls normally then sticks at top: 0).'
          },
          {
            icon: 'view_column',
            heading: 'Flexbox Layout',
            text: 'display: flex on the parent container controls flex-direction (row/column), justify-content (main axis), align-items (cross axis), flex-wrap, and gap.'
          },
          {
            icon: 'animation',
            heading: 'Pseudo-classes, Transitions & Animations',
            text: ':hover triggers on mouse over; :focus when cursor is inside an input. transition animates changes smoothly on hover; @keyframes + animation runs automatically.'
          }
        ],
        codeExamples: [
          {
            filename: 'layout.css',
            lang: 'css',
            code: `.middle { display: flex; gap: 16px; }\nmain { flex: 3; }\naside { flex: 1; background: #FFE0B2; }\n\n@media (min-width: 768px) {\n  .col { width: 50%; }\n}`
          }
        ]
      },
      {
        id: 'm4-dom-dhtml-xmldom',
        badge: '10 · DOM, DHTML & XML DOM',
        title: 'HTML DOM, innerHTML, Events, DHTML Forms, Web Storage & XML DOM',
        lead: 'The Document Object Model (DOM) is the browser’s live tree of objects for the page—JavaScript can read it, modify innerHTML/styles, and react to events.',
        points: [
          {
            icon: 'account_tree',
            heading: 'Selecting & Modifying Elements (DHTML)',
            text: 'document.getElementById("title"), document.querySelector(".alert"), document.querySelectorAll("li"). Modify textContent (plain text) or innerHTML (renders HTML tags inside), element.style.backgroundColor, and element.classList.toggle("dark").'
          },
          {
            icon: 'touch_app',
            heading: 'Events & DHTML Forms',
            text: 'Use element.addEventListener("click", fn) or form.addEventListener("submit", fn). Call e.preventDefault() in submit handlers so JS validates form fields before submission. Create nodes dynamically with document.createElement("li") and .append(li).'
          },
          {
            icon: 'storage',
            heading: 'localStorage vs sessionStorage',
            text: 'localStorage persists even after closing the browser; sessionStorage clears when the tab closes. Both store strings only (use JSON.stringify / JSON.parse for objects)—never store passwords in them!'
          },
          {
            icon: 'code_blocks',
            heading: 'XML DOM (Syllabus Concept)',
            text: 'Just as HTML DOM represents an HTML page as a tree, XML DOM represents structured XML documents as a navigable node tree. In browsers, new DOMParser().parseFromString(xmlText, "text/xml") parses XML so getElementsByTagName() can read each node.'
          }
        ],
        codeExamples: [
          {
            filename: 'dom-and-xmldom.js',
            lang: 'javascript',
            code: `// HTML DOM & DHTML\nconst info = document.querySelector(".info");\ninfo.innerHTML = "Text with <b>bold</b>";\ninfo.style.backgroundColor = "lightyellow";\n\n// XML DOM example\nconst xmlStr = "<student><name>Ananya</name><city>Agartala</city></student>";\nconst xmlDoc = new DOMParser().parseFromString(xmlStr, "text/xml");\nconsole.log(xmlDoc.getElementsByTagName("name")[0].textContent); // "Ananya"`
          }
        ]
      }
    ]
  },

  {
    id: 5,
    code: 'M5',
    title: 'Internet Security Management',
    subtitle: 'Keeping Websites, Passwords, and User Data Safe Online',
    co: 'What you will learn: Spot common web threats like phishing and unsafe scripts, understand how HTTPS and firewalls protect data, and respect copyright and privacy.',
    icon: 'security',
    labIds: [],
    slideRefs: 'Module 5 · Web Security & HTTPS Principles',
    summary: 'Learn how to keep websites and visitors safe—understand HTTPS padlocks, firewalls, safe password habits, user privacy, and how copyright works on the web.',
    sections: [
      {
        id: 'm5-security-overview',
        badge: '05 · INTERNET SECURITY OVERVIEW',
        title: 'The CIA Triad & Common Web Threats',
        lead: 'Building websites is only half the job—keeping user data, passwords, and servers safe from attacks is critical for every developer.',
        points: [
          {
            icon: 'verified_user',
            heading: 'CIA Triad: Confidentiality, Integrity & Availability',
            text: 'Confidentiality keeps secrets encrypted (HTTPS/TLS); Integrity ensures data is not tampered with in transit (security checksums and digital signatures); Availability ensures sites stay online against crashes or DDoS floods.'
          },
          {
            icon: 'phishing',
            heading: 'Phishing & Social Engineering',
            text: 'Fake emails, SMS, or look-alike login websites tricking users into typing UPI PINs, OTPs, or passwords. Always inspect the exact domain name and HTTPS padlock.'
          },
          {
            icon: 'bug_report',
            heading: 'XSS (Cross-Site Scripting) & SQL Injection',
            text: 'XSS injects malicious <script> into unsafe innerHTML output; use textContent or sanitize input. SQL Injection injects database commands into forms; use parameterized queries on the server.'
          },
          {
            icon: 'lock',
            heading: 'HTTPS, SSL/TLS & Certificates',
            text: 'As covered in Module 1, HTTPS encrypts browser-to-server traffic using TLS certificates so eavesdroppers on public Wi-Fi cannot read passwords or session cookies.'
          }
        ],
        widget: 'security-checklist'
      },
      {
        id: 'm5-firewalls',
        badge: '05 · FIREWALLS & NETWORK DEFENCE',
        title: 'Firewalls: Types & How They Protect Networks',
        lead: 'A firewall acts like a security gatekeeper between an internal trusted network (or computer) and the untrusted public Internet, inspecting incoming and outgoing traffic against security rules.',
        points: [
          {
            icon: 'filter_alt',
            heading: 'Packet Filtering Firewall',
            text: 'Inspects network packet headers (source/destination IP addresses, port numbers like 80 for HTTP, 443 for HTTPS, and TCP/UDP protocol) and allows or blocks them based on Access Control Lists (ACLs).'
          },
          {
            icon: 'fact_check',
            heading: 'Stateful Inspection Firewall',
            text: 'Tracks the state of active network connections—distinguishing legitimate response packets belonging to an established session from unsolicited incoming probes.'
          },
          {
            icon: 'dns',
            heading: 'Proxy Firewall (Application-Level Gateway)',
            text: 'Intercepts requests on behalf of users, hides internal client IP addresses, caches safe content, and filters traffic at the application layer (HTTP, FTP).'
          },
          {
            icon: 'shield',
            heading: 'Web Application Firewall (WAF)',
            text: 'Sits specifically in front of web servers to inspect HTTP/HTTPS requests and block web-specific attacks such as XSS, SQL Injection, and automated bot floods.'
          }
        ],
        comparison: {
          leftTitle: 'Network / Packet Firewall',
          leftPoints: [
            'Operates at Network & Transport layers (IP & Ports)',
            'Very fast rule matching',
            'Blocks unauthorized ports (e.g., open SSH or DB ports)'
          ],
          rightTitle: 'Web Application Firewall (WAF)',
          rightPoints: [
            'Operates at Application layer (HTTP/HTTPS payloads)',
            'Inspects URLs, query strings, cookies & POST bodies',
            'Blocks XSS, SQLi & malicious HTTP payloads'
          ]
        }
      },
      {
        id: 'm5-management-privacy',
        badge: '05 · MANAGEMENT & PRIVACY',
        title: 'Security Management Concepts & Information Privacy',
        lead: 'Good security management combines technical safeguards (authentication, encryption, least privilege, backups) with strict respect for user privacy.',
        points: [
          {
            icon: 'password',
            heading: 'Authentication, MFA & Password Hashing',
            text: 'Passwords must NEVER be stored in plain text or in browser localStorage/sessionStorage. Servers store salted cryptographic hashes (bcrypt/Argon2) and enforce Multi-Factor Authentication (MFA / OTP).'
          },
          {
            icon: 'admin_panel_settings',
            heading: 'Least Privilege & Regular Backups',
            text: 'Give users and scripts only the minimum permissions needed. Maintain regular offline/cloud backups and keep libraries updated (Website Maintenance, Slide 222) to recover from ransomware or hardware failure.'
          },
          {
            icon: 'visibility_off',
            heading: 'Information Privacy & Cookies',
            text: 'Websites use cookies and browser storage to remember sessions or track browsing across sites. Ethical web apps collect only necessary data, display clear privacy notices, and follow legal frameworks like India’s Digital Personal Data Protection (DPDP) Act and IT Act, 2000.'
          }
        ]
      },
      {
        id: 'm5-copyright',
        badge: '05 · COPYRIGHT & INTELLECTUAL PROPERTY',
        title: 'Copyright Issues, Plagiarism & Open-Source Licensing',
        lead: 'Just because an image, article, or piece of code is published on a public website does NOT mean it is free to copy without permission.',
        points: [
          {
            icon: 'copyright',
            heading: 'Copyright & Digital Assets',
            text: 'Text, photographs, UI designs, audio, videos, and source code are automatically protected by copyright law. Copying someone else’s images or website templates without a license or attribution is infringement.'
          },
          {
            icon: 'public',
            heading: 'Creative Commons (CC) & Fair Use',
            text: 'Creators use Creative Commons licenses (like CC BY or CC0) to allow legal sharing with attribution. Educational "fair use/fair dealing" has strict limits and always requires proper credit.'
          },
          {
            icon: 'code',
            heading: 'Open Source Software Licenses (MIT, GPL, Apache)',
            text: 'Bootstrap, CodeMirror, and DaisyUI use open-source licenses (such as MIT). Permissive licenses (MIT, Apache 2.0) allow commercial and educational use while keeping copyright notices; copyleft licenses (GPL) require derivative works to remain open source.'
          }
        ],
        callout: {
          type: 'warning',
          text: 'Academic Integrity Reminder: Always write your own HTML, CSS, and JavaScript in the practical labs—never copy-paste another student’s code or uncredited external templates!'
        }
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
      starterHtml: `<!DOCTYPE html>\n<html lang="en">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1">\n  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css">\n</head>\n<body class="p-3">\n  <div class="container">\n    <div class="d-flex justify-content-between align-items-center p-3 bg-light border rounded shadow-sm mb-3">\n      <span class="fw-bold text-primary fs-4">My Institute</span>\n      <span class="badge bg-danger">Admissions open</span>\n      <a href="#" class="btn btn-success btn-sm">Apply</a>\n    </div>\n    <div class="row g-2 text-center">\n      <div class="col-12 col-md-6 col-lg-3 border p-3 bg-warning-subtle rounded">HTML5</div>\n      <div class="col-12 col-md-6 col-lg-3 border p-3 bg-info-subtle rounded">CSS3</div>\n      <div class="col-12 col-md-6 col-lg-3 border p-3 bg-success-subtle rounded">Bootstrap 5</div>\n      <div class="col-12 col-md-6 col-lg-3 border p-3 bg-primary-subtle rounded">JavaScript</div>\n    </div>\n  </div>\n</body>\n</html>`
    }
  ]
};

export function getModuleById(id) {
  return MODULES.find((m) => m.id === Number(id)) || null;
}
