// 자동 검증 스크립트 — 원본에는 포함되지 않고 테스트 사본에만 주입됩니다.
(function () {
  "use strict";
  var log = [];
  function ok(name, cond) { log.push({ name: name, pass: !!cond }); }
  function submit(form) {
    form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  }

  window.confirm = function () { return true; };   // 삭제 확인창 자동 승인

  // ---------- 기능 1: 관심종목 등록 ----------
  var stockForm = document.getElementById("stockForm");
  [["삼성전자", "005930"], ["SK하이닉스", "000660"], ["미래에셋증권", "006800"]].forEach(function (p) {
    document.getElementById("stockName").value = p[0];
    document.getElementById("stockCode").value = p[1];
    submit(stockForm);
  });
  ok("관심종목 등록 3건", document.querySelectorAll("#stockList .stock").length === 3);

  // 중복 등록 차단
  document.getElementById("stockName").value = "삼성전자";
  document.getElementById("stockCode").value = "005930";
  submit(stockForm);
  ok("중복 종목 차단", document.querySelectorAll("#stockList .stock").length === 3);

  // ---------- 기능 1: 관심종목 삭제 ----------
  document.getElementById("stockName").value = "삭제테스트";
  document.getElementById("stockCode").value = "999999";
  submit(stockForm);
  var before = document.querySelectorAll("#stockList .stock").length;
  document.querySelector("#stockList .stock .del").click();
  var after = document.querySelectorAll("#stockList .stock").length;
  ok("관심종목 삭제", before === 4 && after === 3);

  // ---------- 기능 2: 메모 기록 ----------
  document.querySelectorAll("#stockList .stock")[2].click();   // 삼성전자 선택
  ok("종목 선택 시 메모창 표시", !!document.querySelector("#memoArea textarea"));

  ["2Q 실적 컨센서스 상회. 해외법인 이익 비중 24% 확인 필요.",
   "반도체 수출 +155% — 업종 모멘텀 유효한지 오전 중 재확인."].forEach(function (t) {
    var ta = document.querySelector("#memoArea textarea");
    ta.value = t;
    submit(document.querySelector("#memoArea form"));
  });
  ok("메모 저장 2건", document.querySelectorAll("#memoArea .memo").length === 2);

  // 메모 삭제 후 복구
  document.querySelector("#memoArea .memo .del").click();
  ok("메모 삭제", document.querySelectorAll("#memoArea .memo").length === 1);
  var ta = document.querySelector("#memoArea textarea");
  ta.value = "반도체 수출 +155% — 업종 모멘텀 유효한지 오전 중 재확인.";
  submit(document.querySelector("#memoArea form"));

  // ---------- 기능 3: 오늘의 체크리스트 ----------
  var total0 = document.querySelectorAll("#chkList .chk").length;
  ok("기본 체크 항목 로드", total0 === 4);

  [0, 1].forEach(function (i) {
    var box = document.querySelectorAll("#chkList input[type=checkbox]")[i];
    box.checked = true;
    box.dispatchEvent(new Event("change", { bubbles: true }));
  });
  ok("체크 토글 + 진행률 반영", document.getElementById("ptext").textContent.trim() === "2 / 4");

  document.getElementById("chkText").value = "팀장님 보고자료 최종 확인";
  submit(document.getElementById("chkForm"));
  ok("체크 항목 추가", document.querySelectorAll("#chkList .chk").length === 5);

  document.querySelectorAll("#chkList .chk")[4].querySelector(".del").click();
  ok("체크 항목 삭제", document.querySelectorAll("#chkList .chk").length === 4);
  document.getElementById("chkText").value = "팀장님 보고자료 최종 확인";
  submit(document.getElementById("chkForm"));

  // ---------- 저장 지속성 ----------
  var saved = null;
  try { saved = JSON.parse(localStorage.getItem("morning-dashboard-v1")); } catch (e) {}
  ok("localStorage 저장", !!saved && saved.stocks.length === 3 && saved.checks.length === 5);

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
