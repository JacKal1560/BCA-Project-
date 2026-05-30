/* STATE - all data the app tracks */
const S = {
    name: '',          // user's name from the welcome screen

    // Task 1 — memory
    words:    [],      // the 5 words shown
    recalled: [],      // words the user typed back
    memScore: 0,       // 0–5

    // Task 2 — orientation
    oqAnswers: {},     // e.g. { 0: 'Friday', 1: 'Spring', 2: 'Morning' }
    oqScore:   0,      // 0–3

    // Task 3 — attention
    nextExpected: 1,   // number the user should tap next
    mistakes:     0,   // wrong taps
    attStart:     null,// timestamp of first tap (for speed bonus)
    attDone:      false,
    attScore:     0,   // 0–25

    // Task 4 — clock drawing
    clockHourAngle:   null, // angle of the hour hand drawn by user (degrees)
    clockMinuteAngle: null, // angle of the minute hand drawn by user (degrees)
    clockScore:       0,    // 0–10

};

/* Data - word pool and orientation question generator */

const WORD_POOL = [
    'apple', 'bridge', 'candle','drawer', 'forest',
    'ribbon' , 'spider', 'helmet', 'jacket', 'kite',
    'ladder', 'mirror', 'needle', 'orange', 'pencil',
    'quilt',  'robot',  'skirt',  'table',  'umbrella',
];

function makeOrientationQs(){
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { weekday: 'long' });
    const month = now.getMonth() + 1;
    const hour = now.getHours();

    const seasonList = ['Winter','Winter','Spring','Spring','Spring',
                        'Summer','Summer','Summer','Autumn','Autumn','Autumn','Winter'];
    const season = seasonList[month - 1];

    const tod = hour < 12 ? 'Morning'
                  : hour < 17 ? 'Afternoon'
                  : hour < 21 ? 'Evening'
                  :             'Night';

    return[
        {
            q: 'What day of the week is it?',
            correct: day,
            choices: shuffle(['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])
                       .filter(d => d !== day).slice(0, 3).concat(day),
        },
        {
            q: 'What season is it?',
            correct: season,
            choices: shuffle(['Spring','Summer','Autumn','Winter'])
                       .filter(s => s !== season).slice(0, 3).concat(season),
        },
        {
            q: 'What time of day is it?',
            correct: tod,
            choices: shuffle(['Morning','Afternoon','Evening','Night'])
                       .filter(t => t !== tod).slice(0, 3).concat(tod),
        }
    ].map(q => ({ ...q, choices: shuffle(q.choices) }));
}

/* show(id) switches to a screen */
const SCREEN_IDS = ['welcome','memory','recall','orientation','attention','clock','results'];

function show(id) {
    // hide all screens using bootstrap's d-none utility class
    SCREEN_IDS.forEach(sid => {
        const el = document.getElementById('s-' + sid);
        if (el) el.classList.add('d-none');
    });
    const target = document.getElementById('s-' + id);
    if (target) target.classList.remove('d-none');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// setProgress(n) updates the Bootstrap progress bar
function setProgress(fraction){
    const bar = document.getElementById('progressBar')
    const fill = document.getElementById('progressFill');
    if (!fraction) { bar.style.display = 'none'; return; }
    bar.style.display = 'block';
    setTimeout(() => { fill.style.width = (fraction * 100) + '%'; }, 40);
}

// this function picks 5 words, displays as Bootstrap badges, starts timer
function buildMemory(){
    S.words = shuffle([...WORD_POOL]).slice(0, 5);
    S.recalled = [];

    document.getElementById('tagList').innerHTML = '';

    const ring = document.getElementById('timerRing');
    if (ring) { ring.style.strokeDashoffset = '0'; ring.style.stroke = '#0d6efd'; }
    document.getElementById('timerNum').textContent = '20';

    const grid = document.getElementById('wordGrid');
    grid.innerHTML = '';
    S.words.forEach((word, i) => {
        const pill = document.createElement('span');
        // Bootstrap badge styled as a rounded pill
        pill.className = 'badge rounded-pill border border-primary-subtle text-primary-emphasis bg-primary-subtle fs-6 fw-normal word-pill';
        pill.textContent = word;
        pill.style.animationDelay = (i * 80) + 'ms';
        grid.appendChild(pill);
    });

    // After 20 seconds automatically move to the recall screen
    startTimer(20, () => {
        show('recall');
        setProgress(2 / 5);
        document.getElementById('recallInput').focus();
    });
}

// Generate and render orientation questions
function buildOrientation(){
    S._oqs  = makeOrientationQs();
    S.oqAnswers = {};

    const body= document.getElementById('orientationBody');
    body.innerHTML = '';

    S._oqs.forEach((q, qi) => {
        const block = document.createElement('div');
        block.className = 'mb-4';

        const label = document.createElement('p');
        label.className = 'fw-medium mb-2 small';
        label.textContent = q.q;
        block.appendChild(label);

        // Bootstrap 2-column grid for the choice buttons
        const grid = document.createElement('div');
        grid.className = 'row g-2';

        q.choices.forEach(ch => {
            const col = document.createElement('div');
            col.className = 'col-6';

            const btn = document.createElement('button');
            btn.className = 'btn btn-outline-secondary btn-sm w-100';
            btn.textContent = ch;
            btn.onclick = () => {
                block.querySelectorAll('button').forEach(b => {
                    b.className = 'btn btn-outline-secondary btn-sm w-100';
                });
                btn.className = 'btn btn-primary btn-sm w-100';
                S.oqAnswers[qi] = ch;
            };
            col.appendChild(btn);
            grid.appendChild(col);
        });
        block.appendChild(grid);
        body.appendChild(block);
    });
}

// layout numbers 1–20 in a shuffled grid
function buildAttention(){
    S.nextExpected = 1;
    S.mistakes = 0;
    S.attDone = false;
    S.attStart = null;

    const nums = shuffle(Array.from({length: 20}, (_, i) => i + 1));
    const grid = document.getElementById('numGrid');
    grid.innerHTML = '';

    nums.forEach(n => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-outline-secondary num-btn';
        btn.id = 'n' + n;
        btn.textContent = n;
        btn.onclick = () => tapNumber(n, btn);
        grid.appendChild(btn);
    });

    document.getElementById('nextNum').textContent = '1';
    document.getElementById('mistakeCount').textContent = '0';
}

// functions triggered by user interaction

let timerInterval = null;

// countdown timer used during memorization phase
function startTimer(seconds, onDone){
    let left = seconds;
    const circ = 113.1;
    const ring  = document.getElementById('timerRing');
    const label = document.getElementById('timerNum');
    clearInterval(timerInterval);

    timerInterval = setInterval(() => {
        left--;
        if (label) label.textContent = left;
        if (ring) {
            ring.style.strokeDashoffset = circ * (1 - left / seconds);
            ring.style.stroke = left <= 5 ? '#dc3545' : '#0d6efd'; // turns red at 5s
        }
        if (left <= 0) { clearInterval(timerInterval); onDone(); }
    }, 1000);
}

// User submits a recalled word
function addRecallWord() {
    const input = document.getElementById('recallInput');
    const word = input.value.trim().toLowerCase();
    if (!word || S.recalled.includes(word)) { input.value = ''; return; }

    
    S.recalled.push(word);
    input.value = '';
    input.focus();

    const correct = S.words.includes(word);
    const tag = document.createElement('span');
    // Bootstrap success/danger badge for correct/wrong words
    tag.className = `badge ${correct ? 'text-bg-success' : 'text-bg-danger'}`;
    tag.textContent = word + (correct ? ' ✓' : ' ✗');
    document.getElementById('tagList').appendChild(tag);
}

// continue from recall - score memory and move to orientation
function finishRecall() {
    clearInterval(timerInterval);
    S.memScore = S.recalled.filter(w => S.words.includes(w)).length;
    show('orientation');
    buildOrientation();
    setProgress(2 / 5);
}

// continue from orientation - score it and move to attention
function finishOrientation() {
    S.oqScore = (S._oqs || []).reduce((acc, q, i) =>
        acc + (S.oqAnswers[i] === q.correct ? 1 : 0), 0);
    show('attention');
    buildAttention();
    setProgress(3 / 5);
}

// User taps a number in the attention task
function tapNumber(n, btn){
    if (S.attDone) return;
    if (!S.attStart) S.attStart = Date.now();

    if(n == S.nextExpected){
        // correct tap - marked done with Bootstrap btn-primary
        btn.className = 'btn btn-primary num-btn';
        btn.disabled = true;
        S.nextExpected++;
        document.getElementById('nextNum').textContent = S.nextExpected > 20 ? '✓' : S.nextExpected;

        if (S.nextExpected > 20) {
            S.attDone = true;
            const secs = (Date.now() - S.attStart) / 1000;
            const base  = Math.max(0, 20 - S.mistakes * 2);
            const bonus = secs < 30 ? 5 : secs < 45 ? 3 : secs < 60 ? 1 : 0;
            S.attScore = Math.min(25, base + bonus);
            setTimeout(() => { show('clock'); buildClock(); setProgress(4 / 5); }, 500);
        }
    } else {
        // wrong tap - Bootstrap danger outline + shake animation
        S.mistakes++;
        document.getElementById('mistakeCount').textContent = S.mistakes;
        const orig = btn.className;
        btn.className = 'btn btn-outline-danger num-btn shake';
        setTimeout(() => { btn.className = orig; }, 400);
    }
}

// Task 4 — Clock Drawing
// Target time: 10:10 — classic clock test time (both hands visible, symmetrical)
function buildClock(){
    S.clockHourAngle   = null;
    S.clockMinuteAngle = null;
    S.clockScore       = 0;

    document.getElementById('clockContinueBtn').style.display = 'none';
    document.getElementById('clockUndoBtn').style.display     = 'none';
    document.getElementById('clockInstruction').textContent   = 'Draw the HOUR hand — tap where 10 would point';

    const canvas  = document.getElementById('clockCanvas');
    const ctx     = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 10;

    // draw static clock face
    function drawFace(){
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // outer circle
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.strokeStyle = '#0d6efd'; ctx.lineWidth = 3; ctx.stroke();
        // hour ticks
        for (let i = 0; i < 12; i++){
            const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
            const inner = i % 3 === 0 ? r - 14 : r - 8;
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * inner, cy + Math.sin(a) * inner);
            ctx.lineTo(cx + Math.cos(a) * r,     cy + Math.sin(a) * r);
            ctx.strokeStyle = '#333'; ctx.lineWidth = i % 3 === 0 ? 2 : 1; ctx.stroke();
        }
        // number labels
        ctx.fillStyle = '#212529'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        [12,1,2,3,4,5,6,7,8,9,10,11].forEach((n, i) => {
            const a = (i / 12) * 2 * Math.PI - Math.PI / 2;
            ctx.fillText(n, cx + Math.cos(a) * (r - 22), cy + Math.sin(a) * (r - 22));
        });
        // center dot
        ctx.beginPath(); ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
        ctx.fillStyle = '#0d6efd'; ctx.fill();
    }

    // draw a clock hand given angle (degrees, 0=12 o'clock), length ratio, color
    function drawHand(angleDeg, lenRatio, color, width){
        const a = (angleDeg - 90) * Math.PI / 180;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * r * lenRatio, cy + Math.sin(a) * r * lenRatio);
        ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.stroke();
    }

    // angle from center of canvas to a pointer position
    function angleFromCenter(px, py){
        return Math.atan2(py - cy, px - cx) * 180 / Math.PI + 90;
    }

    let drawingHour = true; // first touch sets hour hand, second sets minute hand
    drawFace();

    function handleInput(px, py){
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width  / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (px - rect.left) * scaleX;
        const y = (py - rect.top)  * scaleY;
        const angle = ((angleFromCenter(x, y) % 360) + 360) % 360;

        drawFace();
        if (drawingHour){
            S.clockHourAngle = angle;
            drawHand(angle, 0.55, '#0d6efd', 5);
            drawingHour = false;
            document.getElementById('clockInstruction').textContent = 'Now draw the MINUTE hand — tap where 2 would point';
            document.getElementById('clockUndoBtn').style.display = 'inline-block';
        } else {
            S.clockMinuteAngle = angle;
            drawHand(S.clockHourAngle,   0.55, '#0d6efd', 5);
            drawHand(S.clockMinuteAngle, 0.80, '#198754', 3);
            document.getElementById('clockInstruction').textContent = 'Hands set! Hit Continue when ready.';
            document.getElementById('clockContinueBtn').style.display = 'inline-block';
        }
    }

    canvas.onclick = e => handleInput(e.clientX, e.clientY);
    canvas.ontouchend = e => { e.preventDefault(); const t = e.changedTouches[0]; handleInput(t.clientX, t.clientY); };

    document.getElementById('clockUndoBtn').onclick = () => {
        drawingHour = true;
        S.clockHourAngle = null; S.clockMinuteAngle = null;
        drawFace();
        document.getElementById('clockInstruction').textContent = 'Draw the HOUR hand — tap where 10 would point';
        document.getElementById('clockUndoBtn').style.display = 'none';
        document.getElementById('clockContinueBtn').style.display = 'none';
    };
}

// score clock drawing — compares user angles to ideal 10:10 angles
function scoreClockHands(){
    // ideal angles: at 10:10, hour hand is slightly past 10 o'clock (305°), minute hand at 2 (60°)
    const idealHour   = 305; // 10:10 → hour hand = (10 + 10/60)/12 * 360 ≈ 305°
    const idealMinute = 60;  // 10 minutes → minute hand points at '2' = 60°

    function angDiff(a, b){ return Math.min(Math.abs(a - b), 360 - Math.abs(a - b)); }

    let score = 0;
    if (S.clockHourAngle !== null){
        const diffH = angDiff(S.clockHourAngle, idealHour);
        score += diffH < 15 ? 5 : diffH < 30 ? 3 : diffH < 45 ? 1 : 0; // up to 5 pts
    }
    if (S.clockMinuteAngle !== null){
        const diffM = angDiff(S.clockMinuteAngle, idealMinute);
        score += diffM < 15 ? 5 : diffM < 30 ? 3 : diffM < 45 ? 1 : 0; // up to 5 pts
    }
    return score; // 0–10
}

// continue from clock drawing - score and move to results
function finishClock(){
    S.clockScore = scoreClockHands();
    showResults();
}

// results - score everything and render the result screen
function showResults() {
    show('results');
    setProgress(0);

    const tipsList = document.getElementById('tipsList');
    tipsList.innerHTML = '';
    tipsList.classList.add('d-none');

    if (S.name) {
        document.getElementById('resultsHeading').textContent = S.name + "'s Results";
    } else {
        document.getElementById('resultsHeading').textContent = 'Your Results';
    }

    // normalize each raw score to 0-100
    const domains = [
        { label: 'Memory',      raw: S.memScore  * 20 },
        { label: 'Orientation', raw: Math.round(S.oqScore / 3 * 100) },
        { label: 'Attention',   raw: Math.min(100, S.attScore * 4) },
        { label: 'Clock Drawing', raw: Math.round(S.clockScore / 10 * 100) },
    ];

    const overall = Math.round(domains.reduce((sum, d) => sum + d.raw, 0) / domains.length);
    document.getElementById('scoreBig').textContent = overall;

    // Bootstrap badge colors based on score
    const risk = document.getElementById('riskTag');
    if (overall >= 75) {
        risk.textContent = '✓ Normal range';
        risk.className = 'badge mt-2 fs-6 text-bg-success';
    } else if (overall >= 50) {
        risk.textContent = 'Mild concern – worth monitoring';
        risk.className = 'badge mt-2 fs-6 text-bg-warning';
    } else {
        risk.textContent = 'Significant concerns – please see a doctor';
        risk.className = 'badge mt-2 fs-6 text-bg-danger';
    }

    // Bootstrap progress bar for each domain
    const list = document.getElementById('domainList');
    list.innerHTML = '';
    domains.forEach(d => {
        const row = document.createElement('div');
        row.className = 'mb-3';
        row.innerHTML = `
          <div class="d-flex justify-content-between mb-1 small">
            <span>${d.label}</span>
            <span class="text-muted">${d.raw}/100</span>
          </div>
          <div class="progress" style="height:7px;">
            <div class="progress-bar bg-primary" role="progressbar" style="width:0%" data-target="${d.raw}"></div>
          </div>`;
        list.appendChild(row);
    });

    // animate bars after a brief delay
    setTimeout(() => {
        document.querySelectorAll('#domainList .progress-bar').forEach(el => {
            el.style.width = el.dataset.target + '%';
        });
    }, 150);

    showTips(overall);
    // show Alzheimer's prevention resources for low or mid scores
    showResources(overall);
}

// tips shown after results load
function showTips(overall){
    const tips = [
        'Stay physically active — even 30 minutes of walking a day helps.',
        'Keep your mind busy with puzzles, reading, or learning something new.',
        'Maintain social connections — regular conversation is good for the brain.',
    ];
    
    if (overall < 75) tips.unshift('Mention your score at your next doctor\'s appointment.');
    if (overall < 50) tips.unshift('We recommend speaking with a doctor about a formal evaluation.');

    const list = document.getElementById('tipsList');
    list.innerHTML = '';
    tips.forEach(t => {
        const li = document.createElement('li');
        // Bootstrap list-group-item for each tip
        li.className = 'list-group-item border-0 px-0 py-1 small';
        li.innerHTML = `<span class="text-primary me-2">→</span>${t}`;
        list.appendChild(li);
    });
    list.classList.remove('d-none');
}

// show curated Alzheimer's prevention reading links for scores below 75
function showResources(overall){
    const box = document.getElementById('resourcesBox');
    if (!box) return;
    // only surface this section when score suggests a concern
    if (overall >= 75) { box.style.display = 'none'; return; }

    box.style.display = 'block';

    const articles = [
        {
            title: 'Reducing Risk for Dementia',
            source: 'CDC',
            desc: 'Practical lifestyle habits — exercise, sleep, heart health — that research links to lower dementia risk.',
            url: 'https://www.cdc.gov/alzheimers-dementia/prevention/index.html',
        },
        {
            title: 'Can Alzheimer\'s Disease Be Prevented?',
            source: 'Healthline',
            desc: 'Evidence-based overview of diet, physical activity, and social engagement as protective factors.',
            url: 'https://www.healthline.com/health/alzheimers/alzheimers-disease-prevention',
        },
        {
            title: 'Alzheimer\'s Disease Prevention Tips',
            source: 'WebMD',
            desc: 'Seven science-backed steps — including the MIND diet — that may help lower your risk.',
            url: 'https://www.webmd.com/alzheimers/understanding-alzheimers-disease-prevention',
        },
        {
            title: '11 Habits to Reduce Your Risk',
            source: 'U.S. News Health',
            desc: 'Latest 2026 findings from the U.S. POINTER study on structured programmes for cognitive decline prevention.',
            url: 'https://health.usnews.com/senior-care/preventing-dementia-and-alzheimers',
        },
        {
            title: 'Can You Prevent Alzheimer\'s?',
            source: 'Dartmouth Health',
            desc: 'Expert perspective on the 14 modifiable risk factors that could cut Alzheimer\'s risk by up to 45 %.',
            url: 'https://www.dartmouth-health.org/articles/can-you-prevent-alzheimers',
        },
    ];

    const list = document.getElementById('resourcesList');
    list.innerHTML = '';
    articles.forEach(a => {
        const li = document.createElement('a');
        li.href = a.url;
        li.target = '_blank';
        li.rel = 'noopener noreferrer';
        // Bootstrap list-group-item as a clickable link card
        li.className = 'list-group-item list-group-item-action border-0 border-bottom px-0 py-2 small';
        li.innerHTML = `
            <div class="d-flex justify-content-between align-items-start gap-2">
                <div>
                    <div class="fw-medium text-body">${a.title}</div>
                    <div class="text-muted" style="font-size:.8rem;">${a.desc}</div>
                </div>
                <span class="badge text-bg-light text-muted fw-normal flex-shrink-0" style="font-size:.72rem;">${a.source}</span>
            </div>`;
        list.appendChild(li);
    });
}

// helper functions

function shuffle(arr){
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Start and Reset

function startApp() {
    S.name = document.getElementById('userName').value.trim();
    S.memScore = S.oqScore = S.attScore = S.clockScore = 0;
    S.recalled  = [];
    S.oqAnswers = {};
    S.clockHourAngle = null; S.clockMinuteAngle = null;
    show('memory');
    setProgress(1 / 5);
    buildMemory();
}

function restartApp() {
    clearInterval(timerInterval);
    S.clockScore = 0; S.clockHourAngle = null; S.clockMinuteAngle = null;
    const box = document.getElementById('resourcesBox');
    if (box) box.style.display = 'none';
    show('welcome');
    setProgress(0);
}
