/**
 * Graded Active-Recall MCQs for Vanilla Web Foundations (10 questions per Module = 50 total)
 * Incorporates all Checkpoints from presentation3.pdf + front-end engineering fundamentals.
 * Passing Score: >= 60%
 */

export const QUIZZES = {
  1: {
    moduleId: 1,
    title: 'Module 1 Checkpoint: The Internet & World Wide Web',
    passingPercent: 60,
    questions: [
      {
        id: 'm1-q1',
        question: 'What converts a human-readable domain name (like google.com) into an IP address?',
        options: ['HTTP', 'The browser cache', 'DNS', 'HTML'],
        correctIndex: 2,
        explanation: 'DNS (Domain Name System) acts as the phone book of the Internet, translating domain names into numeric IP addresses.'
      },
      {
        id: 'm1-q2',
        question: 'Which language runs in the user’s browser, on the client side?',
        options: ['PHP', 'JavaScript', 'MySQL', 'Python'],
        correctIndex: 1,
        explanation: 'JavaScript executes directly inside the user’s web browser on the client side. PHP, Python, and MySQL run on the server.'
      },
      {
        id: 'm1-q3',
        question: 'A website that shows your own bookings after login (like IRCTC) is…',
        options: ['A dynamic website', 'A static website', 'A search engine', 'A browser'],
        correctIndex: 0,
        explanation: 'Dynamic websites prepare a personalized page for each user request using a database and server-side logic.'
      },
      {
        id: 'm1-q4',
        question: 'In the URL below, what part is "?batch=morning"?',
        code: 'https://www.example.in/courses/web-design.html?batch=morning#fees',
        options: ['Protocol', 'Domain name', 'Query string', 'Fragment'],
        correctIndex: 2,
        explanation: 'Everything after "?" is the query string carrying extra information (?batch=morning), while "#fees" is the fragment pointing to a section inside the page.'
      },
      {
        id: 'm1-q5',
        question: 'Which statement accurately contrasts the Internet and the World Wide Web?',
        options: [
          'They are exact synonyms for the same software',
          'The Internet is the global network of networks; the Web is hyperlinked pages travelling over it',
          'WhatsApp and UPI are part of the World Wide Web, not the Internet',
          'One company owns the World Wide Web and charges per hyperlink'
        ],
        correctIndex: 1,
        explanation: 'Like roads vs buses, the Internet is the network infrastructure itself, while the Web is linked pages travelling over it. Email, WhatsApp, and UPI use the Internet without being the Web.'
      },
      {
        id: 'm1-q6',
        question: 'What is the key difference between HTTP and HTTPS?',
        options: [
          'HTTPS only works for static websites',
          'HTTPS is encrypted and secure during request and response',
          'HTTP automatically fixes 404 Not Found errors',
          'HTTPS removes the need for DNS'
        ],
        correctIndex: 1,
        explanation: 'HTTPS uses the same HTTP request-and-response rules, but encrypts the communication using TLS/SSL to keep data safe.'
      },
      {
        id: 'm1-q7',
        question: 'When a browser requests a page that does not exist on the server, which HTTP status code is returned?',
        options: ['200 OK', '301 Moved', '404 Not Found', '500 Server Error'],
        correctIndex: 2,
        explanation: '200 indicates success (OK), 404 indicates the requested resource was Not Found, and 500 indicates an internal Server Error.'
      },
      {
        id: 'm1-q8',
        question: 'Which of these is a valid IPv4 address format?',
        options: ['2001:db8::1', '192.168.1.10', 'www.example.in', '256.300.1.999'],
        correctIndex: 1,
        explanation: 'IPv4 consists of four numbers separated by dots, each ranging from 0 to 255 (e.g., 192.168.1.10). "2001:db8::1" is IPv6.'
      },
      {
        id: 'm1-q9',
        question: 'In the "three languages of the front end" analogy, what role does JavaScript play?',
        options: [
          'The walls and rooms of a house (Structure)',
          'The paint, tiles, and furniture (Presentation)',
          'The switches, fans, and lift (Behaviour)',
          'The restaurant kitchen storing database records'
        ],
        correctIndex: 2,
        explanation: 'HTML provides Structure (walls and rooms), CSS provides Presentation (paint and tiles), and JavaScript provides Behaviour (switches, fans, and lift).'
      },
      {
        id: 'm1-q10',
        question: 'In VS Code, what shortcut opens Emmet’s full HTML5 page boilerplate and which browser key opens Developer Tools?',
        options: [
          'Type "?" + Enter; press F5 for DevTools',
          'Type "!" + Tab; press F12 for DevTools',
          'Press Ctrl + /; press F1 for DevTools',
          'Type "html5" + Ctrl + S; press F2 for DevTools'
        ],
        correctIndex: 1,
        explanation: 'Typing "!" and pressing Tab expands a complete HTML5 template via Emmet, and F12 opens the browser’s Developer Tools.'
      }
    ]
  },

  2: {
    moduleId: 2,
    title: 'Module 2 Checkpoint: HTML & HTML5 Mastery',
    passingPercent: 60,
    questions: [
      {
        id: 'm2-q1',
        question: 'Which file name does a web server look for by default as the home page of a website?',
        options: ['home.txt', 'main.css', 'first.html', 'index.html'],
        correctIndex: 3,
        explanation: 'The home page of a website is conventionally always named index.html.'
      },
      {
        id: 'm2-q2',
        question: 'Which attribute of the <a> (anchor) tag holds the destination URL of the link?',
        options: ['href', 'src', 'alt', 'link'],
        correctIndex: 0,
        explanation: 'href specifies the link destination for <a> tags. src specifies the source path for <img>, and alt provides alternate text.'
      },
      {
        id: 'm2-q3',
        question: 'Which of these is an empty (void) element with NO closing tag?',
        options: ['<p>', '<br>', '<h1>', '<div>'],
        correctIndex: 1,
        explanation: '<br>, <hr>, <img>, and <input> have no inner content, so they have no closing tag.'
      },
      {
        id: 'm2-q4',
        question: 'Which attribute makes a table cell cover two columns horizontally?',
        code: '<th ____="2">Schedule</th>',
        options: ['rowspan="2"', 'colspan="2"', 'cellpadding="2"', 'border="2"'],
        correctIndex: 1,
        explanation: 'colspan spreads a cell across columns horizontally; rowspan spreads a cell vertically across rows.'
      },
      {
        id: 'm2-q5',
        question: 'The user must choose ONLY ONE option (e.g., Morning or Evening batch). Which input type should you use with a shared name attribute?',
        options: ['checkbox', 'text', 'radio', 'file'],
        correctIndex: 2,
        explanation: 'Radio buttons sharing the same name="..." allow only a single choice, whereas checkboxes allow multiple selections.'
      },
      {
        id: 'm2-q6',
        question: 'Which HTML form method keeps sensitive form data (like passwords) out of the URL?',
        options: ['GET', 'LINK', 'SHOW', 'POST'],
        correctIndex: 3,
        explanation: 'POST sends form data inside the HTTP request body rather than appending it to the URL query string like GET does.'
      },
      {
        id: 'm2-q7',
        question: 'Which HTML5 semantic element is specifically meant for the main navigation menu?',
        options: ['<nav>', '<menu-bar>', '<aside>', '<section>'],
        correctIndex: 0,
        explanation: '<nav> semantically wraps the primary navigation links of a page.'
      },
      {
        id: 'm2-q8',
        question: 'Which HTML5 attribute makes a form field compulsory before the browser allows submission?',
        options: ['autofocus', 'placeholder', 'required', 'readonly'],
        correctIndex: 2,
        explanation: 'Adding required prevents the browser from submitting the form while that field is empty.'
      },
      {
        id: 'm2-q9',
        question: 'A <video> player appears on the page, but shows no play button, timeline, or volume control. Which attribute is missing?',
        options: ['poster', 'loop', 'muted', 'controls'],
        correctIndex: 3,
        explanation: 'The controls attribute tells the browser to display the built-in play button, progress bar, and volume controls.'
      },
      {
        id: 'm2-q10',
        question: 'Where must an inner nested <ul> list be placed inside an outer <ul> list to write valid HTML?',
        code: '<ul>\n  <li>Vegetables\n    <!-- Where does inner <ul> go? -->\n  </li>\n</ul>',
        options: [
          'Directly between two <li>...</li> siblings',
          'Inside the <li>...</li> element of the outer list',
          'Inside the <head> section',
          'After the closing </ul> tag'
        ],
        correctIndex: 1,
        explanation: 'In HTML, an inner nested list must always be placed inside an <li> element of the outer list, never directly inside <ul> outside an <li>.'
      }
    ]
  },

  3: {
    moduleId: 3,
    title: 'Module 3 Checkpoint: JavaScript Fundamentals & Objects',
    passingPercent: 60,
    questions: [
      {
        id: 'm3-q1',
        question: 'Which keyword creates a JavaScript variable whose reference cannot be reassigned?',
        options: ['let', 'var', 'const', 'fixed'],
        correctIndex: 2,
        explanation: 'const is for constants that should not be reassigned; let is for values that change.'
      },
      {
        id: 'm3-q2',
        question: 'What does the strict equality expression "5" === 5 evaluate to?',
        options: ['false', 'true', '55', 'A SyntaxError'],
        correctIndex: 0,
        explanation: 'Triple equals (===) checks both value AND data type. Since "5" is a string and 5 is a number, it returns false.'
      },
      {
        id: 'm3-q3',
        question: 'In the array below, what value is stored at index 1?',
        code: 'let fruits = ["Mango", "Banana", "Litchi"];\nconsole.log(fruits[1]);',
        options: ['Mango', 'Banana', 'Litchi', 'undefined'],
        correctIndex: 1,
        explanation: 'Array indexing starts at 0, so fruits[0] is "Mango" and fruits[1] is "Banana".'
      },
      {
        id: 'm3-q4',
        question: 'What will be printed to the console by this JavaScript code?',
        code: 'let a = "5";\nlet b = 5;\nconsole.log(a + b);',
        options: ['10', '"55"', 'NaN', 'Error'],
        correctIndex: 1,
        explanation: 'When + is used with a string ("5"), JavaScript performs string concatenation, producing "55". Use Number(a) + b to add numerically.'
      },
      {
        id: 'm3-q5',
        question: 'What is the output of this do...while loop?',
        code: 'let n = 10;\ndo {\n  console.log(n);\n} while (n < 5);',
        options: [
          'Nothing is printed because 10 < 5 is false',
          '10 is printed once, then the loop stops',
          'An infinite loop occurs',
          '5 is printed'
        ],
        correctIndex: 1,
        explanation: 'Unlike while, a do...while loop executes its body ONCE before checking the condition, so 10 is printed once.'
      },
      {
        id: 'm3-q6',
        question: 'In a try...catch...finally block, which statement is ALWAYS true?',
        options: [
          'The finally block runs only when an error is thrown',
          'The catch block runs even if there is no error',
          'The finally block runs whether an error occurred or not',
          'throw automatically restarts the try block from line 1'
        ],
        correctIndex: 2,
        explanation: 'The finally block is guaranteed to execute after try (and catch, if an error occurred), regardless of whether an exception happened.'
      },
      {
        id: 'm3-q7',
        question: 'Which statement creates a custom validation error inside a function so catch(error) can handle it?',
        options: [
          'catch new Error("Invalid")',
          'throw new Error("Invalid")',
          'alert("Invalid")',
          'return Error("Invalid")'
        ],
        correctIndex: 1,
        explanation: 'The throw statement raises a custom exception (e.g., throw new Error("Limit is 10000")) that jumps into the nearest catch block.'
      },
      {
        id: 'm3-q8',
        question: 'Which built-in JavaScript expression generates a random whole integer from 1 to 6 (like a dice roll)?',
        options: [
          'Math.round(Math.random() * 6)',
          'Math.floor(Math.random() * 6) + 1',
          'Math.max(1, 6)',
          'Number.random(1, 6)'
        ],
        correctIndex: 1,
        explanation: 'Math.random() returns [0, 1). Multiplying by 6 gives [0, 6), Math.floor() gives integers 0..5, and + 1 shifts it to 1..6.'
      },
      {
        id: 'm3-q9',
        question: 'Which popup box asks the user to choose OK or Cancel and returns a Boolean (true or false)?',
        options: ['alert()', 'prompt()', 'confirm()', 'dialog()'],
        correctIndex: 2,
        explanation: 'confirm("Delete this file?") displays OK/Cancel and returns true or false. prompt() returns text input, and alert() returns undefined.'
      },
      {
        id: 'm3-q10',
        question: 'Which Date object method returns the four-digit year (e.g., 2026) of a Date instance `today`?',
        code: 'let today = new Date();',
        options: [
          'today.getYear()',
          'today.getFullYear()',
          'today.year()',
          'Date.nowYear()'
        ],
        correctIndex: 1,
        explanation: 'getFullYear() returns the 4-digit year of a Date object (whereas legacy getYear() is deprecated).'
      }
    ]
  },

  4: {
    moduleId: 4,
    title: 'Module 4 Checkpoint: CSS, Box Model & DOM Techniques',
    passingPercent: 60,
    questions: [
      {
        id: 'm4-q1',
        question: 'Which CSS selector styles every element with class="alert"?',
        options: ['#alert', '.alert', 'alert', '*alert'],
        correctIndex: 1,
        explanation: 'A dot (.) targets a class attribute (.alert), while a hash (#) targets a unique id attribute (#title).'
      },
      {
        id: 'm4-q2',
        question: 'In the CSS box model, which space sits INSIDE the border around the content?',
        options: ['Margin', 'Outline', 'Spacing', 'Padding'],
        correctIndex: 3,
        explanation: 'Padding is the space between the content and the border. Margin is the outer space outside the border.'
      },
      {
        id: 'm4-q3',
        question: 'Which type of CSS can style ALL pages of a website from a single shared file?',
        options: ['External', 'Inline', 'Internal', 'Attribute'],
        correctIndex: 0,
        explanation: 'One external .css file can be linked via <link rel="stylesheet" href="style.css"> across every HTML page.'
      },
      {
        id: 'm4-q4',
        question: 'Which CSS position keeps an element stuck in the same spot on the screen even while scrolling?',
        options: ['static', 'relative', 'fixed', 'absolute'],
        correctIndex: 2,
        explanation: 'position: fixed anchors an element relative to the browser viewport so it stays put during scrolling.'
      },
      {
        id: 'm4-q5',
        question: 'Which CSS property turns a parent element into a Flexbox container so its children arrange in a row?',
        options: ['display: flex;', 'position: flex;', 'float: flex;', 'flex: container;'],
        correctIndex: 0,
        explanation: 'Setting display: flex on the parent turns it into a flex container and makes its direct children flex items.'
      },
      {
        id: 'm4-q6',
        question: 'Which CSS pseudo-class applies when the user moves the mouse pointer over an element?',
        options: [':focus', ':hover', ':first-child', ':visited'],
        correctIndex: 1,
        explanation: ':hover activates when the pointer hovers over an element, whereas :focus activates when an input receives keyboard/cursor focus.'
      },
      {
        id: 'm4-q7',
        question: 'Without box-sizing: border-box, what is the total rendered width of `.box` (excluding margin)?',
        code: '.box {\n  width: 200px;\n  padding: 20px;\n  border: 5px solid green;\n}',
        options: ['200px', '225px', '250px', '240px'],
        correctIndex: 2,
        explanation: 'Default content-box adds left+right padding (20+20 = 40) and left+right border (5+5 = 10) to width (200), giving 250px. Adding box-sizing: border-box keeps it at 200px.'
      },
      {
        id: 'm4-q8',
        question: 'Which DOM method selects a single HTML element using its unique id attribute?',
        options: [
          'querySelectorAll()',
          'getElementById()',
          'createElement()',
          'console.log()'
        ],
        correctIndex: 1,
        explanation: 'document.getElementById("title") returns the unique element whose id matches "title".'
      },
      {
        id: 'm4-q9',
        question: 'What does `event.preventDefault()` do inside a form submit event listener?',
        options: [
          'Deletes the form from the DOM',
          'Clears all form input values',
          'Stops the default form submission / page reload so JS can validate first',
          'Closes the browser tab'
        ],
        correctIndex: 2,
        explanation: 'event.preventDefault() cancels the browser’s default submit navigation so your JavaScript validation code can run first.'
      },
      {
        id: 'm4-q10',
        question: 'Which web storage mechanism retains data even after the user closes and reopens the browser?',
        options: ['sessionStorage', 'A let variable', 'The console', 'localStorage'],
        correctIndex: 3,
        explanation: 'localStorage persists across browser restarts until explicitly cleared, while sessionStorage is wiped when the tab closes.'
      }
    ]
  },

  5: {
    moduleId: 5,
    title: 'Module 5 Checkpoint: Internet Security, Firewalls, Privacy & Copyright',
    passingPercent: 60,
    questions: [
      {
        id: 'm5-q1',
        question: 'In the CIA Triad of Information Security, what does "Integrity" guarantee?',
        options: [
          'Websites always load faster than 100ms',
          'Data has not been tampered with or altered in an unauthorized way',
          'Only open-source software is used on the server',
          'Passwords are stored inside localStorage'
        ],
        correctIndex: 1,
        explanation: 'Confidentiality keeps data secret, Integrity guarantees data is authentic and unaltered (e.g., via SHA-256 hashes), and Availability keeps systems accessible.'
      },
      {
        id: 'm5-q2',
        question: 'What is the primary purpose of a network Firewall?',
        options: [
          'To speed up CSS rendering inside the browser',
          'To act as a security gatekeeper that monitors and filters incoming/outgoing traffic using rules',
          'To compress HTML files before uploading to GitHub Pages',
          'To replace HTTPS encryption completely'
        ],
        correctIndex: 1,
        explanation: 'A firewall enforces security rules between a trusted internal network/device and an untrusted external network, blocking unauthorized ports and traffic.'
      },
      {
        id: 'm5-q3',
        question: 'Which type of firewall specifically inspects HTTP/HTTPS payloads to block web attacks like XSS and SQL Injection?',
        options: [
          'Static Packet Filter only',
          'Web Application Firewall (WAF)',
          'CSS Media Query Filter',
          'DNS Phone Book'
        ],
        correctIndex: 1,
        explanation: 'A Web Application Firewall (WAF) operates at the application layer (HTTP/HTTPS) to detect and block XSS, SQL Injection, and malicious web requests.'
      },
      {
        id: 'm5-q4',
        question: 'Why should developers NEVER store passwords inside `localStorage` or `sessionStorage`?',
        options: [
          'Web storage only holds numbers, not strings',
          'Web storage is plain-text on the user’s computer and readable by any JavaScript (vulnerable to XSS)',
          'sessionStorage uploads every key automatically to DNS',
          'localStorage deletes passwords after 5 seconds'
        ],
        correctIndex: 1,
        explanation: 'As warned in presentation3.pdf, localStorage and sessionStorage keep plain text on the user’s machine and can be read via JavaScript/XSS—never store passwords in them.'
      },
      {
        id: 'm5-q5',
        question: 'An attacker tricks a user into clicking a fake bank link via SMS to steal their login OTP. What is this attack called?',
        options: ['Phishing', 'Responsive Design', 'Box Model Overflow', 'Semantic Markup'],
        correctIndex: 0,
        explanation: 'Phishing uses deceptive messages and look-alike websites to trick victims into revealing passwords, OTPs, or banking credentials.'
      },
      {
        id: 'm5-q6',
        question: 'If user input containing `<script>alert(1)</script>` is inserted directly using `element.innerHTML`, what vulnerability occurs?',
        options: [
          'Cross-Site Scripting (XSS)',
          'IPv6 Address Exhaustion',
          'CSS Specificity Clash',
          '404 Not Found'
        ],
        correctIndex: 0,
        explanation: 'Inserting untrusted user input into innerHTML can execute malicious scripts in visitors’ browsers—known as Cross-Site Scripting (XSS). Use textContent for plain text.'
      },
      {
        id: 'm5-q7',
        question: 'Which security management practice grants every user or program only the minimum permissions necessary to perform its task?',
        options: [
          'Open Port Policy',
          'Principle of Least Privilege',
          'Plain-Text Storage',
          'Infinite Session Timeout'
        ],
        correctIndex: 1,
        explanation: 'The Principle of Least Privilege minimizes damage if an account or component is compromised by restricting access rights to the strict minimum.'
      },
      {
        id: 'm5-q8',
        question: 'What is the safest way for a server database to store user passwords?',
        options: [
          'Plain text inside a hidden HTML comment',
          'Salted cryptographic password hashes (e.g., bcrypt/Argon2)',
          'Encrypted inside the URL using GET parameters',
          'Inside a public JSON file named passwords.json'
        ],
        correctIndex: 1,
        explanation: 'Servers store salted, slow one-way cryptographic hashes (like bcrypt or Argon2) so even if a database leaks, real passwords are not exposed.'
      },
      {
        id: 'm5-q9',
        question: 'Which statement about Information Privacy and Cookies on websites is accurate?',
        options: [
          'Websites may collect and sell personal data secretly without notice',
          'Ethical apps collect only necessary data, secure it, and respect privacy rules like India’s DPDP Act',
          'Cookies automatically encrypt your computer’s hard drive',
          'Privacy laws only apply to desktop browsers, not mobile phones'
        ],
        correctIndex: 1,
        explanation: 'Privacy-first design collects minimal personal data, discloses cookie/storage usage transparently, and complies with data protection laws such as the DPDP Act.'
      },
      {
        id: 'm5-q10',
        question: 'You find a professional photograph on Google Images without any license statement. Can you legally copy it onto your commercial website?',
        options: [
          'Yes, everything visible on the Internet is automatically public domain',
          'Yes, as long as you rename the file to photo1.jpg',
          'No—creative works are protected by copyright unless licensed (e.g., Creative Commons) or permitted by the owner',
          'Yes, if you embed it inside a <div> tag'
        ],
        correctIndex: 2,
        explanation: 'Images, text, and code on the web are protected by copyright by default. Always use your own assets, public domain/Creative Commons works with attribution, or licensed resources.'
      }
    ]
  }
};

export function getQuizByModule(moduleId) {
  return QUIZZES[Number(moduleId)] || null;
}
