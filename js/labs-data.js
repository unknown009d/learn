/**
 * Practical Labs (Labs 1 to 8) — Learning the Web with Basics of Vanilla Front-End Tools
 * Sequentially gated behind each module's Graded MCQ checkpoint.
 */

export const LABS = [
  {
    id: 1,
    moduleId: 2,
    code: 'Lab 1',
    title: 'Design a Basic Personal Web Page',
    syllabusRef: 'Goal: Build your first personal page with a heading, short intro, picture, and clickable link.',
    estimatedMinutes: 10,
    tabs: ['html'],
    instructions: [
      'Add a main heading (<h1>) with your Full Name or page title.',
      'Write a short paragraph (<p>) introducing yourself and what excites you about learning to build websites (you can make words bold with <b>).',
      'Show an image using <img> with a valid src image address and a short alt description.',
      'Add a clickable hyperlink (<a href="https://...">) pointing to a helpful website like SWAYAM (https://swayam.gov.in).'
    ],
    hint: `Tip: Try using an SVG data URI if you are offline, or a real URL:\n<img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Crect width='120' height='120' rx='20' fill='%230e7a3a'/%3E%3Ctext x='60' y='68' font-size='44' text-anchor='middle' fill='white'%3EWT%3C/text%3E%3C/svg%3E" alt="Student Avatar" width="120">`,
    starterHtml: `<!-- Lab 1: Personal Web Page -->
<h1><!-- Your Name Here --></h1>

<p>Hello! I am a student learning <b>Vanilla Web Foundations</b>.</p>

<!-- TODO: Add an <img> with src and alt attributes -->

<!-- TODO: Add an <a href="..."> hyperlink to SWAYAM or your favourite site -->
`,
    starterCss: '',
    starterJs: '',
    checksDescription: [
      'Your page has a main <h1> heading with your name or title',
      'Your page has a <p> paragraph introducing yourself (10+ characters)',
      'Your <img> includes both an image source (src) and a description (alt)',
      'Your page has a clickable <a> link with a web address and visible text'
    ]
  },

  {
    id: 2,
    moduleId: 2,
    code: 'Lab 2',
    title: 'Create an HTML Registration Form',
    syllabusRef: 'Goal: Build a sign-up form with text boxes, choices, and a submit button.',
    estimatedMinutes: 15,
    tabs: ['html'],
    instructions: [
      'Wrap all your fields inside a <form action="register.php" method="post"> tag.',
      'Add at least 3 input boxes (for example Full Name type="text", Email type="email", and Password type="password"), each paired with a <label>.',
      'Give visitors a choice control: radio buttons (sharing the same name), checkboxes, or a <select> dropdown.',
      'Add a Submit button (<input type="submit" value="Register"> or <button type="submit">) inside the form.'
    ],
    hint: `<form action="register.php" method="post">\n  <p><label for="fn">Name</label> <input id="fn" type="text" name="fullname" required></p>\n  <p><label for="em">Email</label> <input id="em" type="email" name="email" required></p>\n  <p><label for="pw">Password</label> <input id="pw" type="password" name="pwd" required></p>\n  <p>Batch: <input type="radio" name="batch" value="morning" id="m" checked><label for="m">Morning</label></p>\n  <input type="submit" value="Register">\n</form>`,
    starterHtml: `<h2>Student Course Registration</h2>
<form action="register.php" method="post">
  <p>
    <label for="fullname">Full Name:</label>
    <input type="text" id="fullname" name="fullname" placeholder="Enter full name" required>
  </p>

  <!-- TODO: Add Email input, Password input, Radio/Checkbox choice, and Submit button -->

</form>
`,
    starterCss: '',
    starterJs: '',
    checksDescription: [
      'Fields are wrapped inside a <form> element',
      'Form contains at least 3 input boxes (Name, Email, Password, etc.)',
      'Fields include <label> tags so users know what to type',
      'Includes at least one radio button, checkbox, or dropdown choice',
      'Includes a Submit button inside the form'
    ]
  },

  {
    id: 3,
    moduleId: 2,
    code: 'Lab 3',
    title: 'Tables & Nested Lists Organization',
    syllabusRef: 'Goal: Organize a timetable with merged table cells and build a nested bullet list.',
    estimatedMinutes: 15,
    tabs: ['html'],
    instructions: [
      'Create a <table> with border="1" and cellpadding containing header cells (<th>) and data cells (<td>) across 2 or more rows (<tr>).',
      'Merge at least one cell across columns or rows using colspan="..." or rowspan="...".',
      'Create an outer list (<ul> or <ol>) with at least 2 list items (<li>).',
      'Place an inner sub-list (<ul> or <ol>) directly inside one of the outer <li> items.'
    ],
    hint: `<table border="1" cellpadding="8">\n  <tr><th colspan="3">Time Table</th></tr>\n  <tr><td rowspan="2">Monday</td><td>10:30</td><td>HTML</td></tr>\n  <tr><td>12:00</td><td>CSS</td></tr>\n</table>\n<ul>\n  <li>Front End\n    <ul><li>HTML5</li><li>CSS3</li></ul>\n  </li>\n  <li>Back End</li>\n</ul>`,
    starterHtml: `<h2>Department Time Table &amp; Syllabus</h2>

<table border="1" cellpadding="8">
  <tr>
    <th>Day</th>
    <th>Time</th>
    <th>Subject</th>
  </tr>
  <!-- TODO: Add rows and use colspan or rowspan on at least one cell -->
</table>

<h3>Course Modules</h3>
<ul>
  <li>Web Foundations
    <!-- TODO: Nest a <ul> or <ol> inside this <li> -->
  </li>
  <li>Scripting &amp; Security</li>
</ul>
`,
    starterCss: '',
    starterJs: '',
    checksDescription: [
      'Page has a <table> with at least 2 rows and 3 cells',
      'At least one table cell merges columns or rows using colspan or rowspan',
      'Page has an outer <ul> or <ol> list with at least 2 items',
      'An inner sub-list is nested inside an outer <li> item'
    ]
  },

  {
    id: 4,
    moduleId: 4,
    code: 'Lab 4',
    title: 'Apply Internal & External CSS',
    syllabusRef: 'Goal: Style a web page using both a <style> tag in HTML and separate rules in style.css.',
    estimatedMinutes: 15,
    tabs: ['html', 'css'],
    instructions: [
      'Inside the HTML tab, add a <style>...</style> block to set the page background color or font.',
      'Open the style.css tab and add styles using a class selector (like .highlight) or an ID selector (like #title).',
      'Make sure your colors, backgrounds, or padding visibly style the heading and paragraph in the preview.'
    ],
    hint: `HTML tab:\n<style>\n  body { background-color: #f4fbf6; font-family: Arial, sans-serif; }\n</style>\n<h1 id="title">Vanilla Web Foundations</h1>\n<p class="notice">Classes begin at 10:30 AM.</p>\n\nstyle.css tab:\n#title { color: darkgreen; text-align: center; }\n.notice { color: #b91c1c; background: #fee2e2; padding: 12px; border-radius: 8px; }`,
    starterHtml: `<!-- Lab 4: Add an internal <style> tag below -->
<style>
  /* TODO: Style body font-family or background-color here */
</style>

<h1 id="title">Welcome to Web Design</h1>
<p class="highlight">Styled using both internal and external CSS.</p>
`,
    starterCss: `/* External CSS (style.css) */
/* TODO: Style #title and .highlight with color, padding, or background */
`,
    starterJs: '',
    checksDescription: [
      'HTML tab includes a <style> block with at least one CSS rule',
      'The style.css tab contains styling rules',
      'Uses a class (.) or ID (#) selector to target elements',
      'Custom colors, backgrounds, or spacing visibly appear on the page'
    ]
  },

  {
    id: 5,
    moduleId: 3,
    code: 'Lab 5',
    title: 'JS Form Validation with try...catch',
    syllabusRef: 'Goal: Check form fields with JavaScript and show clear feedback messages.',
    estimatedMinutes: 20,
    tabs: ['html', 'css', 'js'],
    instructions: [
      'Use a <form> in HTML with Name, Email, and Password (type="password") fields, a submit button, and a <p id="msg"></p> area for feedback.',
      'In app.js, listen for form submission and call e.preventDefault() so the page does not reload.',
      'Check the inputs inside a try { ... } catch (error) { ... } block: require a non-empty name, an email with "@", and a password of at least 6 characters.',
      'Show either the helpful error message or a success message inside #msg.'
    ],
    hint: `form.addEventListener("submit", function (e) {\n  e.preventDefault();\n  try {\n    if (nameInput.value.trim() === "") throw new Error("Enter your name");\n    if (!emailInput.value.includes("@")) throw new Error("Invalid email");\n    if (passInput.value.length < 6) throw new Error("Password min 6 chars");\n    msg.textContent = "Registration successful!";\n  } catch (err) {\n    msg.textContent = "Error: " + err.message;\n  }\n});`,
    starterHtml: `<h2>Account Validation</h2>
<form id="regForm">
  <p><label>Name: <input type="text" id="nameInput" placeholder="Your name"></label></p>
  <p><label>Email: <input type="email" id="emailInput" placeholder="you@example.in"></label></p>
  <p><label>Password: <input type="password" id="passInput" placeholder="Min 6 characters"></label></p>
  <button type="submit">Validate &amp; Submit</button>
</form>
<p id="msg"></p>
`,
    starterCss: `body { font-family: Arial, sans-serif; padding: 12px; }\n#msg { font-weight: bold; margin-top: 10px; }`,
    starterJs: `const form = document.getElementById("regForm");
const msg = document.getElementById("msg");

form.addEventListener("submit", function (e) {
  e.preventDefault();
  // TODO: Use try...catch and throw new Error(...) to validate name, email & password
});
`,
    checksDescription: [
      'Form contains Name, Email, Password fields and a submit button',
      'JavaScript in app.js uses a try...catch block to check inputs',
      'Submitting an empty form stays on the page and shows an error message',
      'Submitting valid details shows a different success message'
    ]
  },

  {
    id: 6,
    moduleId: 3,
    code: 'Lab 6',
    title: 'Dynamic Date & Time with Date Object',
    syllabusRef: 'Goal: Build a live digital clock that displays today\'s date and ticks every second.',
    estimatedMinutes: 15,
    tabs: ['html', 'css', 'js'],
    instructions: [
      'Keep elements in HTML to show the date and time (such as #dateDisplay and #timeDisplay).',
      'In app.js, get the current moment with new Date().',
      'Show both today\'s formatted date (including the year) and the live time on the page.',
      'Use setInterval(..., 1000) so the clock updates automatically every second.'
    ],
    hint: `function showClock() {\n  const now = new Date();\n  document.getElementById("date").textContent = now.toLocaleDateString("en-IN");\n  document.getElementById("time").textContent = now.toLocaleTimeString();\n}\nshowClock();\nsetInterval(showClock, 1000);`,
    starterHtml: `<div class="clock-box">
  <h2>Live Date &amp; Time</h2>
  <p id="dateDisplay">Loading date...</p>
  <p id="timeDisplay">Loading time...</p>
</div>
`,
    starterCss: `.clock-box { border: 2px solid #0e7a3a; border-radius: 12px; padding: 16px; text-align: center; font-family: Arial, sans-serif; }`,
    starterJs: `function updateClock() {
  // TODO: Create new Date() and update #dateDisplay and #timeDisplay
}

updateClock();
// TODO: Use setInterval(updateClock, 1000) for live updates
`,
    checksDescription: [
      'JavaScript gets the current date/time with new Date()',
      'Page shows today\'s date including the current year',
      'Page shows the formatted time (HH:MM)',
      'Uses setInterval or setTimeout to refresh live every second'
    ]
  },

  {
    id: 7,
    moduleId: 4,
    code: 'Lab 7',
    title: 'Dynamic DOM Manipulation via innerHTML',
    syllabusRef: 'Goal: Update text and HTML inside a web page when the visitor clicks a button.',
    estimatedMinutes: 15,
    tabs: ['html', 'css', 'js'],
    instructions: [
      'In HTML, include a target container (like #output) and a clickable <button>.',
      'In app.js, listen for a "click" on the button using addEventListener("click", ...).',
      'When clicked, change the page using .innerHTML (for example inserting formatted tags like <b> or <h3>) and optionally update its colors.'
    ],
    hint: `const btn = document.getElementById("changeBtn");\nconst output = document.getElementById("output");\nbtn.addEventListener("click", function () {\n  output.innerHTML = "<h3>Updated!</h3><p>Changed with <b>innerHTML</b>.</p>";\n  output.style.backgroundColor = "lightyellow";\n});`,
    starterHtml: `<h2 id="title">Notice Board</h2>
<div id="output">Initial content waiting for update.</div>
<br>
<button id="changeBtn" type="button">Modify DOM</button>
`,
    starterCss: `#output { padding: 12px; border: 1px solid #94a3b8; border-radius: 8px; }`,
    starterJs: `const btn = document.getElementById("changeBtn");
const output = document.getElementById("output");

// TODO: Add click listener that updates output.innerHTML and style dynamically
`,
    checksDescription: [
      'JavaScript uses .innerHTML to update content on the page',
      'Page contains an interactive <button> to click',
      'Clicking the button updates what appears on the page'
    ]
  },

  {
    id: 8,
    moduleId: 4,
    code: 'Lab 8',
    title: 'Webpage Layout with div, span & CSS Box Model',
    syllabusRef: 'Goal: Organize sections with div blocks, highlight words inline with span, and practice spacing with padding, borders, and margins.',
    estimatedMinutes: 15,
    tabs: ['html', 'css'],
    instructions: [
      'Add at least two <div> blocks to create separate sections on the page (like a notice card and a footer strip).',
      'Highlight a word inside a sentence using an inline <span> tag without starting a new line.',
      'In style.css, style your <div> with padding, a visible border, and margin (you can also add box-sizing: border-box).'
    ],
    hint: `<div class="panel">\n  <h3>Notice</h3>\n  <p>The office is closed on <span class="badge">Sunday</span>.</p>\n</div>\n<div class="footer-box">Second block starts on a new line.</div>\n\nCSS:\n.panel { width: 280px; padding: 20px; border: 4px solid green; margin: 16px; box-sizing: border-box; background: lightyellow; }\n.badge { color: red; font-weight: bold; }`,
    starterHtml: `<div class="card-box">
  <h3>Campus Notice</h3>
  <p>Practical labs will be held on <span class="tag">Friday</span> at 10:30 AM.</p>
</div>

<!-- TODO: Add a second <div> layout block -->
`,
    starterCss: `.card-box {
  /* TODO: Set width, padding, border, margin, and box-sizing: border-box */
}

.tag {
  /* TODO: Style the inline <span> highlight */
}
`,
    starterJs: '',
    checksDescription: [
      'Uses at least two <div> layout sections',
      'Uses at least one inline <span> inside text',
      'Applies padding, border, and margin to a <div> section',
      'Keeps <span> inline inside the sentence'
    ]
  }
];

export function getLabById(id) {
  return LABS.find((l) => l.id === Number(id)) || null;
}

export function getLabsByModule(moduleId) {
  return LABS.filter((l) => l.moduleId === Number(moduleId));
}
