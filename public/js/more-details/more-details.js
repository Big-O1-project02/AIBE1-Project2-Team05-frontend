//more-details.js

document.addEventListener('DOMContentLoaded', function () {
  // URL에서 유형 및 ID 매개변수 가져오기
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type');

  // 유형에 따라 페이지 제목을 설정하고 콘텐츠 로드
  setupPageByType(type);

  window.addEventListener('popstate', (event) => {
    const newUrlParams = new URLSearchParams(window.location.search);
    const newType = newUrlParams.get('type');
    // event.state를 활용하여 이전 상태로 복원할 수도 있으나, 여기서는 URL 기반으로 페이지를 다시 설정하여 일관성 유지
    setupPageByType(newType);
  });
});

/**
 * URL의 type 파라미터에 따라 적절한 초기화 함수를 호출합니다.
 * @param {string | null} type - 컨텐츠 타입 (reviews, my-matches, my-posts 등)
 */
function setupPageByType(type) {
  const pageTitleElement = document.getElementById('page-title');
  const filterSectionElement = document.getElementById('filter-section');
  const contentListElement = document.getElementById('content-list');
  const searchSectionElement = document.getElementById('search-section');
  const paginationContainerElement = document.querySelector(
    '.flex.justify-center.mt-6'
  );

  // 공통 UI 초기화
  if (pageTitleElement) pageTitleElement.textContent = '상세 정보'; // 기본 타이틀
  if (contentListElement)
    displayMessage(contentListElement, '정보를 불러오는 중...', 'loading');
  else console.error('content-list element not found!');

  if (paginationContainerElement) paginationContainerElement.innerHTML = '';
  else console.error('Pagination container not found!');

  if (filterSectionElement) filterSectionElement.innerHTML = '';
  else console.error('filter-section element not found!');

  if (searchSectionElement) searchSectionElement.style.display = 'none';
  else console.error('search-section element not found!');

  const nickname = getCurrentNickname(); // from common-utils.js

  // 닉네임이 필요한 타입들에 대한 사전 검사
  const nicknameRequiredTypes = [
    'reviews',
    'my-matches',
    'my-posts',
    'my-comments',
    'my-interests',
    'my-talents',
    'ongoing',
    'interest-qna'
    // "favorites"는 목업이었으므로 일단 제외. API 연동 시 추가.
  ];

  if (nicknameRequiredTypes.includes(type) && !nickname) {
    if (pageTitleElement) pageTitleElement.textContent = '오류';
    displayMessage(
      contentListElement,
      '사용자 정보를 찾을 수 없습니다. 다시 로그인해주세요.',
      'error'
    );
    return;
  }

  const commonElements = {
    pageTitleElement,
    filterSectionElement,
    contentListElement,
    searchSectionElement,
    paginationContainerElement
  };
  // 함수 호출 전, 해당 함수가 존재하는지 확인
  function callInitializer(initializerFn, typeName) {
    if (typeof initializerFn === 'function') {
      initializerFn(nickname, commonElements);
    } else {
      console.error(`Initializer function for type "${typeName}" not found.`);
      if (pageTitleElement) pageTitleElement.textContent = '오류';
      displayMessage(
        contentListElement,
        `"${typeName}" 상세 정보를 불러올 수 없습니다.`,
        'error'
      );
    }
  }

  switch (type) {
    case 'reviews': // 멘토가 받은 리뷰
      callInitializer(window.initializeReceivedReviewsView, type);
      break;
    case 'my-matches': // 내가 신청한 매칭 (멘티)
      callInitializer(window.initializeMyMatchesView, type);
      break;
    case 'my-posts': // 내가 작성한 게시글
      callInitializer(window.initializeMyPostsView, type);
      break;
    case 'my-comments': // 내가 작성한 댓글
      callInitializer(window.initializeMyCommentsView, type);
      break;
    case 'my-interests': // 관심 목록 (북마크/좋아요)
      callInitializer(window.initializeMyInterestsView, type);
      break;
    case 'my-talents': // 내가 등록한 재능 (멘토)
      callInitializer(window.initializeMyTalentsView, type);
      break;
    case 'ongoing': // 진행중인 매칭 (멘토가 보는 멘티 목록)
      callInitializer(window.initializeOngoingMatchesView, type);
      break;
    case 'interest-qna': // 추천 QnA
      callInitializer(window.initializeInterestQnAView, type);
      break;
    default:
      if (pageTitleElement) pageTitleElement.textContent = '알 수 없는 페이지';
      displayMessage(
        contentListElement,
        `"${type || '알 수 없는'}" 타입을 처리할 수 없습니다.`,
        'error'
      );
  }
}

/**
 * Set up filter buttons
 * @param {Array} filters - Array of filter names
 */
function setupFilters(filters) {
  const filterContainer = document.querySelector(
    '#filter-section .flex.space-x-2'
  );
  filterContainer.innerHTML = ''; // Clear existing filters

  filters.forEach((filter, index) => {
    const button = document.createElement('button');
    button.textContent = filter;
    button.className =
      index === 0
        ? 'px-4 py-2 bg-primary text-white rounded-full whitespace-nowrap'
        : 'px-4 py-2 bg-gray-100 text-gray-700 rounded-full whitespace-nowrap hover:bg-gray-200';

    const urlParams = new URLSearchParams(window.location.search);
    const type = urlParams.get('type');

    // 받은 리뷰 탭일 경우에만 강조/정렬 동작
    if (type === 'reviews') {
      const isActive =
        (filter === '최신순' && selectedSort === 'recent') ||
        (filter === '높은 평점순' && selectedSort === 'high') ||
        (filter === '낮은 평점순' && selectedSort === 'low');

      if (isActive) {
        button.className =
          'px-4 py-2 bg-primary text-white rounded-full whitespace-nowrap';
      }
    }

    button.addEventListener('click', () => {
      const type = new URLSearchParams(window.location.search).get('type');
      // Remove active class from all buttons
      filterContainer.querySelectorAll('button').forEach((btn) => {
        btn.className =
          'px-4 py-2 bg-gray-100 text-gray-700 rounded-full whitespace-nowrap hover:bg-gray-200';
      });
      // Add active class to clicked button
      button.className =
        'px-4 py-2 bg-primary text-white rounded-full whitespace-nowrap';
      // Filter content
      filterContent(filter);
    });
  });
  filterContainer.appendChild(button);
}

/**
 * Filter content based on selected filter
 * @param {string} filter - The selected filter
 */
function filterContent(filter) {
  // This would be implemented based on the specific content type
  console.log('Filtering by:', filter);
  // For now, we'll just reload the current content type
  const urlParams = new URLSearchParams(window.location.search);
  const type = urlParams.get('type');
  const id = urlParams.get('id');

  // // ⭐ 정렬용 필터는 리뷰 탭일 때만 적용
  // if (type === "reviews") {
  //   const sortMap = {
  //     "최신순": "recent",
  //     "높은 평점순": "high",
  //     "낮은 평점순": "low"
  //   };
  //   const sort = sortMap[filter] || "recent";
  // Reload content with filter
  setupPage(type, id); // 기존 동작 유지
}
