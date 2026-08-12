// 자동 검증 스크립트 — 헬스케어 대시보드용.
// 원본 HTML에는 포함하지 않고, 테스트 사본에만 주입한다.
(function () {
  "use strict";
  var log = [];
  function ok(name, cond) { log.push({ name: name, pass: !!cond }); }
  function submit(form) {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }
  function txt(sel) {
    var el = document.querySelector(sel);
    return el ? el.textContent.trim() : "";
  }

  window.confirm = function () { return true; };

  // ---------- 핵심기능 1: 식단 기록 ----------
  var mealForm = document.getElementById("mealForm");
  [["아침", "그릭요거트 + 바나나"],
   ["점심", "닭가슴살 샐러드"],
   ["저녁", "현미밥 + 된장국"],
   ["간식", "아몬드 한 줌"]].forEach(function (p) {
    document.querySelector('#mealSeg .segbtn[data-slot="' + p[0] + '"]').click();
    document.getElementById("mealText").value = p[1];
    submit(mealForm);
  });
  ok("식단 4건 기록", document.querySelectorAll("#mealList .meal").length === 4);
  ok("끼니 구분 저장", txt("#mealList .meal .tag") === "아침");

  // 간식 행 삭제 (끼니 순서로 정렬되므로 마지막 행)
  document.querySelectorAll("#mealList .meal")[3].querySelector(".del").click();
  ok("식단 삭제", document.querySelectorAll("#mealList .meal").length === 3);

  // ---------- 핵심기능 2: 수면 기록 ----------
  var bed = document.getElementById("sleepBed"), wake = document.getElementById("sleepWake");
  bed.value = "23:00";
  bed.dispatchEvent(new Event("change", { bubbles: true }));
  wake.value = "06:00";
  wake.dispatchEvent(new Event("change", { bubbles: true }));
  ok("수면 시간 자동 계산 (자정 넘김)", txt("#sleepText") === "7시간 0분");
  ok("수면 목표 배지", txt("#sleepBadge") === "목표 달성");

  // ---------- 핵심기능 3: 운동 기록 ----------
  var exForm = document.getElementById("exForm");
  [["러닝", "30"], ["요가", "15"]].forEach(function (p) {
    document.getElementById("exName").value = p[0];
    document.getElementById("exMin").value = p[1];
    submit(exForm);
  });
  ok("운동 2건 기록", document.querySelectorAll("#exList .ex").length === 2);
  ok("운동 시간 합계", txt("#exTotal") === "45분");

  // 0분 입력은 기록되지 않아야 한다
  document.getElementById("exName").value = "스트레칭";
  document.getElementById("exMin").value = "0";
  submit(exForm);
  ok("0분 입력 차단", document.querySelectorAll("#exList .ex").length === 2);

  document.querySelectorAll("#exList .ex")[1].querySelector(".del").click();
  ok("운동 삭제 후 합계 갱신", document.querySelectorAll("#exList .ex").length === 1 && txt("#exTotal") === "30분");

  // ---------- 핵심기능 4: 물 섭취 ----------
  var plus = document.getElementById("waterPlus"), minus = document.getElementById("waterMinus");
  for (var i = 0; i < 5; i++) plus.click();
  ok("물 5잔 기록", txt("#waterText") === "5 / 8잔");
  ok("잔 아이콘 채움", document.querySelectorAll("#waterCups .cup.on").length === 5);

  for (var j = 0; j < 8; j++) minus.click();
  ok("0잔 미만 방지", txt("#waterText") === "0 / 8잔");
  for (var k = 0; k < 4; k++) plus.click();

  // ---------- 메모 ----------
  var memoForm = document.getElementById("memoForm");
  ["아침에 붓기 있음. 어제 야식 영향인 듯.",
   "저녁 8시 이후 금식 시도 — 3일째."].forEach(function (t) {
    document.getElementById("memoText").value = t;
    submit(memoForm);
  });
  ok("메모 2건 저장", document.querySelectorAll("#memoList .memo").length === 2);
  document.querySelector("#memoList .memo .del").click();
  ok("메모 삭제", document.querySelectorAll("#memoList .memo").length === 1);

  // ---------- 체크리스트 ----------
  ok("기본 체크 항목 로드", document.querySelectorAll("#chkList .chk").length === 4);
  [0, 1].forEach(function (n) {
    var box = document.querySelectorAll("#chkList input[type=checkbox]")[n];
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
  });
  ok("체크 토글 + 진행률", txt("#ptext") === "2 / 4");

  document.getElementById("chkText").value = "자기 전 스트레칭 5분";
  submit(document.getElementById("chkForm"));
  ok("체크 항목 추가", document.querySelectorAll("#chkList .chk").length === 5);
  document.querySelectorAll("#chkList .chk")[4].querySelector(".del").click();
  ok("체크 항목 삭제", document.querySelectorAll("#chkList .chk").length === 4);

  // ---------- 하단: 오늘의 점수 ----------
  // 수면 7h(2.5) + 운동 30분(2.5) + 식단 3끼(2.5) + 물 4/8잔(1.25) = 8.75 → 8.8
  var total = parseFloat(txt("#scoreTotal"));
  ok("오늘의 점수 계산 (8.8 / 10)", Math.abs(total - 8.75) < 0.1);
  ok("항목별 점수 4행 표시", document.querySelectorAll("#scoreBars .sbar").length === 4);
  ok("물 항목 부분 점수", txt("#scoreBars .s-water .spt") === "1.3");

  // ---------- 저장 지속성 ----------
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem("health-dashboard-v1")); } catch (e) {}
  ok("localStorage 저장",
    !!saved && saved.meals.length === 3 && saved.workouts.length === 1 &&
    saved.water === 4 && saved.sleep.bed === "23:00" && saved.checks.length === 4);

  // ---------- 결과 배너 ----------
  var passed = log.filter(function (x) { return x.pass; }).length;
  var box = document.createElement("div");
  box.style.cssText =
    "margin:18px auto 0;max-width:1120px;padding:12px 16px;border-radius:10px;font-size:12.5px;" +
    "border:1px solid " + (passed === log.length ? "#0ca30c" : "#d03b3b") + ";" +
    "background:var(--surface-1);color:var(--text-primary)";
  var h = document.createElement("div");
  h.style.cssText = "font-weight:600;margin-bottom:6px";
  h.textContent = "자동 검증 결과 — " + passed + " / " + log.length + " 통과";
  box.appendChild(h);
  log.forEach(function (x) {
    var r = document.createElement("div");
    r.textContent = (x.pass ? "PASS  " : "FAIL  ") + x.name;
    r.style.color = x.pass ? "var(--text-secondary)" : "#d03b3b";
    box.appendChild(r);
  });
  document.body.appendChild(box);
}());
