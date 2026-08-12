// 자동 검증 스크립트 — 오늘의 건강 대시보드용.
// 원본 HTML에는 포함하지 않고, 테스트 사본에만 주입한다.
//
// 저장은 localStorage 뿐이고 로그인·서버가 없으므로 외부 자격증명이 필요 없다.
// 이전 실행의 localStorage가 남으면 결과가 오염되니 새 브라우저 프로필로 실행할 것.
(function () {
  "use strict";

  var log = [];
  function ok(name, cond) { log.push({ name: name, pass: !!cond }); }
  function submit(form) {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  var el = function (i) { return document.getElementById(i); };
  var q = function (s) { return document.querySelectorAll(s); };
  var txt = function (s) { var e = document.querySelector(s); return e ? e.textContent.trim() : ""; };

  var jsError = "";
  window.addEventListener("error", function (e) { jsError = e.message; });

  Promise.resolve().then(function () {

    // ---------- 0. 로그인 없이 바로 열린다 ----------
    ok("로그인 게이트 없음", !el("authGate") && !el("authCard"));
    ok("로그아웃 버튼 없음", !el("logoutBtn"));
    ok("body 잠금 클래스 없음",
      !document.body.classList.contains("locked") && !document.body.classList.contains("booting"));
    ok("대시보드가 즉시 표시됨", !!el("mealForm") && el("mealForm").offsetParent !== null);
    ok("기본 체크 항목 4종 생성", q("#chkList .chk").length === 4);

    // ---------- 1. 식단 ----------
    [["아침", "그릭요거트 + 바나나"], ["점심", "닭가슴살 샐러드"],
     ["저녁", "현미밥 + 된장국"], ["간식", "아몬드 한 줌"]].forEach(function (p) {
      el("mealSeg").querySelector('.segbtn[data-slot="' + p[0] + '"]').click();
      el("mealText").value = p[1];
      submit(el("mealForm"));
    });
    ok("식단 4건 기록", q("#mealList .meal").length === 4);
    ok("끼니 구분 저장 (첫 행 아침)", txt("#mealList .meal .tag") === "아침");
    q("#mealList .meal")[3].querySelector(".del").click();   // 간식 삭제
    ok("식단 삭제", q("#mealList .meal").length === 3);

    // ---------- 2. 운동 (유산소 / 웨이트) ----------
    el("exSeg").querySelector('.segbtn[data-type="유산소"]').click();
    el("exName").value = "러닝"; el("exMin").value = "30";
    submit(el("exForm"));
    el("exSeg").querySelector('.segbtn[data-type="웨이트"]').click();
    el("exName").value = "벤치프레스"; el("exMin").value = "15";
    submit(el("exForm"));
    ok("운동 2건 기록", q("#exList .ex").length === 2);
    ok("운동 시간 합계", txt("#exTotal") === "45분");

    var tags = q("#exList .ex .tag");
    ok("운동 종류 구분 저장",
      tags.length === 2 && tags[0].textContent.trim() === "유산소" && tags[1].textContent.trim() === "웨이트");
    ok("종류 아이콘 표시", q("#exList .ex .tag .tico").length === 2);
    ok("종류별 합계", txt("#exBreak") === "유산소 30분 · 웨이트 15분");

    el("exName").value = "스트레칭"; el("exMin").value = "0";
    submit(el("exForm"));
    ok("0분 입력 차단", q("#exList .ex").length === 2);

    q("#exList .ex")[1].querySelector(".del").click();   // 웨이트 삭제
    ok("삭제 후 합계 갱신", txt("#exTotal") === "30분" && txt("#exBreak") === "유산소 30분");

    // ---------- 3. 수분 ----------
    for (var i = 0; i < 5; i++) el("waterPlus").click();
    ok("수분 5잔 기록", q("#waterCups .cup.on").length === 5);
    for (var j = 0; j < 8; j++) el("waterMinus").click();
    ok("0잔 미만 방지", q("#waterCups .cup.on").length === 0);
    for (var k = 0; k < 4; k++) el("waterPlus").click();
    ok("수분 4잔 복구", q("#waterCups .cup.on").length === 4);

    // ---------- 4. 수면 ----------
    el("sleepBed").value = "23:00";  fire(el("sleepBed"), "input");
    el("sleepWake").value = "06:00"; fire(el("sleepWake"), "input");
    ok("수면 시간 자동 계산 (자정 넘김)", txt("#sleepText") === "7시간 0분");
    ok("수면 목표 배지", txt("#sleepBadge") === "목표 달성");

    // ---------- 5. 메모 ----------
    ["아침에 붓기 있음.", "저녁 8시 이후 금식 3일째."].forEach(function (t) {
      el("memoText").value = t;
      submit(el("memoForm"));
    });
    ok("메모 2건 저장", q("#memoList .memo").length === 2);
    q("#memoList .memo .del")[0].click();
    ok("메모 삭제", q("#memoList .memo").length === 1);

    // ---------- 6. 체크리스트 ----------
    [0, 1].forEach(function (n) {
      var box = q("#chkList input[type=checkbox]")[n];
      box.checked = true;
      fire(box, "change");
    });
    ok("체크 토글 + 진행률", txt("#ptext") === "2 / 4");
    el("chkText").value = "자기 전 스트레칭 5분";
    submit(el("chkForm"));
    ok("체크 항목 추가", q("#chkList .chk").length === 5);
    q("#chkList .chk")[4].querySelector(".del").click();
    ok("체크 항목 삭제", q("#chkList .chk").length === 4);

    // ---------- 7. 오늘의 점수 ----------
    // 수면 7h(2.5) + 운동 30분(2.5) + 식단 3끼(2.5) + 수분 4/8잔(1.25) = 8.75 → 8.8
    ok("총점 계산", txt("#scoreTotal") === "8.8");
    ok("상단 요약 점수 동기화", txt("#heroScore") === "오늘 8.8점");
    ok("점수 표정 — 상 (8점 이상)", txt("#scoreFace") === "😄");
    ok("항목별 막대 4행", q("#scoreBars .sbar").length === 4);
    ok("부분 점수 환산 (수분 1.3)", txt("#scoreBars .s-water .spt") === "1.3");

    // 점수를 낮춰 표정이 바뀌는지 본 뒤 되돌린다
    for (var w = 0; w < 4; w++) el("waterMinus").click();     // 수분 0잔 → 7.5
    q("#exList .ex .del")[0].click();                          // 운동 0분 → 5.0
    ok("점수 표정 — 중 (5~8점)", txt("#scoreFace") === "😐");
    Array.prototype.forEach.call(q("#mealList .meal"), function (li) {
      li.querySelector(".del").click();
    });
    ok("점수 표정 — 하 (5점 미만)", txt("#scoreFace") === "😢");

    // 원상 복구
    [["아침", "그릭요거트 + 바나나"], ["점심", "닭가슴살 샐러드"], ["저녁", "현미밥 + 된장국"]]
      .forEach(function (p) {
        el("mealSeg").querySelector('.segbtn[data-slot="' + p[0] + '"]').click();
        el("mealText").value = p[1];
        submit(el("mealForm"));
      });
    el("exSeg").querySelector('.segbtn[data-type="유산소"]').click();
    el("exName").value = "러닝"; el("exMin").value = "30";
    submit(el("exForm"));
    for (var w2 = 0; w2 < 4; w2++) el("waterPlus").click();
    ok("복구 후 점수 재계산", txt("#scoreTotal") === "8.8");

    return sleep(400);
  }).then(function () {

    // ---------- 8. 저장 지속성 (v3 · 날짜별) ----------
    var today = new Date();
    var key = today.getFullYear() + "-" +
      String(today.getMonth() + 1).padStart(2, "0") + "-" +
      String(today.getDate()).padStart(2, "0");

    var db = null;
    try { db = JSON.parse(localStorage.getItem("health-dashboard-v3")); } catch (e) {}
    ok("v3 스키마로 저장", !!db && db.version === 3 && !!db.days);
    var d = db && db.days[key];
    ok("오늘 기록이 날짜 칸에 저장",
      !!d && d.meals.length === 3 && d.workouts.length === 1 &&
      d.water === 4 && d.sleep.bed === "23:00");
    ok("운동 종류가 저장에 포함", !!d && d.workouts[0].type === "유산소");
    ok("체크 항목은 날짜와 분리된 템플릿", !!db && db.checkItems.length === 4);
    ok("완료 표시는 날짜별로 보관", !!db && Array.isArray(db.checkMarks[key]) && db.checkMarks[key].length === 2);
    ok("메모는 날짜와 무관하게 보관", !!db && db.memos.length === 1);
    ok("로그인 세션 키를 만들지 않음", !localStorage.getItem("health-dashboard-session"));
    ok("JS 오류 없음", jsError === "");

    // ---------- 9. 누적 기록 : 추이 · 지난 날 조회 ----------
    ok("추이 막대 14개", q("#trendBars .bar").length === 14);
    ok("오늘 막대가 선택 상태", q("#trendBars .bar")[13].classList.contains("on"));
    ok("평균 점수 표시", /평균 .*점/.test(txt("#trendAvg")));
    ok("오늘은 이전 버튼만 활성", el("nextDay").disabled && el("todayBtn").disabled);

    // 어제로 이동 — 오늘 기록이 사라지지 않아야 한다
    el("prevDay").click();
    ok("어제로 이동", !/오늘/.test(txt("#viewDate")));
    ok("지난 기록 표시등 켜짐", !el("pastFlag").hidden);
    ok("어제는 기록 없음", q("#mealList .meal").length === 0 && txt("#exTotal") === "0분");
    ok("어제 이동 시 다음/오늘 버튼 활성", !el("nextDay").disabled && !el("todayBtn").disabled);

    // 어제 칸에 기록을 남겨 본다
    el("mealSeg").querySelector('.segbtn[data-slot="저녁"]').click();
    el("mealText").value = "어제 저녁 기록";
    submit(el("mealForm"));
    ok("지난 날에도 기록 가능", q("#mealList .meal").length === 1);

    // 오늘로 복귀 — 오늘 기록이 그대로여야 한다
    el("todayBtn").click();
    ok("오늘로 복귀", /오늘/.test(txt("#viewDate")) && el("pastFlag").hidden);
    ok("오늘 기록 그대로 유지",
      q("#mealList .meal").length === 3 && txt("#exTotal") === "30분" &&
      q("#waterCups .cup.on").length === 4);
    ok("총점 유지", txt("#scoreTotal") === "8.8");

    var db2 = null;
    try { db2 = JSON.parse(localStorage.getItem("health-dashboard-v3")); } catch (e) {}
    ok("어제·오늘 두 날짜가 함께 보관됨", !!db2 && Object.keys(db2.days).length === 2);

    // ---------- 결과 배너 ----------
    var passed = log.filter(function (x) { return x.pass; }).length;
    var box = document.createElement("div");
    box.id = "testresult";
    box.style.cssText =
      "margin:18px auto 40px;max-width:1160px;padding:14px 18px;border-radius:10px;font-size:13px;" +
      "border:1px solid " + (passed === log.length ? "#0ca30c" : "#d03b3b") + ";" +
      "background:var(--canvas);color:var(--ink)";
    var h = document.createElement("div");
    h.style.cssText = "font-weight:600;margin-bottom:8px";
    h.textContent = "자동 검증 결과 — " + passed + " / " + log.length + " 통과";
    box.appendChild(h);
    log.forEach(function (x) {
      var r = document.createElement("div");
      r.textContent = (x.pass ? "PASS  " : "FAIL  ") + x.name;
      r.style.color = x.pass ? "var(--muted)" : "#d03b3b";
      box.appendChild(r);
    });
    document.body.appendChild(box);
  });
}());
