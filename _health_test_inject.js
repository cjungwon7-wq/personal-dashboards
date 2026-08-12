// 자동 검증 스크립트 — 원본에는 포함되지 않고 테스트 사본에만 주입됩니다.
//
// 주의: 실제 Supabase 프로젝트에 로그인해 그 계정의 오늘 기록을 덮어씁니다.
// 아래 TEST_EMAIL 계정 전용입니다. 실사용 계정으로 돌리지 마세요.
// 실행 전 TASKS_헬스케어.md 의 초기화 SQL을 먼저 돌려 계정을 깨끗하게 만듭니다.
(function () {
  "use strict";

  var SUPABASE_URL = "https://qplxvfwuobvnobqpivbm.supabase.co";
  var SUPABASE_KEY = "sb_publishable_zuCioXoqOBTJM06bz9VC3w_qtfXJEjm";

  // 계정 정보는 저장소에 두지 않는다. 실행 스크립트가 환경변수에서 읽어 주입한다.
  // (이 파일은 배포되면 공개되므로 비밀번호를 여기 적으면 그대로 노출된다)
  var creds = window.__TEST_CREDS || {};
  var TEST_EMAIL = creds.email;
  var TEST_PW = creds.pw;

  var log = [];
  function ok(name, cond) { log.push({ name: name, pass: !!cond }); }
  function submit(form) {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
  function fire(el, type) { el.dispatchEvent(new Event(type, { bubbles: true })); }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function waitFor(fn, ms) {
    var deadline = performance.now() + (ms || 20000);
    return (function spin() {
      return Promise.resolve(fn()).then(function (v) {
        if (v) return true;
        if (performance.now() > deadline) return false;
        return sleep(150).then(spin);
      });
    }());
  }

  var token = null;
  function api(path) {
    return fetch(SUPABASE_URL + "/rest/v1" + path, {
      headers: { apikey: SUPABASE_KEY, Authorization: "Bearer " + token }
    }).then(function (r) { return r.ok ? r.json() : []; });
  }

  var q = function (s) { return document.querySelectorAll(s); };
  var el = function (i) { return document.getElementById(i); };
  var now = new Date();
  var today = now.getFullYear() + "-" +
    String(now.getMonth() + 1).padStart(2, "0") + "-" +
    String(now.getDate()).padStart(2, "0");

  (function run() {
    if (!TEST_EMAIL || !TEST_PW) {
      ok("테스트 계정 주입 (HEALTH_TEST_EMAIL / HEALTH_TEST_PW)", false);
      return Promise.resolve().then(report);
    }
    // ---------- 0. 로그인 게이트 ----------
    return waitFor(function () { return !el("authCard").hidden; })
      .then(function (shown) {
        ok("세션 없으면 로그인 화면 표시", shown);
        ok("로그인 전 앱 화면 가려짐",
          document.body.classList.contains("locked") && !el("mealSeg").offsetParent);

        // 잘못된 비밀번호는 막힌다
        el("authEmail").value = TEST_EMAIL;
        el("authPw").value = "wrong-password-000";
        submit(el("authForm"));
        return waitFor(function () { return !!el("authErr").textContent; }, 15000);
      })
      .then(function (errShown) {
        ok("잘못된 비밀번호 로그인 거부",
          errShown && document.body.classList.contains("locked"));

        // 올바른 자격증명으로 로그인
        el("authEmail").value = TEST_EMAIL;
        el("authPw").value = TEST_PW;
        submit(el("authForm"));
        return waitFor(function () { return !document.body.classList.contains("locked"); }, 25000);
      })
      .then(function (entered) {
        ok("로그인 성공 시 앱 진입", entered);
        if (!entered) throw new Error("로그인 실패 — " + (el("authErr").textContent || "사유 불명"));

        var s = JSON.parse(localStorage.getItem("health-dashboard-session"));
        token = s && s.access_token;
        ok("세션 토큰 저장", !!token && !!s.user.id);
        ok("기본 체크 항목 4종 로드 (가입 트리거)", q("#chkList .chk").length === 4);
        ok("연결 오류 배너 없음", !el("footer").classList.contains("bad"));

        // ---------- 1. 식단 ----------
        [["아침", "그릭요거트"], ["점심", "닭가슴살 샐러드"], ["저녁", "현미밥 정식"], ["간식", "아몬드"]]
          .forEach(function (p) {
            el("mealSeg").querySelector('.segbtn[data-slot="' + p[0] + '"]').click();
            el("mealText").value = p[1];
            submit(el("mealForm"));
          });
        ok("식단 기록 4건", q("#mealList .meal").length === 4);
        ok("끼니 구분 저장 (첫 행 아침)",
          q("#mealList .meal")[0].querySelector(".tag").textContent === "아침");

        q("#mealList .meal")[3].querySelector(".del").click();   // 간식 삭제
        ok("식단 삭제", q("#mealList .meal").length === 3);

        // ---------- 2. 수면 ----------
        el("sleepBed").value = "23:00";  fire(el("sleepBed"), "input");
        el("sleepWake").value = "06:00"; fire(el("sleepWake"), "input");
        ok("수면 시간 자동 계산 (자정 넘김)", el("sleepText").textContent.trim() === "7시간 0분");
        ok("수면 목표 달성 배지", el("sleepBadge").textContent.trim() === "목표 달성");

        // ---------- 3. 운동 ----------
        el("exSeg").querySelector('.segbtn[data-type="유산소"]').click();
        el("exName").value = "러닝"; el("exMin").value = "30";
        submit(el("exForm"));
        el("exSeg").querySelector('.segbtn[data-type="웨이트"]').click();
        el("exName").value = "벤치프레스"; el("exMin").value = "15";
        submit(el("exForm"));
        ok("운동 기록 2건 · 종류 구분", q("#exList .ex").length === 2);
        ok("종류 배지 아이콘 표시", q("#exList .ex .tag .tico").length === 2);
        ok("운동 시간 합계", el("exTotal").textContent.trim() === "45분");
        ok("종류별 합계", el("exBreak").textContent.trim() === "유산소 30분 · 웨이트 15분");

        el("exName").value = "스트레칭"; el("exMin").value = "0";
        submit(el("exForm"));
        ok("0분 입력 차단", q("#exList .ex").length === 2);

        q("#exList .ex")[1].querySelector(".del").click();   // 웨이트 삭제
        ok("삭제 후 합계 갱신", el("exTotal").textContent.trim() === "30분" &&
          el("exBreak").textContent.trim() === "유산소 30분");

        // ---------- 4. 수분 ----------
        for (var i = 0; i < 5; i++) el("waterPlus").click();
        ok("잔 수 증가", el("waterText").textContent.replace(/\s+/g, " ").trim() === "5 / 8잔");
        ok("잔 아이콘 반영", q("#waterCups .cup.on").length === 5);
        el("waterMinus").click();
        ok("잔 수 감소", q("#waterCups .cup.on").length === 4);

        // ---------- 5. 메모 ----------
        ["컨디션 좋음. 식욕 안정적.", "저녁에 소화가 좀 더뎠음."].forEach(function (t) {
          el("memoText").value = t;
          submit(el("memoForm"));
        });
        ok("메모 저장 2건", q("#memoList .memo").length === 2);
        q("#memoList .memo .del")[0].click();
        ok("메모 삭제", q("#memoList .memo").length === 1);

        // ---------- 6. 체크리스트 ----------
        [0, 1].forEach(function (n) {
          var box = q("#chkList input[type=checkbox]")[n];
          box.checked = true;
          fire(box, "change");
        });
        ok("체크 토글 · 진행률", el("ptext").textContent.trim() === "2 / 4");

        el("chkText").value = "스트레칭 10분";
        submit(el("chkForm"));
        ok("체크 항목 추가", q("#chkList .chk").length === 5);
        q("#chkList .chk")[4].querySelector(".del").click();
        ok("체크 항목 삭제", q("#chkList .chk").length === 4);
        el("chkText").value = "스트레칭 10분";
        submit(el("chkForm"));

        // ---------- 7. 오늘의 점수 ----------
        // 수면 7h(2.5) + 운동 30분(2.5) + 식단 3끼(2.5) + 수분 4/8잔(1.25) = 8.75 → 8.8
        ok("총점 계산", el("scoreTotal").textContent.trim() === "8.8");
        ok("상단 요약 점수 동기화", el("heroScore").textContent.trim() === "오늘 8.8점");
        ok("점수 표정 — 상", el("scoreFace").textContent.trim() === "😄");
        ok("항목별 막대 4행", q("#scoreBars .sbar").length === 4);
        ok("부분 점수 환산 (수분 1.3)",
          q("#scoreBars .sbar.s-water .spt")[0].textContent.trim() === "1.3");

        // ---------- 8. Supabase 저장 확인 ----------
        // 수면·물은 400ms 디바운스 후에 나가므로 daily_logs 가 채워질 때까지 기다린다
        return waitFor(function () {
          return Promise.all([
            api("/meals?select=id&log_date=eq." + today),
            api("/daily_logs?select=water&log_date=eq." + today)
          ]).then(function (r) { return r[0].length === 3 && r[1].length === 1; });
        });
      })
      .then(function (persisted) {
        ok("Supabase meals 3건 저장 (삭제분 미저장)", persisted);
        return Promise.all([
          api("/meals?select=slot,text&log_date=eq." + today + "&order=created_at"),
          api("/workouts?select=type,name,minutes&log_date=eq." + today),
          api("/daily_logs?select=water,sleep_bed,sleep_wake&log_date=eq." + today),
          api("/memos?select=id,text"),
          api("/checklist_items?select=id,text&order=sort_order"),
          api("/checklist_marks?select=item_id,done&log_date=eq." + today)
        ]);
      })
      .then(function (r) {
        var meals = r[0], workouts = r[1], logs = r[2], memos = r[3],
            items = r[4], marks = r[5];

        ok("meals 끼니 구분 저장",
          meals.map(function (m) { return m.slot; }).join(",") === "아침,점심,저녁");
        ok("삭제한 간식 미저장", !meals.some(function (m) { return m.slot === "간식"; }));

        ok("workouts 1건 · 종류/시간 저장",
          workouts.length === 1 && workouts[0].type === "유산소" && workouts[0].minutes === 30);

        ok("daily_logs 수분 저장", logs.length === 1 && logs[0].water === 4);
        ok("daily_logs 수면 저장",
          logs.length === 1 &&
          String(logs[0].sleep_bed).slice(0, 5) === "23:00" &&
          String(logs[0].sleep_wake).slice(0, 5) === "06:00");

        ok("memos 1건 저장", memos.length === 1);
        ok("checklist_items 5건 저장", items.length === 5);
        ok("추가한 체크 항목 저장",
          items.some(function (c) { return c.text === "스트레칭 10분"; }));
        ok("checklist_marks 날짜별 완료 2건 저장",
          marks.filter(function (m) { return m.done; }).length === 2);

        // 날짜별 분리 — 어제 날짜로는 오늘 기록이 보이지 않아야 한다
        var y = new Date(now.getTime() - 86400000);
        var ykey = y.getFullYear() + "-" + String(y.getMonth() + 1).padStart(2, "0") + "-" +
                   String(y.getDate()).padStart(2, "0");
        return api("/meals?select=id&log_date=eq." + ykey).then(function (rows) {
          ok("기록이 날짜별로 분리됨 (어제 조회 시 0건)", rows.length === 0);
        });
      })
      .catch(function (e) {
        console.error(e);
        ok("스크립트 완주 (예외 없음) — " + (e && e.message), false);
      })
      .then(report);
  }());

  function report() {
    var passed = log.filter(function (x) { return x.pass; }).length;
    var box = document.createElement("div");
    box.style.cssText =
      "margin:18px auto 0;max-width:1120px;padding:12px 16px;border-radius:10px;font-size:12.5px;" +
      "border:1px solid " + (passed === log.length ? "#0ca30c" : "#d03b3b") + ";" +
      "background:#fff;color:#222";
    var h = document.createElement("div");
    h.style.cssText = "font-weight:600;margin-bottom:6px";
    h.textContent = "자동 검증 결과 — " + passed + " / " + log.length + " 통과";
    box.appendChild(h);
    log.forEach(function (x) {
      var r = document.createElement("div");
      r.textContent = (x.pass ? "PASS  " : "FAIL  ") + x.name;
      r.style.color = x.pass ? "#3f3f3f" : "#d03b3b";
      box.appendChild(r);
    });
    document.body.appendChild(box);
    document.title = "TESTDONE " + passed + "/" + log.length;
  }
}());
