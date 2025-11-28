// --- Socket.IO 클라이언트 설정 ---
const socket = io();
let mySid = null;

// --- DOM Elements ---
const startScreen = document.getElementById('start-screen');
const typingScreen = document.getElementById('typing-screen');
const startButton = document.getElementById('start-button');
const infoModal = document.getElementById('info-modal');
const closeInfoModalButton = document.getElementById('close-info-modal-button');
const resultModal = document.getElementById('result-modal');
const closeResultModalButton = document.getElementById('close-result-modal-button');
const quoteDisplayElement = document.getElementById('quote-display');
const quoteInputElement = document.getElementById('quote-input');
const timerElement = document.getElementById('timer');
const wpmElement = document.getElementById('wpm');
const accuracyElement = document.getElementById('accuracy');
const keyboardElement = document.getElementById('keyboard');

// 멀티플레이용 DOM 요소
const userCountElement = document.getElementById('user-count');
const playerListElement = document.getElementById('player-list');
const hostDisplayElement = document.getElementById('host-display');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownText = document.getElementById('countdown-text');
const tallyingOverlay = document.getElementById('tallying-overlay');
const leaderboardTableBody = document.querySelector('#leaderboard-table tbody');
const nicknameInput = document.getElementById('nickname-input');
const changeNicknameButton = document.getElementById('change-nickname-button');
const hostSpectateView = document.getElementById('host-spectate-view');
const spectateProgressContainer = document.getElementById('spectate-progress-container');

// 호스트 컨트롤 요소 추가
const hostTimerElement = document.getElementById('host-timer');
const forceEndButton = document.getElementById('force-end-button');

// --- State ---
let timer; // 클라이언트 측 시각 표시용 타이머
let startTime;

// 게임 시간 상수 (서버와 동일하게 설정)
const COUNTDOWN_TIME = 10;  // 카운트다운 시간 (초)
const TEST_TIME = 120;       // 타이핑 시간 (초)
const TALLY_DURATION = 10;   // 집계 시간 (초)

let testEnded = false;
let currentText = ""; // 현재 타이핑할 문장 저장

// 게임 진행 중 플래그 추가
let isGameActive = false;

// --- Socket.IO Event Listeners ---
socket.on('connect', () => {
    mySid = socket.id;
    console.log('Connected to server with SID:', mySid);
});

socket.on('update_state', (gameState) => {
    console.log('Received new game state:', gameState.status, gameState);
    
    //testEnded 상태일 때는 TALLYING/RESULTS만 처리
    if (testEnded && gameState.status === 'IN_PROGRESS') {
        console.log('Already finished typing, ignoring IN_PROGRESS state update');
        return;
    }
    
    startScreen.classList.add('hidden');
    typingScreen.classList.add('hidden');
    countdownOverlay.classList.add('hidden');
    tallyingOverlay.classList.add('hidden');
    resultModal.classList.add('hidden');

    switch (gameState.status) {
        case 'WAITING':
            renderWaitingRoom(gameState);
            break;
        case 'COUNTDOWN':
            renderCountdown(gameState);
            break;
        case 'IN_PROGRESS':
            renderGame(gameState);
            break;
        case 'TALLYING':
            renderTallying(gameState);
            break;
        case 'RESULTS':
            renderResults(gameState);
            break;
    }
});

// 서버에서 타이머 업데이트 수신 
socket.on('timer_update', (data) => {
    timerElement.innerText = `${data.remaining}s`;
    if (hostTimerElement) {
        hostTimerElement.innerText = `${data.remaining}s`;
    }
    if (startTime) {
        updateStats();
    }
});

// --- UI 렌더링 함수 ---
function renderWaitingRoom(gameState) {
    startScreen.classList.remove('hidden');
    
    // 게임 재시작 시 상태 초기화
    testEnded = false;
    isGameActive = false; 
    quoteInputElement.value = '';
    quoteInputElement.disabled = true;
    clearInterval(timer);
    
    document.getElementById('nickname-container').classList.remove('hidden');
    if (mySid && gameState.players[mySid]) {
        nicknameInput.value = gameState.players[mySid].nickname;
    }

    userCountElement.innerText = Object.keys(gameState.players).length;
    playerListElement.innerHTML = '';
    let hostNickname = "Waiting...";
    
    Object.values(gameState.players).forEach(player => {
        const li = document.createElement('li');
        li.className = 'player-item';
        li.textContent = player.nickname;
        if (player.id === gameState.host_sid) {
            const hostTag = document.createElement('span');
            hostTag.className = 'host-tag';
            hostTag.textContent = 'HOST';
            li.appendChild(hostTag);
            hostNickname = player.nickname;
        }
        playerListElement.appendChild(li);
    });
    hostDisplayElement.textContent = hostNickname;

    if (mySid === gameState.host_sid) {
        startButton.classList.remove('hidden');
        startButton.disabled = false;
        startButton.textContent = 'Start Game';
    } else {
        startButton.classList.add('hidden');
    }
}

function renderCountdown(gameState) {
    countdownOverlay.classList.remove('hidden');
    let count = COUNTDOWN_TIME; // COUNTDOWN_TIME 사용
    countdownText.innerText = count;
    const countdownInterval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownText.innerText = count;
        } else {
            countdownText.innerText = 'Go!';
            clearInterval(countdownInterval);
        }
    }, 1000);
    
    // COUNTDOWN 단계에서는 텍스트만 준비 (렌더링 안 함)
    currentText = gameState.text_to_type;
}

function renderGame(gameState) {
    typingScreen.classList.remove('hidden');

    const amIHost = mySid === gameState.host_sid;
    
    hostSpectateView.classList.toggle('hidden', !amIHost);
    document.querySelector('#typing-screen .result').classList.toggle('hidden', amIHost);
    quoteDisplayElement.classList.toggle('hidden', amIHost);
    keyboardElement.classList.toggle('hidden', amIHost);

    const nicknameContainer = document.getElementById('nickname-container');
    if (nicknameContainer) {
        nicknameContainer.classList.add('hidden');
    }

    if (amIHost) {
        renderSpectateView(gameState);
        // 호스트는 서버 타이머를 사용
        if (forceEndButton) {
            forceEndButton.disabled = false;
        }
    } else {
        // 최초 한 번만 타이핑 시작 제발 잘 되어줘 제발 플리스 
        if (!isGameActive && !testEnded) {
            console.log('Starting typing for the first time');
            isGameActive = true;
            startTyping(gameState);
        } else {
            console.log('Already active or finished, skipping startTyping');
        }
    }
}

function renderTallying(gameState) {
    tallyingOverlay.classList.remove('hidden');
    if (!testEnded) {
        endTest(false);
    }
}

function renderResults(gameState) {
    resultModal.classList.remove('hidden');
    leaderboardTableBody.innerHTML = ''; 

    const completedResults = (gameState.results || []).filter(r => r.status !== 'eliminated');
    const eliminatedResults = (gameState.results || []).filter(r => r.status === 'eliminated');

    completedResults.forEach((result, index) => {
        const rank = index + 1;
        const isSelf = result.id === mySid;

        const row = document.createElement('tr');
        if (isSelf) {
            row.classList.add('my-rank');
        }

        row.innerHTML = `
            <td>${rank}</td>
            <td>${result.nickname}</td>
            <td>${result.wpm !== undefined ? result.wpm : 0}</td>
            <td>${result.accuracy !== undefined ? result.accuracy : 0}%</td>
        `;
        leaderboardTableBody.appendChild(row);
    });

    if (eliminatedResults.length > 0) {
        const separatorRow = document.createElement('tr');
        separatorRow.innerHTML = `<td colspan="4" style="text-align: center; font-weight: bold; background-color: #f5f5f5; color: #999;">--- Eliminated ---</td>`;
        leaderboardTableBody.appendChild(separatorRow);

        eliminatedResults.forEach((result) => {
            const isSelf = result.id === mySid;
            const row = document.createElement('tr');
            if (isSelf) {
                row.classList.add('my-rank');
            }
            row.style.backgroundColor = '#ffebee';
            row.innerHTML = `
                <td>-</td>
                <td>${result.nickname}</td>
                <td colspan="2" style="color: red; font-weight: bold;">${result.elimination_reason || 'Eliminated'}</td>
            `;
            leaderboardTableBody.appendChild(row);
        });
    }

    if (mySid === gameState.host_sid) {
        closeResultModalButton.classList.remove('hidden');
    } else {
        closeResultModalButton.classList.add('hidden');
    }
}

// --- Event Listeners ---

changeNicknameButton.addEventListener('click', () => {
    const newNickname = nicknameInput.value.trim();
    if (newNickname) {
        socket.emit('change_nickname', { nickname: newNickname });
    }
});

startButton.addEventListener('click', () => {
    startButton.disabled = true;
    startButton.textContent = 'Starting...';
    socket.emit('start_game');
});

closeResultModalButton.addEventListener('click', () => {
    socket.emit('return_to_lobby');
});

// 호스트 즉시 종료 버튼 이벤트
if (forceEndButton) {
    forceEndButton.addEventListener('click', () => {
        socket.emit('force_end_game');
        forceEndButton.disabled = true;
    });
}

document.getElementById('how-to-play-button').addEventListener('click', () => infoModal.classList.remove('hidden'));
closeInfoModalButton.addEventListener('click', () => infoModal.classList.add('hidden'));

quoteInputElement.addEventListener('input', handleInput);
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

// --- Main Game Logic Functions ---
function startTyping(gameState) {
    // 이미 완료한 경우 재시작 방지
    if (testEnded) {
        console.log('Already finished, not restarting typing');
        return;
    }
    
    // 타이핑 시작 시 상태 초기화
    quoteInputElement.value = '';
    quoteInputElement.disabled = false;
    testEnded = false;
    currentText = gameState.text_to_type;
    startTime = null; // 초기에는 null로 설정
    
    if (!currentText) return;

    renderTextToType(currentText);
    quoteInputElement.focus();
}


function handleInput() {
    if (testEnded) {
        console.log('testEnded is true, ignoring input');
        return;
    }
    
    // 첫 입력 시 startTime 설정
    if (!startTime) {
        startTime = Date.now();
    }

    const allCharSpans = Array.from(quoteDisplayElement.querySelectorAll('span:not(.word)'));
    const typedValue = quoteInputElement.value;
    
    allCharSpans.forEach((charSpan, index) => {
        const char = typedValue[index];
        charSpan.className = '';
        if (char == null) {} 
        else if (char === (charSpan.innerHTML === '&nbsp;' ? ' ' : charSpan.innerText)) {
            charSpan.classList.add('correct');
        } else {
            charSpan.classList.add('incorrect');
        }
    });

    const oldCurrentSpan = quoteDisplayElement.querySelector('span.current');
    if (oldCurrentSpan) oldCurrentSpan.classList.remove('current');
    
    if (typedValue.length < allCharSpans.length) {
        allCharSpans[typedValue.length].classList.add('current');
    } else if (typedValue.length === allCharSpans.length) {
        // 완료 즉시 endTest 호출 및 중복 방지
        if (!testEnded) {
            console.log('Typing completed, calling endTest');
            endTest(true);
            return; // 즉시 리턴하여 추가 처리 방지
        }
    }
    
    if (typedValue.length === 0 && allCharSpans.length > 0) {
        allCharSpans[0].classList.add('current');
    }
    
    updateKeyboardHighlight();
    
    const progress = (typedValue.length / currentText.length) * 100;
    socket.emit('player_progress', { progress: progress });
}

function endTest(isEarlyFinish = false) {
    if (testEnded) {
        console.log('endTest called but testEnded already true');
        return;
    }
    
    console.log('Setting testEnded to true');
    testEnded = true;
    
    quoteInputElement.disabled = true;
    quoteInputElement.blur(); // 포커스 해제

    const { wpm, accuracy, mistakes } = calculateStats();
    socket.emit('submit_result', { wpm, accuracy, mistakes });
    
    // 완료 후 메시지 표시 및 입력 차단 강화
    if (isEarlyFinish) {
        // 완료 메시지 표시
        const completeMessage = document.createElement('h2');
        completeMessage.textContent = 'You finished! Waiting for other players...';
        completeMessage.style.marginBottom = '20px';
        completeMessage.style.color = 'var(--correct-color)';
        quoteDisplayElement.innerHTML = '';
        quoteDisplayElement.appendChild(completeMessage);
        
        // 최종 통계 표시
        wpmElement.innerText = wpm;
        accuracyElement.innerText = `${accuracy}%`;
        
        // 입력창을 완전히 비우고 비활성화
        quoteInputElement.value = '';
    } else {
        quoteDisplayElement.innerHTML = "<h2>Time's up!</h2>";
    }
}

function calculateStats() {
    const elapsedSeconds = startTime ? (Date.now() - startTime) / 1000 : 0;
    if (elapsedSeconds <= 0) return { wpm: 0, accuracy: 100, mistakes: 0 };

    const typedValue = quoteInputElement.value;
    const typedLength = typedValue.length;
    let correctChars = 0;
    
    Array.from(quoteDisplayElement.querySelectorAll('span:not(.word)')).slice(0, typedLength).forEach(span => {
        if (span.classList.contains('correct')) correctChars++;
    });
    
    const accuracy = typedLength > 0 ? Math.round((correctChars / typedLength) * 100) : 100;
    const wpm = Math.round((typedLength / 5) / (elapsedSeconds / 60));

    const mistakes = Array.from(quoteDisplayElement.querySelectorAll('.incorrect')).length;
    return { wpm, accuracy, mistakes };
}

function updateStats() {
    if (!startTime) return;
    const { wpm, accuracy, mistakes } = calculateStats();
    wpmElement.innerText = isNaN(wpm) ? 0 : wpm;
    accuracyElement.innerText = `${isNaN(accuracy) ? 100 : accuracy}%`;
}

function renderTextToType(text) {
    // testEnded 상태면 절대 렌더링 안 함
    if (testEnded) {
        console.log('Already finished, not rendering new text');
        return;
    }
    
    console.log('Rendering text to type:', text.substring(0, 50) + '...');
    
    quoteInputElement.value = null;
    wpmElement.innerText = '0';
    accuracyElement.innerText = '100%';
    startTime = null; // 초기에는 null로 설정
    currentText = text;
    
    quoteDisplayElement.innerHTML = '';
    text.split(' ').forEach((word, wordIndex, words) => {
        const wordSpan = document.createElement('span');
        wordSpan.className = 'word';
        word.split('').forEach(char => {
            const charSpan = document.createElement('span');
            charSpan.innerText = char;
            wordSpan.appendChild(charSpan);
        });
        quoteDisplayElement.appendChild(wordSpan);
        if (wordIndex < words.length - 1) {
            const spaceSpan = document.createElement('span');
            spaceSpan.innerHTML = '&nbsp;';
            quoteDisplayElement.appendChild(spaceSpan);
        }
    });
    
    const firstChar = quoteDisplayElement.querySelector('span:not(.word)');
    if (firstChar) firstChar.classList.add('current');
    updateKeyboardHighlight();
}


function renderSpectateView(gameState) {
    spectateProgressContainer.innerHTML = '';
    for (const sid in gameState.players) {
        if (sid === gameState.host_sid) continue;
        
        const player = gameState.players[sid];
        const card = document.createElement('div');
        card.className = 'spectate-player-card';

        const playerResult = gameState.results.find(r => r.id === sid);
        const progress = player.progress || 0;

        let statusText = player.status;
        let statusClass = player.status;
        if(player.status === 'finished' && playerResult) {
            statusText = `Finished (${playerResult.wpm} WPM)`;
            statusClass = 'finished';
        }

        card.innerHTML = `
            <div class="nickname">
                <span>${player.nickname}</span>
                <span class="status ${statusClass}">${statusText}</span>
            </div>
            <div class="progress-bar-bg">
                <div class="progress-bar" style="width: ${progress}%"></div>
            </div>
        `;
        spectateProgressContainer.appendChild(card);
    }
}

// --- 유틸리티 함수 ---
function createKeyboard() {
    keyboardElement.innerHTML = '';
    const keysLayout = [
        ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'],
        ['Tab', 'q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '[', ']', '\\'],
        ['CapsLock', 'a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', ';', "'", 'Enter'],
        ['ShiftLeft', 'z', 'x', 'c', 'v', 'b', 'n', 'm', ',', '.', '/', 'ShiftRight'],
        ['ControlLeft', 'MetaLeft', 'AltLeft', 'Space', 'AltRight', 'MetaRight', 'ControlRight']
    ];
    keysLayout.forEach(row => {
        row.forEach(keyName => {
            const keyElement = document.createElement('div');
            keyElement.classList.add('key');
            let displayText = keyName.length > 1 ? keyName : keyName.toUpperCase();
            if (keyName.includes('Control')) displayText = 'Ctrl';
            if (keyName.includes('Meta')) displayText = 'Win';
            if (keyName.includes('Alt')) displayText = 'Alt';
            if (keyName.includes('Shift')) displayText = 'Shift';
            keyElement.innerText = displayText;
            let dataKey;
            const keyMap = {'`':'Backquote', '-':'Minus', '=':'Equal', '[':'BracketLeft', ']':'BracketRight', '\\':'Backslash', ';':'Semicolon', "'":'Quote', ',':'Comma', '.':'Period', '/':'Slash'};
            if (keyMap[keyName]) dataKey = keyMap[keyName];
            else if (!isNaN(keyName)) dataKey = `Digit${keyName}`;
            else if (keyName.length === 1 && keyName.match(/[a-z]/i)) dataKey = `Key${keyName.toUpperCase()}`;
            else dataKey = keyName;
            keyElement.setAttribute('data-key', dataKey);
            keyboardElement.appendChild(keyElement);
        });
    });
}
function updateKeyboardHighlight() {
    document.querySelectorAll('.key.highlight').forEach(k => k.classList.remove('highlight'));
    const currentSpan = document.querySelector('.quote-display span.current');
    if (!currentSpan) return;
    
    const nextChar = currentSpan.innerHTML === '&nbsp;' ? ' ' : currentSpan.innerText;
    let keyToFind;
    const keyMap = {'`':'Backquote', '-':'Minus', '=':'Equal', '[':'BracketLeft', ']':'BracketRight', '\\':'Backslash', ';':'Semicolon', "'":'Quote', ',':'Comma', '.':'Period', '/':'Slash', ' ':'Space'};
    if (keyMap[nextChar]) keyToFind = keyMap[nextChar];
    else if (!isNaN(nextChar)) keyToFind = `Digit${nextChar}`;
    else if (nextChar.length === 1) keyToFind = `Key${nextChar.toUpperCase()}`;
    
    if (keyToFind) {
        const keyElement = document.querySelector(`.key[data-key="${keyToFind}"]`);
        if (keyElement) keyElement.classList.add('highlight');
    }
}
function handleKeyDown(e) {
    if (typingScreen.classList.contains('hidden') || quoteInputElement.disabled) return;
    
    const nonTypingKeys = ['Control', 'Alt', 'Meta', 'Shift', 'CapsLock', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Insert', 'Delete', 'Enter', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
    if (nonTypingKeys.includes(e.key)) return;
    
    if (["Tab", "AltLeft", "AltRight"].includes(e.code)) e.preventDefault();
    
    const keyElement = document.querySelector(`.key[data-key="${e.code}"]`);
    if (keyElement) keyElement.classList.add('active');
}
function handleKeyUp(e) {
    const keyElement = document.querySelector(`.key[data-key="${e.code}"]`);
    if (keyElement) keyElement.classList.remove('active');
}

// --- Initial Load ---
createKeyboard();