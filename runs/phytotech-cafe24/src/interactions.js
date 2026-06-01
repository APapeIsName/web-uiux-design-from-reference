// 6단계 프론트 인터랙션 (백엔드 없음). 유사도 채점 대상 아님 — 기준은 "동작".
(function () {
  var root = document.querySelector('.clone-root') || document;
  function $(s, c) { return (c || root).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || root).querySelectorAll(s)); }

  var header = $('[data-component="header"]');

  /* 1) 헤더: 스크롤 시 그림자 */
  function onScroll() {
    var y = window.scrollY || document.documentElement.scrollTop || 0;
    if (header) header.classList.toggle('is-scrolled', y > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* 2) 인기검색어 롤링 */
  var keywords = ['루테인 지아잔틴', '프로바이오틱스 100억', '알티지 오메가3', '마그네슘 비타민B', '6년근 홍삼정', '저분자 콜라겐'];
  var rankEl = $('.hd-rank'), kwEl = $('.hd-kw'), ki = 0;
  if (rankEl && kwEl) {
    kwEl.style.transition = 'opacity .2s';
    setInterval(function () {
      ki = (ki + 1) % keywords.length;
      kwEl.style.opacity = '0';
      setTimeout(function () { rankEl.textContent = String(ki + 1); kwEl.textContent = keywords[ki]; kwEl.style.opacity = '1'; }, 200);
    }, 2600);
  }

  /* 3) 히어로 캐러셀 (자동 + 도트 클릭) */
  var hero = $('[data-component="hero"]');
  if (hero) {
    var slides = [
      { eyebrow: '정기구독 런칭 기념', headline: '속부터 <span class="ac-green">가볍게</span><br>채우는 하루, <span class="ac-promo">첫 달 무료</span>', offer: '최대 34% + 사은품', cond: '정기구독 신규 구매 시 · 멀티비타민 1개월분 증정', imgs: ['assets/h1.jpg', 'assets/h2.jpg', 'assets/h3.jpg'] },
      { eyebrow: '베스트셀러 기획전', headline: '매일 챙기는 <span class="ac-green">핵심 영양</span>,<br>이번 주 <span class="ac-promo">최대 40%</span>', offer: '2개 구매 시 1개 증정', cond: '베스트 상품 한정 · 사은품 소진 시 종료', imgs: ['assets/p2.jpg', 'assets/p1.jpg', 'assets/p6.jpg'] },
      { eyebrow: '첫 구매 회원 혜택', headline: '처음이라면 <span class="ac-green">부담 없이</span><br>시작하는 <span class="ac-promo">15% 쿠폰</span>', offer: '신규 가입 즉시 발급', cond: '전 상품 사용 가능 · 발급 후 7일 내', imgs: ['assets/p4.jpg', 'assets/p3.jpg', 'assets/p5.jpg'] }
    ];
    var hEye = $('.hero-eyebrow', hero), hHead = $('.hero-headline', hero),
        hBadge = $('.hero-offer-badge', hero), hCond = $('.hero-cond', hero),
        prods = $$('.hero-prod, .hero-gift', hero), dots = $$('.hero-dots i', hero),
        si = 0, timer = null;
    function show(n) {
      si = (n + slides.length) % slides.length;
      var s = slides[si];
      if (hEye) hEye.textContent = s.eyebrow;
      if (hHead) hHead.innerHTML = s.headline;
      if (hBadge) hBadge.textContent = s.offer;
      if (hCond) hCond.textContent = s.cond;
      prods.forEach(function (im, idx) { if (s.imgs[idx]) im.src = s.imgs[idx]; });
      dots.forEach(function (d, idx) { d.classList.toggle('on', idx === si); });
      hero.classList.remove('fade'); void hero.offsetWidth; hero.classList.add('fade');
    }
    dots.forEach(function (d, idx) { d.style.cursor = 'pointer'; d.addEventListener('click', function () { show(idx); restart(); }); });
    function restart() { if (timer) clearInterval(timer); timer = setInterval(function () { show(si + 1); }, 4500); }
    restart();
  }

  /* 4) 플로팅: 맨위로 + 데모 액션 */
  var faTop = $('.fa-top');
  if (faTop) faTop.addEventListener('click', function (e) { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
  $$('.fa-chat, .fa-promo').forEach(function (b) {
    b.addEventListener('click', function (e) { e.preventDefault(); toast(b.classList.contains('fa-chat') ? '상담 채팅을 준비 중입니다 🙂' : '정기구독 혜택을 확인해 보세요'); });
  });

  /* 5) 찜 토글 + 장바구니 담기(데모) */
  var wishIc = $('.hd-actions .hd-ic[aria-label="찜"]'), wishImg = wishIc && wishIc.querySelector('img');
  if (wishIc && wishImg) wishIc.addEventListener('click', function (e) {
    e.preventDefault();
    var on = wishIc.classList.toggle('on');
    wishImg.src = 'https://api.iconify.design/lucide/heart.svg?color=' + (on ? '%23E03A3A' : '%23111511') + '&width=22&height=22';
  });
  var cartBadge = $('.hd-cart-badge');
  $$('[data-component="product-grid"] .pg-card, [data-component="grid-subscription"] .gs-card').forEach(function (card) {
    card.style.cursor = 'pointer';
    card.addEventListener('click', function (e) {
      e.preventDefault();
      if (cartBadge) cartBadge.textContent = String((parseInt(cartBadge.textContent, 10) || 0) + 1);
      card.classList.remove('added'); void card.offsetWidth; card.classList.add('added');
      var nm = (card.querySelector('.pg-name, .gs-name') || {}).textContent || '상품';
      toast(nm + ' 장바구니에 담았습니다');
    });
  });

  /* 6) GNB 활성 토글 */
  $$('.hd-gnb a').forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      $$('.hd-gnb a').forEach(function (x) { x.classList.remove('is-active'); });
      a.classList.add('is-active');
    });
  });

  /* toast */
  var toastEl = null;
  function toast(msg) {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'clone-toast'; (document.querySelector('.clone-root') || document.body).appendChild(toastEl); }
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toastEl.classList.remove('show'); }, 1800);
  }

  onScroll();
})();
