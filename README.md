# ⌨️ TypeRace Arena

> Real-time multiplayer typing competition platform. Host a game, invite friends, and compete in high-speed typing races with live leaderboards.

![Python](https://img.shields.io/badge/Python-3.10.3-blue) ![JavaScript](https://img.shields.io/badge/JavaScript-ES6%2B-yellow) ![Flask](https://img.shields.io/badge/Flask-SocketIO-green) ![License](https://img.shields.io/badge/License-MIT%20with%20Attribution-red)

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [Game Rules](#game-rules)
- [Architecture](#architecture)
- [API Events](#api-events)
- [Configuration](#configuration)
- [License](#license)
- [Attribution](#attribution)

---

## 🎮 Overview

**TypeRace Arena** is a competitive real-time multiplayer typing game built with Flask and WebSocket. Players join a lobby, wait for the host to start, and race against each other to type given text accurately and quickly.

**Key Capabilities**:
- **Real-time synchronization** via WebSocket (Socket.IO)
- **Host-based game management** with automatic host reassignment
- **Performance metrics**: WPM (Words Per Minute), Accuracy, Error tracking
- **Interactive keyboard visualization** with live key feedback
- **Dynamic leaderboard** with ranking and statistics
- **Error elimination system**: Automatic disqualification at 5+ mistakes

---

## ✨ Features

- ✅ **Multiplayer Lobby System**: Join seamlessly, real-time nickname updates
- ✅ **Host Controls**: Game initiation and lifecycle management by host only
- ✅ **Spectator Mode**: Host monitors all players in real-time
- ✅ **Live Typing Stats**: 
  - Real-time WPM calculation
  - Accuracy percentage tracking
  - Live error detection
  - Automatic word progression
- ✅ **Visual Keyboard**: Interactive QWERTY layout with keystroke feedback
- ✅ **Results Dashboard**: Ranked leaderboard after each session
- ✅ **Automatic Error Handling**: Player elimination, host reassignment on disconnect
- ✅ **Responsive Layout**: Desktop and tablet optimized
- ✅ **Configurable Timing**: Adjustable countdown, game duration, results window

---

## 🛠️ Tech Stack

| Layer | Technology |
|-------|------------|
| **Backend** | Python 3.10.3, Flask, Flask-SocketIO, Eventlet |
| **Frontend** | HTML5, CSS3, JavaScript (ES6+) |
| **Real-time Communication** | WebSocket (Socket.IO) |
| **Async Runtime** | Eventlet greenlets |

---

## 📦 Installation

### Prerequisites

- **Python 3.10.3**
- **pip** package manager
- **Modern browser** (Chrome, Firefox, Safari, Edge)

### Setup

```bash
# Clone repository
git clone https://github.com/kangwoo-kim/typerace-arena.git
cd typerace-arena

# Create virtual environment
python3.10 -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

# Install dependencies
pip install flask flask-socketio eventlet python-socketio python-engineio
```

---

## 🚀 Quick Start

### Directory Structure

```
typerace-arena/
├── server.py
├── templates/
│   └── index.html
├── static/
│   ├── style.css
│   └── script.js
├── README.md
└── LICENSE
```

### Run Server

```bash
python server.py
```

Server starts on `http://0.0.0.0:5555`

### Access Application

Navigate browser to `http://localhost:5555`

---

## 📝 Game Rules

1. **First Connection = Host**: First player auto-promoted to host role
2. **Typing Challenge**: Players race to accurately type displayed text
3. **Error Threshold**: 5+ errors trigger automatic elimination
4. **Ranking Algorithm**: Sorted by WPM (descending), eliminated players listed separately
5. **Early Submission**: Players can finish early if text complete with <5 errors
6. **Host Authority**: Only host can initiate/terminate games
7. **Nickname Lockdown**: Names frozen after game start

---

## 🏗️ Architecture

### Backend State Machine

```
Client Connect
    ↓
Register in game_state
    ↓
First? → Assign Host
    ↓
Broadcast to all clients
    ↓
Host Triggers Start
    ↓
COUNTDOWN → IN_PROGRESS → TALLYING → RESULTS
    ↓
Calculate rankings, eliminate errors
    ↓
Distribute results
```

### Frontend Flow

```
Connection → Waiting Room → Countdown → Active Typing
    ↓                                        ↓
    Player (Input)                     Host (Monitor)
    ↓                                        ↓
    Result Submission              Progress Tracking
    ↓                                        ↓
    TALLYING → RESULTS → Leaderboard Display
```

---

## 📡 API Events

### Client → Server

| Event | Payload | Purpose |
|-------|---------|---------|
| `start_game` | — | Host initiates countdown |
| `force_end_game` | — | Host terminates game immediately |
| `submit_result` | `{wpm, accuracy, mistakes}` | Player submits score |
| `player_progress` | `{progress}` | Player sends typing progress (0-100%) |
| `change_nickname` | `{nickname}` | Player updates displayed name |
| `return_to_lobby` | — | Host resets to waiting room |

### Server → Client

| Event | Payload | Purpose |
|-------|---------|---------|
| `update_state` | `game_state` | Full state broadcast to all |
| `timer_update` | `{remaining}` | Server time synchronization |

---

## ⚙️ Configuration

### Game Timing

Modify in `server.py`:

```python
COUNTDOWN_TIME = 10   # Countdown (seconds)
GAME_DURATION = 120   # Typing window (seconds)
TALLY_DURATION = 10   # Results display (seconds)
```

### Text Pool

Update `TEST_QUOTES` in `server.py`:

```python
TEST_QUOTES = [
    "Your custom typing challenge text...",
    "Another competitive typing sample...",
]
```

### Server Configuration

```python
if __name__ == '__main__':
    socketio.run(
        app,
        host='0.0.0.0',    # Network accessibility
        port=5555,         # Port number
        debug=True         # Development mode
    )
```

---

## 📊 Performance Metrics

**Tracked per player**:
- **WPM**: Characters typed / (time elapsed / 60)
- **Accuracy**: (Correct characters / Total typed) × 100
- **Mistakes**: Count of incorrect inputs
- **Status**: Active or Eliminated

---

## 📄 License

This project is licensed under **MIT License with Attribution Requirements**.

See [LICENSE](./LICENSE) for full terms.

### License Summary

✅ **Permitted**:
- Commercial and private use
- Modification and redistribution
- Derivative works

⚠️ **Required**:
- Attribution to original authors
- Modification documentation
- Source code link in distributions
- License inclusion

---

## 👥 Attribution

**Original Developers**:
- **Kangwoo Kim** (김강우) - Backend architecture, game logic, server management
  - GitHub: [@kangwoo-kim](https://github.com/kangwoo-kim)
  - Education: Kangnam University, AI Department
  - Current: KOICA Project Volunteer (3rd Batch), Uganda
  
- **Mutabi Jake** - Frontend UI/UX, client-side interaction

**Copyright © 2025 Kangwoo Kim**

### Attribution Template

When using, modifying, or distributing:

```
TypeRace Arena
Original Author: Kangwoo Kim
Source: https://github.com/kangwoo-kim/typerace-arena
License: MIT with Attribution
Copyright © 2025 Kangwoo Kim
```

---

## 📮 Issues & Contributions

Report bugs or suggest features: [GitHub Issues](https://github.com/kangwoo-kim/typerace-arena/issues)

---

## 🎓 Technical References

- **Socket.IO**: https://socket.io/docs/
- **Flask**: https://flask.palletsprojects.com/
- **Eventlet**: https://eventlet.net/
- **Python 3.10**: https://docs.python.org/3.10/

---

**Made in Uganda • KOICA Volunteer Program**