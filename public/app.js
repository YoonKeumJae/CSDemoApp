const status = document.querySelector('#status');
const notice = document.querySelector('#notice');
const message = document.querySelector('#notice-text');
const connectButton = document.querySelector('#connect');
const chat = document.querySelector('#webchat');
const agentEndpoint = 'https://default62ae463a9f124edf85444f6ca38345.24.environment.api.powerplatform.com/powervirtualagents/botsbyschema/new_CSDemoApp/directline/token?api-version=2022-03-01-preview';
const isStatic = Boolean(document.querySelector('meta[name="static-hosting"]'));
let directLine, subscription, busy = false, generation = 0;
async function connect() {
  if (busy) return;
  busy = true;
  const current = ++generation;
  connectButton.disabled = true;
  document.querySelector('#restart').disabled = true;
  subscription?.unsubscribe(); directLine?.end();
  chat.hidden = true; notice.hidden = false;
  status.textContent = '연결 중';
  try {
    if (!window.WebChat) throw new Error('채팅 라이브러리를 불러오지 못했습니다. 인터넷 연결을 확인해주세요.');
    const url = isStatic ? agentEndpoint : '/api/token';
    const method = isStatic ? 'GET' : 'POST';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    let response, data;
    try {
      response = await fetch(url, { method, signal: controller.signal, credentials: 'omit' });
      data = await response.json();
    } finally {
      clearTimeout(timeout);
    }
    if (!response.ok) throw new Error(data.error);
    if (typeof data.token !== 'string' || !data.token) throw new Error('토큰 서버가 유효한 대화용 토큰을 반환하지 않았습니다.');
    const domain = isStatic ? 'https://unitedstates.directline.botframework.com/v3/directline' : data.domain;
    const userID = `dl_${crypto.randomUUID()}`;
    directLine = window.WebChat.createDirectLine({ token: data.token, domain });
    window.WebChat.renderWebChat({ directLine, userID, locale: 'ko-KR', styleOptions: { accent: '#635bda', backgroundColor: '#ffffff', bubbleBackground: '#f3f3fa', bubbleFromUserBackground: '#635bda', bubbleFromUserTextColor: '#fff', bubbleBorderRadius: 14, bubbleFromUserBorderRadius: 14, hideUploadButton: true, botAvatarInitials: 'AI', userAvatarInitials: '나', sendBoxPlaceholder: '메시지를 입력하세요…', fontSizeSmall: '85%' } }, chat);
    let greeted = false;
    subscription = directLine.connectionStatus$.subscribe(value => {
      if (current !== generation) return;
      status.textContent = ({ 0: '연결 준비', 1: '연결 중', 2: '연결됨', 3: '토큰 만료 · 새 대화 필요', 4: '연결 실패', 5: '대화 종료' })[value];
      if (value === 2) {
        notice.hidden = true; chat.hidden = false;
        if (!greeted) { greeted = true; directLine.postActivity({ type: 'event', name: 'startConversation', from: { id: userID }, locale: 'ko-KR' }).subscribe({ error: () => { status.textContent = '연결됨 · 인사 요청 실패'; } }); }
      } else if (value === 3 || value === 4) { notice.hidden = false; chat.hidden = true; message.textContent = '연결이 끊겼습니다. 대화를 다시 시작해주세요.'; }
    });
  } catch (error) { status.textContent = '연결 필요'; message.textContent = error.message; }
  finally { busy = false; connectButton.disabled = false; document.querySelector('#restart').disabled = false; }
}
connectButton.addEventListener('click', connect);
document.querySelector('#restart').addEventListener('click', connect);
if (isStatic) {
  document.querySelector('#agent-name').textContent = 'CSDemoApp';
  status.textContent = '대화 시작 준비';
  message.textContent = 'CSDemoApp 에이전트가 준비되었습니다. 대화 시작을 눌러주세요.';
} else fetch('/api/config').then(r => r.json()).then(config => {
  document.querySelector('#agent-name').textContent = config.agentName;
  if (!config.configured) { status.textContent = '설정 필요'; message.textContent = '서버의 .env 파일에 Token Endpoint 또는 Direct Line Secret을 설정해주세요.'; }
}).catch(() => { message.textContent = '서버에 연결할 수 없습니다.'; });
window.addEventListener('pagehide', () => { subscription?.unsubscribe(); directLine?.end(); });
