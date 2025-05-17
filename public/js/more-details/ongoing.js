// js/ongoing.js

/**
 * "진행중인 매칭 (멘토 입장)" 페이지 초기화 함수
 * @param {string} mentorNickname - 현재 로그인한 멘토의 닉네임
 * @param {object} elements - 공통 DOM 요소 객체
 */
async function initializeOngoingMatchesView(mentorNickname, elements) {
  const {
    pageTitleElement,
    filterSectionElement, // 진행중 매칭은 필터 사용 안함 (필요시 추가)
    contentListElement,
    searchSectionElement, // 진행중 매칭은 검색 사용 안함 (필요시 추가)
    paginationContainerElement
  } = elements;

  if (pageTitleElement)
    pageTitleElement.textContent = '진행중인 매칭 (멘티 목록)';
  if (filterSectionElement) filterSectionElement.innerHTML = '';
  if (searchSectionElement) searchSectionElement.style.display = 'none';

  const urlParams = new URLSearchParams(window.location.search);
  let currentPage = parseInt(urlParams.get('page') || '0');

  // 데이터 로드 및 화면 표시
  async function loadAndRenderData(page = 0) {
    displayMessage(
      contentListElement,
      '진행중인 매칭 목록을 불러오는 중...',
      'loading'
    );
    if (paginationContainerElement) paginationContainerElement.innerHTML = '';

    const itemsPerPage = 10; // 페이지당 항목 수 (기존 ongoing.js는 size 파라미터 없이 모든 항목을 가져왔을 수 있음)

    try {
      // API 엔드포인트: 기존 ongoing.js 파일의 경로 사용 및 페이지네이션 파라미터 추가
      const apiUrl = `/api/v1/users/${mentorNickname}/matching/more-details?type=ongoing&page=${page}&size=${itemsPerPage}`;

      const response = await fetch(apiUrl, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        }
      });

      if (response.status === 401) {
        return window.handle401Error(() => loadAndRenderData(page));
      }

      const result = await response.json();

      if (!response.ok || (result.code && result.code !== 'SUCCESS')) {
        throw new Error(result.message || `API 요청 실패: ${response.status}`);
      }

      const matchesData =
        result.data && result.data.content ? result.data.content : [];

      // 페이지 정보 처리 (API 응답에 페이지 정보가 없다고 가정)
      let pageInfo;
      const itemsOnPage = matchesData.length;
      const isLastPage = itemsOnPage < itemsPerPage;

      let calculatedTotalPages;
      if (itemsOnPage === 0 && page === 0) {
        calculatedTotalPages = 1;
      } else if (isLastPage) {
        calculatedTotalPages = page + 1;
      } else {
        calculatedTotalPages = page + 2;
      }

      pageInfo = {
        number: page,
        totalPages: calculatedTotalPages,
        isFirst: page === 0,
        isLast:
          isLastPage ||
          (page + 1 === calculatedTotalPages && calculatedTotalPages === 1)
      };
      if (itemsOnPage === 0 && page === 0) pageInfo.isLast = true;

      currentPage = pageInfo.number;

      renderOngoingMatchesList(matchesData);

      if (pageInfo.totalPages > 1 && paginationContainerElement) {
        setupCommonPagination(
          paginationContainerElement,
          pageInfo,
          (newPage) => {
            updateUrlAndReloadData(newPage);
          }
        );
      }
    } catch (error) {
      console.error('진행중 매칭 로드 중 오류 발생:', error);
      displayMessage(
        contentListElement,
        error.message ||
          '진행중인 매칭 목록을 불러오는 중 오류가 발생했습니다.',
        'error'
      );
    }
  }

  // 진행중 매칭 목록 렌더링
  function renderOngoingMatchesList(matches) {
    if (!contentListElement) return;

    if (!matches || matches.length === 0) {
      displayMessage(
        contentListElement,
        '현재 진행중인 매칭이 없습니다.',
        'no-data'
      );
      return;
    }

    contentListElement.innerHTML = '';
    const listFragment = document.createDocumentFragment();
    matches.forEach((match) => {
      // API 응답 필드명 확인: match.menteeProfileImageUrl, match.menteeNickname 등
      const menteeProfileImageUrl =
        match.menteeProfileImageUrl || '../assets/images/default-profile.png';
      const menteeNickname = match.menteeNickname || '멘티 닉네임 없음';
      const matchingDate = match.matchingDate
        ? formatDate(match.matchingDate)
        : '날짜 미상';

      let statusText = '진행중'; // 기본적으로 'ongoing' 타입이므로
      let statusClass = 'bg-green-500 dark:bg-green-700'; // 진행중 상태 기본 클래스
      if (match.status) {
        // API가 status를 제공한다면 사용
        if (match.status === 'IN_PROGRESS') {
          statusText = '진행중';
          statusClass =
            'bg-green-100 dark:bg-green-800 text-green-700 dark:text-green-200';
        } else {
          statusText = match.status; // 다른 상태값일 경우 그대로 표시
          statusClass =
            'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200';
        }
      }

      const contactLink = match.contactLink; // 멘티의 연락처 (카카오 오픈채팅 등)
      const category = match.category || '카테고리 없음';
      const description = match.description || '설명 없음'; // 매칭에 대한 간략한 설명 또는 멘티의 요청사항
      const tags = (match.tag || '') // API가 'tag'를 쉼표 구분 문자열로 준다고 가정
        .split(',')
        .filter(Boolean)
        .map(
          (tag) =>
            `<span class="inline-block bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-1 rounded-full mr-1 mb-1">${tag.trim()}</span>`
        )
        .join('');

      const matchId = match.sessionId || match.matchingId || match.id; // 매칭 식별자 (API 응답 확인 필요)

      const matchCard = document.createElement('div');
      matchCard.className =
        'border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition mb-4 bg-white dark:bg-gray-800';

      matchCard.innerHTML = `
        <div class="flex flex-col sm:flex-row items-start gap-4">
          <div class="w-16 h-16 rounded-full overflow-hidden bg-gray-100 dark:bg-gray-700 flex-shrink-0">
            <img src="${menteeProfileImageUrl}" alt="${menteeNickname} 프로필" 
                 class="w-full h-full object-cover" onerror="handleImageError(this)">
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex flex-col sm:flex-row justify-between items-start mb-1">
              <div>
                <p class="text-base font-semibold text-gray-900 dark:text-white truncate" title="${menteeNickname}">${menteeNickname}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400">${matchingDate} 매칭 시작</p>
              </div>
              <span class="text-xs px-2 py-0.5 rounded-full text-white ${statusClass} mt-1 sm:mt-0 whitespace-nowrap">
                ${statusText}
              </span>
            </div>
            <div class="text-sm text-primary dark:text-primary-400 font-medium mt-1">${category}</div>
            <p class="text-sm text-gray-700 dark:text-gray-300 mt-1 line-clamp-2" title="${description}">${description}</p>
            ${
              tags ? `<div class="mt-2 flex flex-wrap gap-1">${tags}</div>` : ''
            }
          </div>

            <div class="flex-shrink-0 mt-2 sm:mt-0 sm:ml-4 flex flex-col items-start sm:items-end gap-2 w-auto">
            ${
              contactLink
                ? `
              <a href="${contactLink}" target="_blank" rel="noopener noreferrer"
                 class="inline-flex items-center justify-center px-3 py-1.5 border border-transparent text-xs font-medium rounded-md text-white bg-primary hover:bg-primary-dark focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-dark w-full sm:w-auto open-chat-link"
                 data-haslink="true">
                <i class="ri-chat-3-line mr-1.5"></i>연락하기
              </a>`
                : `
              <button class="inline-flex items-center justify-center px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-xs font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 w-full sm:w-auto open-chat-link"
                 data-haslink="false">
                <i class="ri-chat-off-line mr-1.5"></i>연락처 없음
              </button>
            `
            }
            </div>
        </div>
      `;
      listFragment.appendChild(matchCard);
    });
    contentListElement.appendChild(listFragment);

    // 연락처 없음 버튼 클릭 시 알림 (기존 ongoing.js 로직)
    contentListElement.querySelectorAll('.open-chat-link').forEach((link) => {
      if (link.dataset.haslink === 'false') {
        link.addEventListener('click', (e) => {
          e.preventDefault();
          alert('이 멘티는 연락처를 등록하지 않았습니다.');
        });
      }
    });

    // 추가 액션 버튼 이벤트 리스너 (주석 해제 시)
    /*
    contentListElement.querySelectorAll('.request-review-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { // 리뷰 요청 로직 });
    });
    contentListElement.querySelectorAll('.complete-match-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { // 매칭 완료 API 호출 로직 });
    });
    */
  }

  // URL 업데이트 및 데이터 리로드 함수
  function updateUrlAndReloadData(page) {
    updateUrlParameters({
      type: 'ongoing',
      page: page
    });
    loadAndRenderData(page);
  }

  // 초기 데이터 로드
  loadAndRenderData(currentPage);
}

// 전역 스코프에 노출
window.initializeOngoingMatchesView = initializeOngoingMatchesView;
