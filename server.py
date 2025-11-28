import eventlet
eventlet.monkey_patch()

from flask import Flask, render_template, request
from flask_socketio import SocketIO, emit
import random
import time

# Flask 앱 생성 시, 정적 파일 및 템플릿 폴더 위치 명시
app = Flask(__name__, static_folder='static', template_folder='templates')
app.config['SECRET_KEY'] = 'a-very-secret-key-for-typing-race'
socketio = SocketIO(app, async_mode='eventlet')

# --- 중앙 게임 상태 관리 ---
game_state = {
    'status': 'WAITING',  # WAITING, COUNTDOWN, IN_PROGRESS, TALLYING, RESULTS
    'players': {},        # {sid: {'id': sid, 'nickname': '...', 'status': '...', 'progress': 0}, ...}
    'host_sid': None,
    'results': [],
    'text_to_type': "",
    'game_end_time': 0
}

TEST_QUOTES = [
    "Uganda is a big and beautiful country in East Africa. It has many lakes, rivers, and green hills. The Nile River begins in Uganda. People are kind and love music and dance. Many work on farms and grow food like coffee and bananas. Uganda is peaceful and full of life. It is truly the Pearl of Africa."
]

# 게임 시간 설정 - 여기서 변경하면 됩니당 ㅎ
COUNTDOWN_TIME = 10   # 카운트다운 시간 (초) - 원하는 값으로 변경 가능
GAME_DURATION = 120   # 타이핑 시간 (초) - 원하는 값으로 변경 가능
TALLY_DURATION = 10   # 집계 시간 (초) - 원하는 값으로 변경 가능

def reset_game_state():
    """게임을 초기 대기 상태로 리셋합니다."""
    global game_state
    game_state['status'] = 'WAITING'
    game_state['results'] = []
    game_state['text_to_type'] = ""
    game_state['game_end_time'] = 0
    # 모든 플레이어의 상태와 진행률을 초기화
    for sid in game_state['players']:
        game_state['players'][sid]['status'] = 'playing'
        game_state['players'][sid]['progress'] = 0
    print("--- Game State Reset to WAITING ---")

@app.route('/')
def index():
    return render_template('index.html')

# --- SocketIO 이벤트 핸들러 ---
@socketio.on('connect')
def handle_connect():
    sid = request.sid
    print(f'Client connected: {sid}')
    
    game_state['players'][sid] = {
        'id': sid,
        'nickname': f'Player-{sid[:5]}',
        'status': 'playing',
        'progress': 0
    }
    
    if not game_state['host_sid']:
        game_state['host_sid'] = sid
        print(f"New Host assigned: {sid}")

    emit('update_state', game_state, broadcast=True)

@socketio.on('disconnect')
def handle_disconnect():
    sid = request.sid
    print(f'Client disconnected: {sid}')
    
    if sid in game_state['players']:
        del game_state['players'][sid]
    
    # 방장이 나갔을 경우 처리
    if sid == game_state['host_sid']:
        if game_state['players']: # 다른 플레이어가 남아있으면
            new_host_sid = list(game_state['players'].keys())[0]
            game_state['host_sid'] = new_host_sid
            print(f"Host disconnected. New host assigned: {new_host_sid}")
        else: # 아무도 없으면
            game_state['host_sid'] = None
            print("Last player (host) left. Lobby is empty.")
            
    emit('update_state', game_state, broadcast=True)

@socketio.on('start_game')
def handle_start_game():
    sid = request.sid
    if sid == game_state['host_sid'] and game_state['status'] == 'WAITING':
        if sid in game_state['players']:
            game_state['players'][sid]['status'] = 'spectating'
            
        print("Host started the game. Initializing countdown.")
        game_state['status'] = 'COUNTDOWN'
        game_state['results'] = []
        game_state['text_to_type'] = random.choice(TEST_QUOTES)
        
        # 모든 플레이어의 상태를 playing으로, 진행률을 0으로 초기화
        for player_sid in game_state['players']:
            if player_sid != game_state['host_sid']:
                game_state['players'][player_sid]['status'] = 'playing'
                game_state['players'][player_sid]['progress'] = 0

        emit('update_state', game_state, broadcast=True)
        socketio.start_background_task(target=game_timer_task)

# 호스트가 즉시 순위 집계하는 이벤트 추가
@socketio.on('force_end_game')
def handle_force_end_game():
    """호스트가 게임을 즉시 종료하고 순위 집계"""
    sid = request.sid
    if sid == game_state['host_sid'] and game_state['status'] == 'IN_PROGRESS':
        print("Host forced game end. Moving to TALLYING immediately.")
        game_state['status'] = 'TALLYING'
        emit('update_state', game_state, broadcast=True)
        # 바로 최종 집계 시작
        socketio.start_background_task(target=finalize_results_task)

def finalize_results_task():
    """최종 결과 집계 (별도 태스크로 분리)"""
    socketio.sleep(TALLY_DURATION)
    
    print("Tallying finished. Finalizing results.")
    
    submitted_sids = {res['id'] for res in game_state['results']}
    for sid, player in game_state['players'].items():
        if sid not in submitted_sids and player['status'] != 'spectating':
            game_state['results'].append({
                'id': sid, 'nickname': player['nickname'], 'wpm': 0, 'accuracy': 0, 'mistakes': 0
            })
            print(f"Player {player['nickname']} did not submit. Added as 0 WPM.")
            
    # 오타 5회 이상인 플레이어 탈락 처리
    for result in game_state['results']:
        if result.get('mistakes', 0) >= 5:
            result['status'] = 'eliminated'
            result['elimination_reason'] = 'Eliminated due to 5+ errors'
            print(f"Player {result['nickname']} eliminated due to {result['mistakes']} mistakes")
        else:
            result['status'] = 'completed'

    # 탈락하지 않은 플레이어만 순위 정렬
    completed_results = [r for r in game_state['results'] if r.get('status') != 'eliminated']
    eliminated_results = [r for r in game_state['results'] if r.get('status') == 'eliminated']

    completed_results.sort(key=lambda x: x['wpm'], reverse=True)
    game_state['results'] = completed_results + eliminated_results

    game_state['status'] = 'RESULTS'
    socketio.emit('update_state', game_state)
    print("Final results sent to all clients.")

def game_timer_task():
    """서버에서 게임 전체 시간을 관리하는 태스크."""
    print(f"Countdown running for {COUNTDOWN_TIME} seconds...")
    socketio.sleep(COUNTDOWN_TIME)  # COUNTDOWN_TIME 사용

    game_state['status'] = 'IN_PROGRESS'
    game_state['game_end_time'] = time.time() + GAME_DURATION + TALLY_DURATION
    print(f"Game is now IN_PROGRESS for {GAME_DURATION} seconds.")
    socketio.emit('update_state', game_state)
    
    # 타이머 동기화 - 1초마다 남은 시간 브로드캐스트
    for remaining in range(GAME_DURATION, 0, -1):
        socketio.sleep(1)
        if game_state['status'] != 'IN_PROGRESS':  # 강제 종료된 경우 중단
            return
        socketio.emit('timer_update', {'remaining': remaining - 1})

    # 게임이 강제 종료되지 않았을 경우에만 TALLYING으로 전환
    if game_state['status'] == 'IN_PROGRESS':
        game_state['status'] = 'TALLYING'
        print(f"Game time over. Tallying results for {TALLY_DURATION} seconds.")
        socketio.emit('update_state', game_state)
        finalize_results_task()

@socketio.on('submit_result')
def handle_submit_result(data):
    sid = request.sid
    if game_state['status'] not in ['IN_PROGRESS', 'TALLYING'] or sid not in game_state['players']:
        return

    if any(res['id'] == sid for res in game_state['results']):
        return
        
    player_info = game_state['players'][sid]
    result_data = {
        'id': sid, 'nickname': player_info['nickname'], 'wpm': data['wpm'], 'accuracy': data['accuracy'],
        'mistakes': data.get('mistakes', 0)
    }
    game_state['results'].append(result_data)
    game_state['players'][sid]['status'] = 'finished'

    print(f"Result received from {player_info['nickname']}: WPM {data['wpm']}, Mistakes {data.get('mistakes', 0)}")
    emit('update_state', game_state, broadcast=True)

@socketio.on('player_progress')
def handle_player_progress(data):
    sid = request.sid
    if sid in game_state['players'] and game_state['status'] == 'IN_PROGRESS':
        game_state['players'][sid]['progress'] = data.get('progress', 0)
        if game_state['host_sid']:
            emit('update_state', game_state, to=game_state['host_sid'])
            
@socketio.on('change_nickname')
def handle_change_nickname(data):
    sid = request.sid
    if sid in game_state['players'] and data.get('nickname'):
        new_nickname = data['nickname'].strip()[:15]
        if new_nickname:
            game_state['players'][sid]['nickname'] = new_nickname
            print(f"Nickname changed for {sid}: {new_nickname}")
            emit('update_state', game_state, broadcast=True)

@socketio.on('return_to_lobby')
def handle_return_to_lobby():
    if request.sid == game_state['host_sid']:
        reset_game_state()
        emit('update_state', game_state, broadcast=True)

if __name__ == '__main__':
    print("Server starting...")
    socketio.run(app, host='0.0.0.0', port=5555, debug=True)