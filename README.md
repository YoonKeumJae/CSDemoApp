# Copilot Studio Web App

Copilot Studio 에이전트와 Direct Line API로 대화하는 한국어 웹 앱입니다. Node.js 내장 HTTP 서버와 Microsoft Bot Framework Web Chat을 사용합니다. npm 패키지 설치 없이 실행할 수 있습니다.

## 실행

Node.js 22 이상이 필요합니다.

```powershell
Copy-Item .env.example .env
# .env의 COPILOT_TOKEN_ENDPOINT를 설정하세요.
node --env-file-if-exists=.env server.mjs
```

http://127.0.0.1:3000 에서 대화 시작을 누르세요. 포트는 PORT로 변경할 수 있습니다.

## 에이전트 설정

1. Copilot Studio에서 에이전트를 게시합니다.
2. 채널의 Mobile app / Native app 등 사용자 지정 앱 설정에서 Token Endpoint를 복사합니다. 메뉴 이름은 환경에 따라 다를 수 있습니다.
3. `.env`의 `COPILOT_TOKEN_ENDPOINT`에 해당 HTTPS URL을 설정합니다.
   Direct Line 채널 키를 사용한다면 Token Endpoint 대신 `DIRECT_LINE_SECRET`을 설정하세요. 서버가 키를 대화용 토큰으로 교환하며 원본 키를 브라우저로 보내지 않습니다.
4. 필요하면 `AGENT_NAME`을 변경합니다. 지역별 Direct Line을 사용하는 환경에서는 `DIRECT_LINE_DOMAIN`을 서비스 루트로 지정합니다. `/v3/directline`은 앱에서 추가합니다.
5. 서버를 재시작하고 대화를 시작합니다.

Token Endpoint를 서버에서 GET으로 호출하고, 발급된 대화용 토큰을 브라우저의 Web Chat에 전달합니다. Web Chat이 Direct Line 연결과 토큰 갱신, 메시지, 카드 렌더링을 처리합니다. 연결 시 `startConversation` 이벤트로 인사말을 요청합니다. 새 대화는 이전 연결을 닫고 별도의 대화를 시작합니다.

이 버전은 사용자 지정 웹 채널에 연결할 수 있는 에이전트를 대상으로 합니다. Microsoft 인증 필수 에이전트의 Entra ID 로그인 및 SSO 토큰 교환은 아직 구현하지 않았습니다. 인증 요구사항을 확인한 뒤 연결하세요.

## 검증

```powershell
node --test
```

서버 테스트는 설정 누락, 토큰 응답, 지역 URL, 교차 출처 차단 및 오류 정보 노출 방지를 검증합니다. 실제 에이전트 대화는 유효한 Token Endpoint로 별도 확인해야 합니다.

## 배포 시 고려사항

기본 바인딩은 로컬 전용입니다. 외부 호스팅에서 필요하면 `HOST=0.0.0.0`을 사용하고 HTTPS를 제공하세요. `.env`는 Git에서 제외합니다. 서버는 토큰을 저장하거나 로그에 출력하지 않습니다. Web Chat 4.18.0을 Microsoft CDN에서 로드하므로 브라우저 인터넷 접근이 필요합니다.

공개 배포 전에는 서버 토큰 발급 경로에 애플리케이션 인증과 요청 제한을 추가해야 합니다. 현재 같은 출처 요청 확인은 인증을 대신하지 않습니다. 조직 에이전트를 보호하기 위해 인증 설정을 임의로 낮추지 마세요.

## GitHub 연결

비공개 `CSDemoApp` 저장소를 생성한 뒤 다음 명령으로 연결합니다. `YOUR_ACCOUNT`는 실제 계정으로 바꾸세요.

```powershell
git remote add origin https://github.com/YOUR_ACCOUNT/CSDemoApp.git
git push -u origin main
```

## 참고

- [Microsoft: 사용자 지정 앱 연결 및 Token Endpoint](https://learn.microsoft.com/en-us/microsoft-copilot-studio/publication-connect-bot-to-custom-application)
- [Microsoft Bot Framework Web Chat](https://github.com/microsoft/BotFramework-WebChat)
