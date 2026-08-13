// 자동 검증 스크립트 — 원본에는 포함되지 않고 테스트 사본에만 주입됩니다.
// 대상: 직무AI_대시보드.html (인사노무 법령 브리핑)
(async function () {
  "use strict";
  var log = [];
  function ok(name, cond) { log.push({ name: name, pass: !!cond }); }

  // ---------- 비동기 대기 ----------
  // 데이터가 Supabase 에서 오므로, 화면이 그려진 뒤에 검사해야 한다.
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  async function waitFor(fn, ms) {
    var until = Date.now() + (ms || 20000);
    while (Date.now() < until) { if (fn()) return true; await sleep(60); }
    return false;
  }

  // publishable 키는 코드에 둬도 되는 값이다(RLS 가 실제 차단을 맡는다).
  // 비밀번호는 넣지 않고 실행 시 주입받는다 — 이 파일은 저장소에 있다.
  var SB_URL = "https://qplxvfwuobvnobqpivbm.supabase.co";
  var SB_KEY = "sb_publishable_zuCioXoqOBTJM06bz9VC3w_qtfXJEjm";
  var creds = window.__TEST_CREDS || {};

  function sess() {
    try { return JSON.parse(sessionStorage.getItem("labor-dashboard-session")); }
    catch (e) { return null; }
  }
  async function anonRows(table) {
    try {
      var r = await fetch(SB_URL + "/rest/v1/" + table + "?select=id&limit=5",
        { headers: { apikey: SB_KEY } });
      return await r.json();
    } catch (e) { return null; }
  }
  async function myRows(path) {
    var s = sess();
    if (!s) return null;
    try {
      var r = await fetch(SB_URL + "/rest/v1/" + path,
        { headers: { apikey: SB_KEY, Authorization: "Bearer " + s.access_token } });
      return await r.json();
    } catch (e) { return null; }
  }

  // ---------- 로그인 게이트 ----------
  // 읽기에도 로그인이 필요하다 (PRD 6항). 화면을 가리는 것과 데이터가 막히는 것은 다르다.
  ok("로그인 전 앱이 가려짐",
    document.body.classList.contains("locked") &&
    document.getElementById("authGate").hidden === false &&
    document.querySelectorAll("#cards .item").length === 0);
  ok("가입 기능을 두지 않음",
    !/회원가입|가입하기|sign ?up/i.test(document.getElementById("authGate").textContent));

  var anonItems = await anonRows("labor_items");
  ok("비로그인 직접 호출이 0건 (RLS)", Array.isArray(anonItems) && anonItems.length === 0);
  var anonNotes = await anonRows("labor_notes");
  ok("비로그인 노트 조회도 0건", Array.isArray(anonNotes) && anonNotes.length === 0);

  var authForm = document.getElementById("authForm");
  function submitAuth(email, pw) {
    document.getElementById("authEmail").value = email || "";
    document.getElementById("authPw").value = pw || "";
    authForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }

  submitAuth(creds.email, "wrong-" + (creds.pw || "x"));
  await waitFor(function () {
    return document.documentElement.getAttribute("data-loaded") === "denied";
  });
  ok("틀린 비밀번호 거부",
    document.getElementById("authHint").className.indexOf("err") !== -1 &&
    document.body.classList.contains("locked") &&
    document.querySelectorAll("#cards .item").length === 0);

  submitAuth(creds.email, creds.pw);
  var entered = await waitFor(function () {
    return document.documentElement.getAttribute("data-loaded") === "1";
  }, 25000);
  ok("로그인 성공 후 앱 진입",
    entered && !document.body.classList.contains("locked") &&
    document.getElementById("authGate").hidden === true);
  ok("세션은 sessionStorage 에만 (공용 PC 고려)",
    !!sessionStorage.getItem("labor-dashboard-session") &&
    !localStorage.getItem("labor-dashboard-session"));
  ok("비밀번호를 입력창에 남기지 않음", document.getElementById("authPw").value === "");
  ok("계정·역할 표시", /담당자/.test(document.getElementById("whoPill").textContent));

  // 이전 실행이 남긴 노트를 지운다. 남아 있으면 이후 개수 검증이 전부 어긋난다.
  var guard = 0;
  while (document.querySelector("#noteList .ndel") && guard++ < 20) {
    var before0 = document.querySelectorAll("#noteList .note").length;
    document.querySelector("#noteList .ndel").click();
    await waitFor(function () {
      return document.querySelectorAll("#noteList .note").length < before0;
    }, 10000);
  }

  // 색은 카드 전체를 채우지 않고 상단 4px 룰로만 나타난다 (제니미감 추출 파스텔)
  var KIND = [
    ["law",    "rgb(74, 77, 70)"],      // #4A4D46 딥 세이지
    ["notice", "rgb(214, 173, 163)"],   // #D6ADA3 로즈 토프
    ["prec",   "rgb(232, 192, 184)"],   // #E8C0B8 더스티 블러시
    ["interp", "rgb(169, 174, 162)"]    // #A9AEA2 라이트 세이지
  ];

  // ---------- 태스크 1: 화면 골격 ----------
  var cards = document.querySelectorAll("#cards .fcard");
  ok("2×2 카드 4개 렌더링", cards.length === 4);

  // 섹션 구분은 헤더 띠의 색이 맡는다
  var headOk = KIND.every(function (k) {
    var h = document.querySelector('#cards .fcard[data-kind="' + k[0] + '"] .fhead');
    return h && getComputedStyle(h).backgroundColor === k[1];
  });
  ok("카드 헤더 띠 4색 (딥세이지·로즈토프·블러시·라이트세이지)", headOk);

  var allDiff = KIND.map(function (k) { return k[1]; })
    .filter(function (v, i, a) { return a.indexOf(v) === i; }).length === 4;
  ok("네 카드 헤더 색이 모두 다름", allDiff);

  // 헤더 띠가 카드 폭을 채우는지 (구분이 눈에 걸리려면 면이 있어야 한다)
  var hd = document.querySelector('#cards .fcard[data-kind="law"] .fhead');
  var cardEl = document.querySelector('#cards .fcard[data-kind="law"]');
  ok("헤더 띠가 카드 폭을 채움",
    hd.getBoundingClientRect().width >= cardEl.getBoundingClientRect().width - 3);

  // 헤더 글자 대비 — law 은 어두운 띠라 흰 글자, 나머지는 ink
  ok("헤더 글자색이 띠 밝기에 맞게 뒤집힘",
    getComputedStyle(document.querySelector('#cards .fcard[data-kind="law"] .fhead h2')).color
      === "rgb(255, 252, 250)" &&
    getComputedStyle(document.querySelector('#cards .fcard[data-kind="prec"] .fhead h2')).color
      === "rgb(36, 31, 29)");

  // 카드 지면은 네 카드 모두 같은 흰색 — 본문 대비 조건이 같아야 읽기 편하다
  var paper = KIND.map(function (k) {
    return getComputedStyle(
      document.querySelector('#cards .fcard[data-kind="' + k[0] + '"]')).backgroundColor;
  });
  ok("카드 지면이 네 곳 모두 동일한 흰 지면",
    paper.every(function (v) { return v === paper[0]; }) &&
    paper[0] === "rgb(255, 252, 250)");
  ok("카드 지면이 페이지 바닥보다 밝음",
    paper[0] !== getComputedStyle(document.body).backgroundColor);

  // brand-pink(#ff4d8b = rgb(255,77,139))는 흰 글씨 대비가 3.1:1 로 본문 미달 → 실제로 칠해지지 않아야 한다.
  // 문자열 검색은 "쓰지 않는다"고 적은 주석에도 걸리므로 계산된 스타일로 확인한다.
  var PINK = "rgb(255, 77, 139)";
  var pinkUsed = Array.prototype.some.call(document.querySelectorAll("*"), function (n) {
    var s = getComputedStyle(n);
    return s.backgroundColor === PINK || s.color === PINK || s.borderTopColor === PINK;
  });
  ok("brand-pink 미사용 (실제 렌더링 기준)", !pinkUsed);

  var grid = getComputedStyle(document.getElementById("cards")).gridTemplateColumns;
  ok("2단 그리드", grid.split(" ").length === 2);

  // ---------- 핵심 요구: 접속만으로 내용이 보인다 ----------
  var items = document.querySelectorAll("#cards .item");
  ok("항목 12건 렌더링", items.length === 12);

  var sums = document.querySelectorAll("#cards .isum");
  ok("모든 항목에 요지 노출", sums.length === 12);

  var sumFilled = Array.prototype.every.call(sums, function (p) {
    return p.textContent.trim().length >= 20;
  });
  ok("요지가 실제 내용을 담고 있음 (20자 이상)", sumFilled);

  var sumVisible = Array.prototype.every.call(sums, function (p) {
    return p.offsetHeight > 0 && getComputedStyle(p).display !== "none";
  });
  ok("요지가 클릭 없이 화면에 보임", sumVisible);

  // 요지는 문장형이어야 한다 (수치 타일이 아니라)
  var points = document.querySelectorAll("#cards .ipoint");
  ok("모든 항목에 결론 문장", points.length === 12);
  ok("결론이 클릭 없이 보임", Array.prototype.every.call(points, function (p) {
    return p.offsetHeight > 0;
  }));
  ok("결론이 문장으로 끝남", Array.prototype.every.call(points, function (p) {
    return /[.다]$/.test(p.textContent.trim());
  }));
  ok("수치 타일을 쓰지 않음", document.querySelectorAll("#cards .figv").length === 0);

  // 수치는 문장 안에 들어 있어야 한다
  var wageItem = Array.prototype.filter.call(document.querySelectorAll("#cards .item"),
    function (li) { return /최저임금 고시/.test(li.textContent); })[0];
  ok("최저임금 결론 문장에 금액 포함",
    !!wageItem && /\d{1,3}(,\d{3})+원/.test(wageItem.querySelector(".ipoint").textContent));

  ok("모든 항목에 제목", document.querySelectorAll("#cards .ititle").length === 12);

  var links = document.querySelectorAll("#cards .imeta a.chip");
  ok("모든 항목에 원문 링크", links.length === 12);

  // 자세히·원문은 카드 섹션 색을 옅게 깐 박스여야 한다
  ok("자세히·원문이 박스 처리됨", Array.prototype.every.call(
    document.querySelectorAll("#cards .chip"), function (c) {
      var s = getComputedStyle(c);
      return s.backgroundColor !== "rgba(0, 0, 0, 0)" &&
             parseFloat(s.borderTopWidth) >= 1 &&
             parseFloat(s.borderRadius) >= 4;
    }));
  ok("박스 색이 카드 섹션 색을 따라감", (function () {
    var seen = {};
    KIND.forEach(function (k) {
      var c = document.querySelector('#cards .fcard[data-kind="' + k[0] + '"] .chip');
      if (c) seen[getComputedStyle(c).backgroundColor] = 1;
    });
    return Object.keys(seen).length === 4;
  })());

  // 홈페이지가 아니라 해당 문서로 가야 한다
  // admRulSc 는 menuId 를 붙이면 결과가 비므로 menuId 없이 쓴다 (실측).
  // 확인된 항목은 검색이 아니라 상세 페이지로 바로 간다.
  var deep = Array.prototype.every.call(links, function (a) {
    return /law\.go\.kr\/(lsSc|admRulSc|precSc|expcSc)\.do\?(menuId=\d+&)?query=.+/.test(a.href) ||
           /law\.go\.kr\/admRulLsInfoP\.do\?admRulSeq=\d+/.test(a.href);
  });
  ok("링크가 홈페이지가 아니라 해당 문서로 연결", deep);

  // 판례는 사건번호로 검색해야 그 판례 하나로 떨어진다
  var precLinks = document.querySelectorAll('#cards .fcard[data-kind="prec"] a.chip');
  ok("판례 링크가 사건번호로 검색", Array.prototype.every.call(precLinks, function (a) {
    return /query=\d{4}(%EB%8B%A4|%EB%91%90|%EB%82%98|다|두|나)\d+/.test(a.getAttribute("href"));
  }));
  ok("판례 사건번호가 자리표시자가 아님", Array.prototype.every.call(
    document.querySelectorAll('#cards .fcard[data-kind="prec"] .iref'), function (r) {
      return !/0{3,}/.test(r.textContent);
    }));

  // glaw.scourt.go.kr 은 DNS 가 해소되지 않는다 (2026-08-13 확인)
  var dead = Array.prototype.some.call(links, function (a) {
    return a.href.indexOf("scourt.go.kr") !== -1;
  });
  ok("죽은 도메인(scourt.go.kr) 미사용", !dead);

  // 종류별로 맞는 검색 경로를 쓰는지
  var pathOk = KIND.every(function (k) {
    var a = document.querySelector('#cards .fcard[data-kind="' + k[0] + '"] .imeta a.chip');
    var want = { law: "lsSc", notice: "admRulSc", prec: "precSc", interp: "expcSc" }[k[0]];
    return a && a.href.indexOf("/" + want + ".do") !== -1;
  });
  ok("종류별 검색 경로 매칭 (법령·고시·판례·해석)", pathOk);

  // ---------- 자세히 펼치기 (페이지 안에서 상세 확인) ----------
  var firstItem = items[0];
  var more = firstItem.querySelector("button.chip");
  var detail = firstItem.querySelector(".idetail");
  ok("상세 블록 존재", !!detail && detail.hidden === true);

  if (more) {
    more.click();
    ok("자세히 → 상세 펼침", detail && detail.hidden === false &&
       more.textContent.trim() === "접기" && more.getAttribute("aria-expanded") === "true");
    more.click();
    ok("접기 → 상세 숨김", detail && detail.hidden === true &&
       more.textContent.trim() === "자세히");
  } else {
    ok("자세히 → 상세 펼침", false);
    ok("접기 → 상세 숨김", false);
  }

  var detailCount = document.querySelectorAll("#cards .idetail dt").length;
  ok("상세에 원문 필드 라벨 존재", detailCount >= 12);

  // 주요내용·부칙 등 원문 블록도 채워진 박스여야 한다
  ok("원문 블록이 채워진 박스", (function () {
    var d = document.querySelector("#cards .idetail");
    var s = getComputedStyle(d);
    return s.backgroundColor !== "rgba(0, 0, 0, 0)" &&
           parseFloat(s.borderTopWidth) >= 1 &&
           parseFloat(s.borderRadius) >= 4;
  })());

  // ---------- 메타 ----------
  ok("시행일 D-day 표시", /시행 D-\d+|오늘 시행|시행 \d{4}-/.test(
    document.querySelector("#cards .imeta").textContent));

  var newBadges = document.querySelectorAll("#cards .new").length;
  var pillText = document.getElementById("newPill").textContent;
  ok("새 항목 수와 NEW 배지 일치", pillText === "새 항목 " + newBadges + "건");

  ok("카드별 건수 표시", Array.prototype.every.call(
    document.querySelectorAll("#cards .fcount"), function (s) { return /\d+건/.test(s.textContent); }));

  // ---------- 상단 ----------
  ok("제목에 날짜를 넣지 않음 (날짜 이동에 있으므로)",
    document.getElementById("hero").textContent.trim() === "노동법 이슈 확인");
  ok("마지막 수집 시각 자리 존재", !!document.getElementById("lastRun"));

  // ---------- 위계 (가독성) ----------
  var pt = document.querySelector("#cards .ipoint");
  var lawCard = document.querySelector('#cards .fcard[data-kind="law"]');
  var ptSize = parseFloat(getComputedStyle(pt).fontSize);
  var sumSize = parseFloat(getComputedStyle(document.querySelector("#cards .isum")).fontSize);
  var titleSize = parseFloat(getComputedStyle(document.querySelector("#cards .ititle")).fontSize);
  var headSize = parseFloat(getComputedStyle(document.querySelector("#cards .fhead h2")).fontSize);

  // 결론 문장이 카드 제목·항목명·배경문장보다 크다 = 내용이 주인공
  ok("결론 문장이 가장 큰 글자", ptSize > sumSize && ptSize > titleSize && ptSize > headSize);
  ok("결론 문장이 굵고 ink 색", parseInt(getComputedStyle(pt).fontWeight, 10) >= 600);
  // 박스 안 박스를 없앴다
  var ptBg = getComputedStyle(pt).backgroundColor;
  ok("결론 문장에 박스를 두르지 않음",
    (ptBg === "rgba(0, 0, 0, 0)" || ptBg === "transparent") &&
    parseFloat(getComputedStyle(pt).borderLeftWidth) === 0);
  // 카드 제목은 띠 안의 라벨이다 — 본문보다 작게 유지
  ok("카드 제목이 결론 문장보다 작음", headSize < ptSize &&
    getComputedStyle(document.querySelector("#cards .fhead h2")).textTransform === "uppercase");

  var hls = document.querySelectorAll("#cards .ipoint .hl");
  ok("수치 강조 적용", hls.length >= 4);
  // 판 안에 또 박스·밑줄을 두지 않는다 — 굵게만
  ok("수치 강조는 굵게만 (박스·밑줄 없음)", Array.prototype.every.call(hls, function (h) {
    var s = getComputedStyle(h);
    return parseInt(s.fontWeight, 10) >= 700 &&
           s.textDecorationLine === "none" &&
           (s.backgroundColor === "rgba(0, 0, 0, 0)" || s.backgroundColor === "transparent");
  }));
  // 액센트는 항목 태그·링크에 쓰인다. 카드마다 달라야 한다
  ok("액센트 색이 네 카드 모두 다름", (function () {
    var seen = {};
    KIND.forEach(function (k) {
      var t = document.querySelector('#cards .fcard[data-kind="' + k[0] + '"] .tag');
      if (t) seen[getComputedStyle(t).color] = 1;
    });
    return Object.keys(seen).length === 4;
  })());
  ok("강조된 부분에 금액·비율이 들어감", Array.prototype.some.call(hls, function (h) {
    return /원|%/.test(h.textContent);
  }));

  // ---------- 카드별 접기 ----------
  var folds = document.querySelectorAll(".foldbtn");
  ok("접기 버튼 6개 (법령 4 + HR + 노트)", folds.length === 6);

  var lawFold = lawCard.querySelector(".foldbtn");
  ok("처음엔 펼쳐진 상태", lawFold.getAttribute("aria-expanded") === "true" &&
    lawCard.querySelector(".items").offsetHeight > 0);

  lawFold.click();
  ok("법령 카드 접힘", lawCard.classList.contains("collapsed") &&
    lawCard.querySelector(".items").offsetHeight === 0 &&
    lawFold.getAttribute("aria-expanded") === "false");
  ok("접어도 건수는 보임", lawCard.querySelector(".fcount").offsetHeight > 0);
  ok("다른 카드는 그대로", document.querySelector('#cards .fcard[data-kind="prec"]')
    .querySelector(".items").offsetHeight > 0);

  // 접힌 상태가 다시 그려도 유지되는지
  document.getElementById("prevDay").click();
  document.getElementById("todayBtn").click();
  ok("다시 그려도 접힘 유지", lawCard.classList.contains("collapsed"));

  lawFold.click();
  ok("법령 카드 다시 펼침", !lawCard.classList.contains("collapsed") &&
    lawCard.querySelector(".items").offsetHeight > 0);

  // 노트 카드 접기 → 입력창까지 숨는지
  var noteCardEl = document.getElementById("noteCard");
  noteCardEl.querySelector(".foldbtn").click();
  ok("노트 카드 접으면 입력창도 숨김",
    document.getElementById("noteForm").offsetHeight === 0);
  noteCardEl.querySelector(".foldbtn").click();

  // ---------- 지면 구조 ----------
  // 밴드는 브라운, 가운데 내용 영역은 밝은 바닥 (위아래를 어둡게 묶는 구조)
  var ground = "rgb(237, 228, 221)";
  ok("가운데 내용 영역 바닥색",
    getComputedStyle(document.body).backgroundColor === ground);
  ok("밴드가 바닥보다 어두움",
    getComputedStyle(document.querySelector(".band")).backgroundColor !== ground);
  // 노트 카드는 흰 지면, HR 이슈는 색 판 (요청에 따라 의도적으로 다르다)
  ok("노트 카드는 흰 지면",
    getComputedStyle(document.getElementById("noteCard")).backgroundColor === "rgb(255, 252, 250)");
  ok("HR·노트 카드도 헤더 띠로 구분됨", (function () {
    var a = getComputedStyle(document.querySelector("#hrCard .fhead")).backgroundColor;
    var b = getComputedStyle(document.querySelector("#noteCard .fhead")).backgroundColor;
    return a !== ground && b !== ground && a !== b;
  })());

  // ---------- 산업별 HR 이슈 ----------
  var hrCard = document.getElementById("hrCard");
  ok("HR 이슈 카드 존재", !!hrCard);
  ok("AI 요약 라벨 표시", document.querySelectorAll("#hrList .aitag").length > 0);
  ok("HR 항목에 산업군 배지", document.querySelectorAll("#hrList .ind").length > 0);
  // 산업군마다 배지 색이 달라야 구분이 쉽다.
  // '전체' 탭이 없으므로 탭을 돌면서 색을 모은 뒤 금융으로 되돌린다.
  ok("산업군 배지가 색으로 구분됨", (function () {
    var colors = {};
    ["금융", "제조", "IT", "유통"].forEach(function (name) {
      var t = document.querySelector('#tabs .tab[data-ind="' + name + '"]');
      if (!t) return;
      t.click();
      var b = document.querySelector('#hrList .ind[data-ind="' + name + '"]');
      if (b) colors[getComputedStyle(b).color] = 1;
    });
    document.querySelector('#tabs .tab[data-ind="금융"]').click();
    return Object.keys(colors).length === 4;
  })());
  ok("HR 항목에 기사 링크", document.querySelectorAll("#hrList a.chip").length ===
    document.querySelectorAll("#hrList .item").length);

  var tabs = document.querySelectorAll("#tabs .tab");
  ok("산업군 탭 4개 ('전체' 없음)", tabs.length === 4 &&
    !document.querySelector('#tabs .tab[data-ind="전체"]'));
  ok("산업군 탭이 HR 카드 안에 있음", hrCard.contains(tabs[0]));
  ok("기본 선택은 금융",
    document.querySelector('#tabs .tab[data-ind="금융"]').getAttribute("aria-pressed") === "true");

  var allHr = document.querySelectorAll("#hrList .item").length;
  ok("금융 이슈 4건 표시 (2~4건 범위)", allHr >= 2 && allHr <= 4);
  ok("금융 목록이 모두 금융 태그", Array.prototype.every.call(
    document.querySelectorAll("#hrList .item"), function (li) {
      return /금융/.test(li.querySelector(".inds").textContent);
    }));

  // 우선순위: 증권 직접 > 금융 계열 > 금융 전반, 리스크 높은 순
  var firstHr = document.querySelector("#hrList .item");
  ok("증권 직접 이슈가 최상단",
    /증권 직접/.test(firstHr.querySelector(".inds").textContent));
  ok("정렬 근거 배지 노출", document.querySelectorAll("#hrList .why").length > 0);
  ok("리스크 높음 배지 노출",
    /리스크 높음/.test(document.getElementById("hrList").textContent));

  // HR 이슈는 흰 지면이 아니라 색 판 + 항목별 테두리 박스
  var hrBg = getComputedStyle(hrCard).backgroundColor;
  ok("HR 카드가 흰 지면이 아닌 색 판", hrBg !== "rgb(255, 252, 250)");
  ok("HR 항목이 테두리 박스", Array.prototype.every.call(
    document.querySelectorAll("#hrList .item"), function (li) {
      var s = getComputedStyle(li);
      return parseFloat(s.borderTopWidth) >= 1 &&
             parseFloat(s.borderRadius) >= 4 &&
             s.backgroundColor !== hrBg &&
             s.backgroundColor !== "rgba(0, 0, 0, 0)";
    }));

  // NEW 는 노란 박스
  var newBadge = document.querySelector(".new");
  ok("NEW 가 노란 박스", !!newBadge &&
    getComputedStyle(newBadge).backgroundColor === "rgb(245, 196, 69)" &&
    parseInt(getComputedStyle(newBadge).fontWeight, 10) >= 700);

  // 제조 필터
  document.querySelector('#tabs .tab[data-ind="제조"]').click();
  var mfg = document.querySelectorAll("#hrList .item");
  ok("제조 필터 적용", mfg.length > 0);
  ok("제조 결과가 모두 제조 태그", Array.prototype.every.call(mfg, function (li) {
    return /제조/.test(li.querySelector(".inds").textContent);
  }));
  ok("제조 탭 선택 · 금융 탭 해제",
    document.querySelector('#tabs .tab[data-ind="제조"]').getAttribute("aria-pressed") === "true" &&
    document.querySelector('#tabs .tab[data-ind="금융"]').getAttribute("aria-pressed") === "false");

  // 유통 필터
  document.querySelector('#tabs .tab[data-ind="유통"]').click();
  ok("유통 결과가 모두 유통 태그",
    Array.prototype.every.call(document.querySelectorAll("#hrList .item"), function (li) {
      return /유통/.test(li.querySelector(".inds").textContent);
    }));

  // 금융 복귀
  document.querySelector('#tabs .tab[data-ind="금융"]').click();
  ok("금융 복귀", document.querySelectorAll("#hrList .item").length === allHr);

  // ---------- 날짜 이동 ----------
  var navDate = document.getElementById("navDate");
  var pastPill = document.getElementById("pastPill");
  var nextBtn = document.getElementById("nextDay");
  var todayBtn = document.getElementById("todayBtn");

  ok("날짜 표시 형식", /^\d{4}-\d{2}-\d{2} \([일월화수목금토]\)$/.test(navDate.textContent.trim()));
  // 오늘자를 볼 때는 '지난 기록 보는 중' 이 실제로 감춰져야 한다
  // ([hidden] 이 .pill 의 display 에 덮이던 버그)
  ok("오늘자: 지난 기록 표시등 숨김", pastPill.offsetHeight === 0);
  ok("오늘자: 다음 날·오늘로 버튼 비활성", nextBtn.disabled === true && todayBtn.disabled === true);

  document.getElementById("prevDay").click();
  ok("어제로 이동", navDate.textContent.trim() !== "" && nextBtn.disabled === false);
  ok("어제: 지난 기록 표시등 노출", pastPill.offsetHeight > 0);

  var beforeCount = document.querySelectorAll("#cards .item").length;
  todayBtn.click();
  ok("오늘로 복귀", nextBtn.disabled === true && pastPill.offsetHeight === 0);
  ok("복귀 후 항목 수 회복", document.querySelectorAll("#cards .item").length >= beforeCount);

  // ---------- 전체 펼치기 ----------
  var expandBtn = document.getElementById("expandBtn");
  expandBtn.click();
  var openAll = document.querySelectorAll("#cards .item.open").length;
  var withDetail = document.querySelectorAll("#cards .idetail").length;
  ok("전체 펼치기 → 상세 전부 열림", openAll === withDetail && withDetail > 0);
  ok("전체 펼치기 라벨 갱신", expandBtn.textContent.trim() === "전체 접기" &&
    expandBtn.getAttribute("aria-pressed") === "true");
  expandBtn.click();
  ok("전체 접기 → 상세 전부 닫힘", document.querySelectorAll("#cards .item.open").length === 0);

  // ---------- 반짝임 (CSS 만으로) ----------
  var bandBefore = getComputedStyle(document.querySelector(".band"), "::before");
  ok("상단 밴드 반짝임 레이어 존재", bandBefore.backgroundImage.indexOf("radial-gradient") !== -1);

  // ---------- 상단·하단 브라운 밴드 + 메시 그라데이션 ----------
  var bandEl = document.querySelector(".band");
  var footEl = document.querySelector(".foot");
  var brown = "rgb(34, 27, 22)";
  ok("상단·하단 밴드가 같은 브라운",
    getComputedStyle(bandEl).backgroundColor === brown &&
    getComputedStyle(footEl).backgroundColor === brown);
  ok("밴드에 메시 그라데이션 4겹",
    (getComputedStyle(bandEl).backgroundImage.match(/radial-gradient/g) || []).length === 4);
  ok("푸터에도 메시 그라데이션",
    (getComputedStyle(footEl).backgroundImage.match(/radial-gradient/g) || []).length === 4);
  ok("밴드 글자가 밝은 톤",
    getComputedStyle(document.getElementById("hero")).color === "rgb(247, 233, 225)");
  ok("라틴 이탤릭 키커 존재", (function () {
    var k = document.querySelector(".kicker");
    if (!k) return false;
    var s = getComputedStyle(k);
    return s.fontStyle === "italic" && s.textTransform === "uppercase" &&
           /[A-Za-z]/.test(k.textContent) && !/[가-힣]/.test(k.textContent);
  })());
  // 한글 제목에는 이탤릭을 걸지 않는다 (강제 기울임은 조판이 무너진다)
  ok("한글 제목은 정체 유지",
    getComputedStyle(document.getElementById("hero")).fontStyle === "normal");

  // ---------- 식별번호 ----------
  // 확인한 것만 넣는다. 미확인 슬롯은 비워 둔다 (지어낸 번호는 실제 인용처럼 보인다)
  var refs = document.querySelectorAll("#cards .iref");
  ok("확인된 식별번호만 표시 (7건)", refs.length === 7);
  ok("자리표시자 번호가 남아 있지 않음", Array.prototype.every.call(refs, function (r) {
    return !/0{3,}/.test(r.textContent);
  }));
  ok("법령은 조문 번호",
    /제\d+조/.test(document.querySelector('#cards .fcard[data-kind="law"] .iref').textContent));
  ok("고시는 실제 고시 번호",
    /고시 제2025-47호/.test(document.querySelector('#cards .fcard[data-kind="notice"] .iref').textContent));
  ok("판례는 사건번호",
    /^\d{4}[가-힣]\d+$/.test(document.querySelector('#cards .fcard[data-kind="prec"] .iref').textContent.trim()));
  ok("판례 3건 모두 사건번호 보유",
    document.querySelectorAll('#cards .fcard[data-kind="prec"] .iref').length === 3);
  // 확인된 항목은 검색이 아니라 원문 상세로 직접 연결된다.
  // 목록은 날짜 내림차순이므로 실제 고시일(2025-08-05)인 최저임금 항목은 맨 아래에 온다.
  var wageNotice = Array.prototype.filter.call(
    document.querySelectorAll('#cards .fcard[data-kind="notice"] .item'),
    function (li) { return /최저임금 고시/.test(li.textContent); })[0];
  ok("최저임금 고시 항목 존재", !!wageNotice);
  ok("최저임금 고시는 상세 링크로 직접 연결",
    !!wageNotice && /admRulLsInfoP\.do\?admRulSeq=\d+/.test(
      wageNotice.querySelector("a.chip").getAttribute("href")));
  ok("최저임금 고시에 실제 고시번호",
    !!wageNotice && /고용노동부 고시 제2025-47호/.test(wageNotice.querySelector(".iref").textContent));

  // ---------- 세부내용은 볼드하지 않는다 ----------
  ok("배경 문장·세부내용의 수치는 볼드 아님", (function () {
    var a = document.querySelector("#cards .isum .hl");
    if (a && parseInt(getComputedStyle(a).fontWeight, 10) >= 700) return false;
    var b = document.querySelector("#cards .idetail dd");
    return !b || parseInt(getComputedStyle(b).fontWeight, 10) < 700;
  })());

  // ---------- 법률 정보로서의 안전장치 ----------
  ok("예시 데이터 경고 노출", !!document.getElementById("sampleBar") &&
    document.getElementById("sampleBar").offsetHeight > 0);
  ok("법률 자문 아님 문구 노출",
    document.body.textContent.indexOf("법률 자문이 아닙니다") !== -1);

  // ---------- 담당자 노트 (예시 없음) ----------
  ok("예시 노트를 두지 않음", document.querySelectorAll("#noteList .note").length === 0 &&
    document.querySelectorAll("#noteList .nsample").length === 0);
  ok("빈 상태 안내 표시", !!document.querySelector("#noteList .empty"));

  // ---------- 담당자 노트 (Supabase 저장) ----------
  var noteForm = document.getElementById("noteForm");
  var noteBy = document.getElementById("noteBy");
  var noteText = document.getElementById("noteText");

  ok("노트 입력창 존재", !!noteForm && !!noteBy && !!noteText);
  ok("담당자에게는 작성 폼이 열림",
    noteForm.hidden === false && document.getElementById("noteReadonly").hidden === true);
  ok("작성자 이름이 계정으로 채워짐", noteBy.value.length > 0);

  // 빈 내용은 저장되지 않는다 (서버로 요청도 나가지 않아야 한다)
  noteText.value = "   ";
  noteForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await sleep(150);
  ok("빈 노트 저장 거부", document.getElementById("noteHint").className.indexOf("err") !== -1 &&
    document.querySelectorAll("#noteList .note").length === 0);

  // 실제 저장
  noteBy.value = "정원 (인사노무)";
  noteText.value = "통상임금 판례 관련 급여 재산정 범위 확인 필요. 8/18 회의 안건으로 올립니다.";
  noteForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await waitFor(function () {
    return document.querySelectorAll("#noteList .note").length === 1;
  }, 15000);

  var notes = document.querySelectorAll("#noteList .note");
  ok("노트 저장 1건", notes.length === 1);
  ok("저장한 내용이 목록에 표시",
    /통상임금 판례 관련 급여 재산정/.test(document.querySelector("#noteList .ntext").textContent));
  ok("작성자 반영", /정원 \(인사노무\)/.test(document.querySelector("#noteList .nmeta").textContent));
  ok("작성 시각 표시",
    /\d{2}-\d{2} \d{2}:\d{2}/.test(document.querySelector("#noteList .nmeta").textContent));
  ok("저장 후 입력창 비워짐", noteText.value === "");

  // Ctrl + Enter 저장
  noteText.value = "산안법 개정 대응 체크리스트 초안 공유드립니다.";
  noteText.dispatchEvent(new KeyboardEvent("keydown",
    { key: "Enter", ctrlKey: true, bubbles: true, cancelable: true }));
  await waitFor(function () {
    return document.querySelectorAll("#noteList .note").length === 2;
  }, 15000);
  ok("Ctrl+Enter 저장", document.querySelectorAll("#noteList .note").length === 2);

  // 서버에 실제로 남았는지 대조한다.
  // 화면만 갱신되고 끝나면 팀에 전달되지 않는데도 전달된 것처럼 보인다.
  var serverNotes = await myRows("labor_notes?select=id,text,author_name,note_date");
  ok("노트가 Supabase 에 저장됨", Array.isArray(serverNotes) && serverNotes.length === 2);
  ok("작성자명이 서버에 기록됨", Array.isArray(serverNotes) &&
    serverNotes.some(function (n) { return n.author_name === "정원 (인사노무)"; }));
  ok("보고 있는 날짜로 기록됨", Array.isArray(serverNotes) &&
    serverNotes.every(function (n) { return /^\d{4}-\d{2}-\d{2}$/.test(n.note_date); }));
  ok("노트를 localStorage 에 두지 않음",
    !localStorage.getItem("labor-dashboard-notes-local"));

  // 삭제
  document.querySelector("#noteList .ndel").click();
  await waitFor(function () {
    return document.querySelectorAll("#noteList .note").length === 1;
  }, 15000);
  ok("노트 삭제", document.querySelectorAll("#noteList .note").length === 1);
  var afterDel = await myRows("labor_notes?select=id");
  ok("삭제가 서버에도 반영", Array.isArray(afterDel) && afterDel.length === 1);

  // ---------- 폰트 ----------
  ok("Pretendard 우선 폰트 스택",
    /Pretendard Variable/.test(getComputedStyle(document.body).fontFamily));

  // ---------- 테마 ----------
  var btn = document.getElementById("themeBtn");
  var before = document.documentElement.getAttribute("data-theme");
  btn.click();
  var after = document.documentElement.getAttribute("data-theme");
  ok("테마 토글 전환", before !== after && (after === "dark" || after === "light"));
  ok("토글 라벨·aria 갱신",
    btn.textContent.trim() === (after === "dark" ? "라이트 모드" : "다크 모드") &&
    btn.getAttribute("aria-pressed") === (after === "dark" ? "true" : "false"));

  var saved = null;
  try { saved = JSON.parse(localStorage.getItem("labor-dashboard-ui")); } catch (e) {}
  ok("테마 설정 저장", !!saved && saved.theme === after);

  // 헤더 띠 4색은 테마와 무관한 고정값이라 다크에서도 그대로여야 한다
  ok("다크에서 헤더 띠 색 유지", KIND.every(function (k) {
    var h = document.querySelector('#cards .fcard[data-kind="' + k[0] + '"] .fhead');
    return h && getComputedStyle(h).backgroundColor === k[1];
  }));
  // 다크에서 가운데 지면은 어두워지고, 카드가 바닥보다 밝게 떠야 한다.
  // 밴드는 라이트와 동일한 브라운을 유지한다.
  ok("다크에서 지면 전환",
    getComputedStyle(document.body).backgroundColor === "rgb(20, 16, 14)" &&
    getComputedStyle(document.getElementById("noteCard")).backgroundColor === "rgb(33, 26, 23)");
  ok("다크에서도 밴드는 같은 브라운",
    getComputedStyle(document.querySelector(".band")).backgroundColor === "rgb(34, 27, 22)");
  // 다크에서 액센트가 밝은 값으로 뒤집혀 읽히는지
  ok("다크에서 액센트 반전", (function () {
    var t = document.querySelector('#cards .fcard[data-kind="law"] .tag');
    return t && getComputedStyle(t).color === "rgb(174, 181, 167)";
  })());

  btn.click();   // 라이트 복귀
  ok("라이트 복귀", document.documentElement.getAttribute("data-theme") === before);

  // ---------- 수집 상태 · 예시 표시 ----------
  // 아직 수집(태스크 5)이 붙지 않았으므로 "없음"이 정직한 표시다
  ok("마지막 수집 상태 문구",
    /마지막 수집/.test(document.getElementById("lastRun").textContent));
  ok("예시 항목에 예시 배지",
    document.querySelectorAll("#cards .item .nsample").length > 0);
  ok("예시 건수 안내가 배지 수와 일치", (function () {
    var n = document.querySelectorAll("#cards .item .nsample").length;
    return document.getElementById("sampleBar").textContent.indexOf(n + "건") !== -1;
  })());
  ok("실제 확인분에는 예시 배지가 없음", (function () {
    // 판례 3건은 실제 사건번호를 쓴 확인분이다
    return document.querySelectorAll('#cards .fcard[data-kind="prec"] .nsample').length === 0;
  })());

  // ---------- 권한 (팀원 계정) ----------
  // 화면에서 폼을 감추는 것만으로는 칸막이가 되지 않는다. 서버가 거부해야 한다.
  if (creds.memberEmail && creds.memberPw) {
    document.getElementById("outBtn").click();
    await waitFor(function () { return document.body.classList.contains("locked"); }, 15000);
    ok("로그아웃하면 다시 잠김",
      document.body.classList.contains("locked") &&
      !sessionStorage.getItem("labor-dashboard-session") &&
      document.querySelectorAll("#cards .item").length === 0);

    submitAuth(creds.memberEmail, creds.memberPw);
    var memberIn = await waitFor(function () {
      return document.documentElement.getAttribute("data-loaded") === "1";
    }, 25000);
    ok("팀원 계정 로그인",
      memberIn && /팀원/.test(document.getElementById("whoPill").textContent));
    ok("팀원도 브리핑은 읽을 수 있음",
      document.querySelectorAll("#cards .item").length === 12);
    ok("팀원에게는 작성 폼이 닫힘",
      document.getElementById("noteForm").hidden === true &&
      document.getElementById("noteReadonly").hidden === false);
    ok("팀원에게 남의 노트 삭제 버튼이 없음",
      document.querySelectorAll("#noteList .note").length === 1 &&
      document.querySelectorAll("#noteList .ndel").length === 0);

    // 화면을 우회해 직접 써도 서버가 막아야 한다
    var s2 = sess();
    var wr = await fetch(SB_URL + "/rest/v1/labor_notes", {
      method: "POST",
      headers: {
        apikey: SB_KEY, Authorization: "Bearer " + s2.access_token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: "팀원 우회 쓰기 시도", author: s2.user.id,
        note_date: new Date().toISOString().slice(0, 10)
      })
    });
    ok("팀원의 직접 쓰기를 RLS 가 거부 (HTTP " + wr.status + ")",
      wr.status === 401 || wr.status === 403);

    // 남이 쓴 노트는 지울 수 없다
    var target = await myRows("labor_notes?select=id&limit=1");
    if (target && target[0]) {
      await fetch(SB_URL + "/rest/v1/labor_notes?id=eq." + target[0].id, {
        method: "DELETE",
        headers: { apikey: SB_KEY, Authorization: "Bearer " + s2.access_token }
      });
      var still = await myRows("labor_notes?select=id");
      ok("작성자가 아니면 삭제되지 않음", Array.isArray(still) && still.length === 1);
    }
  }

  // ---------- 결과 배너 ----------
  var passed = log.filter(function (x) { return x.pass; }).length;
  var box = document.createElement("div");
  box.style.cssText =
    "margin:18px auto 24px;max-width:1280px;padding:12px 16px;border-radius:12px;font-size:12.5px;" +
    "border:1px solid " + (passed === log.length ? "#0ca30c" : "#d03b3b") + ";" +
    "background:var(--surface-card);color:var(--ink)";
  var h = document.createElement("div");
  h.style.cssText = "font-weight:600;margin-bottom:6px";
  h.textContent = "자동 검증 결과 — " + passed + " / " + log.length + " 통과";
  box.appendChild(h);
  log.forEach(function (x) {
    var r = document.createElement("div");
    r.textContent = (x.pass ? "PASS  " : "FAIL  ") + x.name;
    r.style.color = x.pass ? "var(--muted)" : "#d03b3b";
    box.appendChild(r);
  });
  document.body.appendChild(box);
}());
