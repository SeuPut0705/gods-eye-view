# Korean (`ko`)

Catalog: `src/i18n/locales/ko.json`. General rules: [TRANSLATORS.md](../TRANSLATORS.md).

## Style

- Standard Korean. Buttons, chips and menu items are short noun forms or plain verbs: 「재시도」, 「저장」, 「닫기」, 「키 저장」. Full sentences (hints, errors, notices) avoid 해요체: use 「-합니다/-습니다」 for statements and 「-하세요」 for instructions: 「지도를 클릭하세요.」, 「키가 저장되었습니다.」.
- Korean has no case: an UPPERCASE English HUD label becomes the same short Korean label. Keep labels as short as the English: 「실시간」, 「지연」, 「끔」.
- Half-width punctuation as in English. Keep `·` as the HUD separator, `—` and `…` as written.
- Korean counters attach to the number without a space: 「{count}개」, 「5분 전」. Units keep a space: 「24 km」.
- Placeholders keep their names; move them to where Korean grammar puts them: `"{accepted} of {raw} records accepted"` → `"레코드 {raw}개 중 {accepted}개 수락"`. A particle after a placeholder uses the dual form, since the value's final consonant is unknown: 「{name}이(가)」, 「{layer}을(를)」, 「{name}은(는)」.
- Units: km, m, km/h, m/s, kn, ft, MW, °, % stay as written. Time words follow the number: 시간, 분, 초 (「5분 전」, 「24시간」).
- Product names, provider names and codes stay as they are: Google, Cesium, CelesTrak, NOAA, FIRMS, AIS, ADS-B, GNSS, CCTV, HUD, CRT, NVG, FLIR, WHOT/BHOT, Ironbow, CONUS, OpenAI, ChatGPT, OpenSky, TomTom, OpenStreetMap, Mapillary, and keyboard keys (Space, Esc, H, 1–9).

## Plurals

`Intl.PluralRules('ko')` has one category, `other`: a `tn()` entry has only that form. Use a counter where Korean needs one: 「키 {count}개」, 「항공기 {count}대」, 「선박 {count}척」, 「카메라 {count}대」.

## Glossary

| English                                  | 한국어                         |
| ---------------------------------------- | ------------------------------ |
| layer / data layer                       | 레이어 / 데이터 레이어         |
| feed                                     | 피드                           |
| source / data source                     | 출처 / 데이터 소스             |
| LIVE (status) / live data                | 실시간 / 실시간 데이터         |
| SIMULATED                                | 시뮬레이션                     |
| stale / degraded / unavailable           | 지연 / 저하 / 사용 불가        |
| retry                                    | 재시도                         |
| key (API key) / POWER UP                 | 키(API 키) / 파워 업           |
| Provider Settings                        | 제공자 설정                    |
| globe / map / map source / basemap       | 지구본 / 지도 / 지도 소스 / 기본 지도 |
| aircraft / flight / military flights     | 항공기 / 항공편 / 군용기       |
| vessel, ship                             | 선박                           |
| satellite                                | 위성                           |
| launch (rocket) / space mission          | 발사 / 우주 임무               |
| contact (tracked object)                 | 표적                           |
| installation, site                       | 시설                           |
| camera / CCTV camera                     | 카메라 / CCTV 카메라           |
| earthquake / active fire                 | 지진 / 활성 화재               |
| scene / shot                             | 장면 / 샷                      |
| briefing / panel / dock                  | 브리핑 / 패널 / 독             |
| preset / visual preset                   | 프리셋 / 비주얼 프리셋         |
| Display / HUD layout                     | 디스플레이 / HUD 레이아웃      |
| Tactical / Operator / Minimal / Cyber    | 전술 / 오퍼레이터 / 미니멀 / 사이버 |
| Scope (circular viewport mask)           | 스코프                         |
| Clean UI                                 | 클린 UI                        |
| cockpit                                  | 조종석                         |
| heading / altitude / ground speed        | 방위 / 고도 / 대지 속도        |
| map heading / North up                   | 지도 방향 / 북쪽 위            |
| Street Level / Street View (Google)      | 거리 수준 / 스트리트 뷰(Google) |
| Recent Imagery                           | 최근 영상                      |
| Global Context / Context (panel)         | 글로벌 상황 / 상황             |
| radio (station)                          | 라디오                         |
| transit / bikeshare                      | 대중교통 / 공유 자전거         |
| Previous / Next                          | 이전 / 다음                    |
| compass points (N, NNE, …)               | 북, 북북동, …                  |
| weather field / FIELD (selector)         | 기상 요소 / 요소               |
| weather model / forecast lead hours      | 모델 / 예보 시간               |
| valid (forecast time)                    | 유효 시각                      |
| pin (Recent Imagery)                     | 고정                           |
| THIS (voice pointer)                     | 이것                           |
| outline / trace an outline               | 윤곽 / 윤곽 그리기             |
| mark (map annotation)                    | 마크                           |
| provider                                 | 제공자                         |
| share (a view or link)                   | 공유                           |
| AI agent                                 | AI 에이전트                    |
| stage (rocket) / downrange               | 단 / 하향 거리                 |
| capture shot / camera move               | 샷 캡처 / 카메라 무브          |
| camera pose                              | 카메라 자세                    |
| frame (bring into view)                  | 화면에 담기                    |
