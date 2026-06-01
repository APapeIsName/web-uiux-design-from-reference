// 프론트 인터랙션(백엔드 없음). 6단계 영역 — 유사도 채점 대상 아님, 기준은 "동작".
// 헤더: 스크롤 후 solid(그림자) 토글. (히어로 위 투명은 예제에 히어로가 없어 생략)
(function () {
  var header = document.querySelector('[data-component="header"]');
  if (!header) return;
  function onScroll() {
    header.classList.toggle('is-solid', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
})();
