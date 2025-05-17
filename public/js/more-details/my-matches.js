// js/my-matches.js

/**
 * "신청한 매칭" 페이지 초기화 함수
 * @param {string} nickname - 현재 로그인한 사용자 닉네임
 * @param {object} elements - 공통 DOM 요소 객체
 */
async function initializeMyMatchesView(nickname, elements) {
  const {
    pageTitleElement,
    filterSectionElement,
    contentListElement,
    searchSectionElement, // 신청한 매칭은 검색 사용 안함
    paginationContainerElement,
  } = elements;

  if (pageTitleElement) pageTitleElement.textContent = "신청한 매칭";
  if (searchSectionElement) searchSectionElement.style.display = "none";
  if (filterSectionElement) filterSectionElement.classList.remove("hidden");

  const urlParams = new URLSearchParams(window.location.search);
  let currentPage = parseInt(urlParams.get("page") || "0");
  // 필터: API가 받을 값으로 정의 (예: 'ALL', 'IN_PROGRESS', 'COMPLETED')
  let currentFilter = urlParams.get("filter") || "ALL"; // 기본값 'ALL'

  // 매칭 상태 필터 정보 (API 명세에 따라 'value' 조정 필요)
  const matchFilters = [
    {display: "전체", value: "ALL"},
    {display: "진행중", value: "IN_PROGRESS"},
    {display: "완료", value: "COMPLETED"},
    // 필요시 다른 상태 추가 (예: '취소됨', '거절됨')
    // { display: '취소됨', value: 'CANCELED' },
  ];

  function mapApiFilterToDisplay(apiFilterValue) {
    const found = matchFilters.find((f) => f.value === apiFilterValue);
    return found ? found.display : "전체";
  }

  // 필터 버튼 UI 설정
  function setupFiltersUI() {
    if (!filterSectionElement) return;
    filterSectionElement.innerHTML = "";
    const filterButtonContainer = document.createElement("div");
    filterButtonContainer.className = "flex space-x-2 overflow-x-auto";

    const currentDisplayFilterName = mapApiFilterToDisplay(currentFilter);

    matchFilters.forEach((filterInfo) => {
      const button = document.createElement("button");
      button.textContent = filterInfo.display;
      button.className = `px-4 py-2 rounded-full whitespace-nowrap text-sm ${
        filterInfo.display === currentDisplayFilterName
          ? "bg-primary text-white"
          : "bg-gray-100 text-gray-700 hover:bg-gray-200"
      }`;
      button.addEventListener("click", () => {
        currentFilter = filterInfo.value;
        currentPage = 0;
        updateUrlAndReloadData();
      });
      filterButtonContainer.appendChild(button);
    });
    filterSectionElement.appendChild(filterButtonContainer);
  }

  // 데이터 로드 및 화면 표시
  async function loadAndRenderData(page = 0) {
    displayMessage(contentListElement, "매칭 정보를 불러오는 중...", "loading");
    if (paginationContainerElement) paginationContainerElement.innerHTML = "";

    const itemsPerPage = 10; // 페이지당 항목 수 (기존 my-matches.js size = 10)

    try {
      // API 엔드포인트 및 파라미터 구성
      // 기존: /api/v1/users/${sessionNickname}/activity/more-details?type=my-matches&page=${pageNumber}&size=10
      // 필터 파라미터 추가 필요
      let apiUrl = `/api/v1/users/${nickname}/activity/more-details?type=my-matches&page=${page}&size=${itemsPerPage}`;
      if (currentFilter && currentFilter !== "ALL") {
        // 'ALL'은 필터 파라미터 없이 보내거나 API가 'ALL'을 인식하도록
        apiUrl += `&status=${encodeURIComponent(currentFilter)}`; // API가 상태 필터를 'status'로 받는다고 가정
      }

      const response = await fetch(apiUrl, {
        method: "GET",
        headers: {"Content-Type": "application/json"},
        credentials: "include",
      });

      if (response.status === 401) {
        return window.handle401Error(() => loadAndRenderData(page));
      }

      const result = await response.json();

      if (!response.ok || result.code !== "SUCCESS") {
        throw new Error(result.message || `API 요청 실패: ${response.status}`);
      }

      const matchesData = result.data && result.data.content ? result.data.content : [];

      // 페이지 정보 파싱
      let pageInfo;
      if (result.data && result.data.page && typeof result.data.page.number === "number") {
        const apiPage = result.data.page;
        pageInfo = {
          number: apiPage.number,
          totalPages: apiPage.totalPages,
          isFirst: apiPage.number === 0,
          isLast: apiPage.number >= apiPage.totalPages - 1,
        };
      } else {
        const itemsOnPage = matchesData.length;
        const isLastPageFallback = (itemsOnPage < itemsPerPage && itemsOnPage > 0) || (itemsOnPage === 0 && page > 0);
        let calculatedTotalPages;
        if (itemsOnPage === 0 && page === 0) calculatedTotalPages = 1;
        else if (isLastPageFallback) calculatedTotalPages = page + 1;
        else calculatedTotalPages = page + 2;

        pageInfo = {
          number: page,
          totalPages: calculatedTotalPages,
          isFirst: page === 0,
          isLast: isLastPageFallback || (page + 1 === calculatedTotalPages && calculatedTotalPages === 1),
        };
        if (itemsOnPage === 0 && page === 0) pageInfo.isLast = true;
      }
      currentPage = pageInfo.number;
      const role = await roleCheck();
      renderMatchesList(matchesData, role);

      if (pageInfo.totalPages > 1 && paginationContainerElement) {
        setupCommonPagination(paginationContainerElement, pageInfo, (newPage) => {
          currentPage = newPage;
          updateUrlAndReloadData();
        });
      }
    } catch (error) {
      console.error("신청한 매칭 로드 중 오류 발생:", error);
      displayMessage(contentListElement, error.message || "매칭 정보를 불러오는 중 오류가 발생했습니다.", "error");
    }
  }

  // 매칭 목록 렌더링
  function renderMatchesList(matches, role) {
    if (!contentListElement) return;

    if (!matches || matches.length === 0) {
      let noDataMessage
      if (role === "ROLE_MENTEE") {
        noDataMessage = "신청한 매칭이 없습니다.";
      } else if(role === "ROLE_MENTOR") {
        noDataMessage = "현재 진행중인 매칭이 없습니다."
      }
      if (currentFilter && currentFilter !== "ALL") {
        noDataMessage = "선택한 조건에 맞는 매칭이 없습니다.";
      }
      displayMessage(contentListElement, noDataMessage, "no-data");
      // 재능 기부 찾기 버튼 (기존 my-matches.js 참고)

      let roleMessage
      let roleBtnMessage
      let roleLink
      if (role === "ROLE_MENTEE") {
        roleMessage = "재능 기부 페이지에서 관심있는 멘토를 찾아보세요!"
        roleBtnMessage = "재능 기부 찾기"
        roleLink = "/matching-type-selection"
      }  else if(role === "ROLE_MENTOR") {
        roleMessage = "재능 기부 페이지에서 재능을 기부해보세요!"
        roleBtnMessage = "재능 기부등록 페이지로 가기"
        roleLink = "/newPost"
      }

      const findTalentButtonHtml = `
        <div class="text-center mt-6">
          <p class="text-gray-500 dark:text-gray-400 mt-1 mb-4">${roleMessage}</p>
          <a href=${roleLink} class="inline-block px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium">
            ${roleBtnMessage}
          </a>
        </div>`;
      contentListElement.innerHTML += findTalentButtonHtml;
      return;
    }

    contentListElement.innerHTML = "";
    const listFragment = document.createDocumentFragment();
    matches.forEach((match, index) => {
      const mentorData = match.mentor; // API 응답 구조에 따라 mentor 객체 확인
      if (!mentorData) {
        console.warn("Match item has no mentor data:", match);
        return; // 멘토 데이터가 없으면 해당 항목 건너뛰기
      }

      const createdAt = match.createdAt ? new Date(match.createdAt) : new Date();
      const formattedDate = formatDate(createdAt); // from common-utils.js

      const contactBtnId = `contact-btn-${index}-${match.sessionId}`;
      const terminateBtnId = `terminate-btn-${index}-${match.sessionId}`;

      // API 응답에서 status 필드 확인 (예: 'IN_PROGRESS', 'COMPLETED')
      const isInProgress = match.status === "IN_PROGRESS";
      let statusText = "상태 미확인";
      let statusBgClass = "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200";

      if (match.status) {
        const filterMatch = matchFilters.find((f) => f.value === match.status);
        statusText = filterMatch ? filterMatch.display : match.status; // 정의되지 않은 상태면 API 값 그대로 표시
        if (match.status === "IN_PROGRESS") {
          statusBgClass = "bg-green-100 dark:bg-green-700 text-green-700 dark:text-green-100";
        } else if (match.status === "COMPLETED") {
          statusBgClass = "bg-blue-100 dark:bg-blue-700 text-blue-700 dark:text-blue-100";
        } else if (match.status === "CANCELED" || match.status === "REJECTED") {
          statusBgClass = "bg-red-100 dark:bg-red-700 text-red-700 dark:text-red-100";
        }
      }

      const matchElement = document.createElement("div");
      matchElement.className =
        "border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition mb-4 bg-white dark:bg-gray-800";

      // 버튼 HTML (isAuthorized는 항상 true로 가정, 현재 사용자가 신청한 매칭이므로)
      const buttonsHtml = !isInProgress
        ? `<span class="text-gray-400 dark:text-gray-500 text-sm">${statusText}된 매칭</span>`
        : `<div class="flex items-center gap-2">
             <button id="${contactBtnId}" class="text-primary text-sm font-medium hover:underline" data-mentor-id="${
            mentorData.mentorId
          }" data-session-id="${match.sessionId}" data-contact-link="${mentorData.contactLink || ""}">
               연락하기
             </button>
             <button id="${terminateBtnId}" class="text-gray-500 dark:text-gray-400 hover:text-red-500 text-sm" data-mentor-id="${
            mentorData.mentorId
          }" data-session-id="${match.sessionId}">
               종료하기
             </button>
           </div>`;

      matchElement.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden">
            <img src="${mentorData.profileImageUrl || "../assets/images/default-profile.png"}" 
                 alt="${mentorData.nickname || "멘토"} 프로필" class="w-full h-full object-cover"
                 onerror="handleImageError(this)">
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-medium text-gray-800 dark:text-gray-200 truncate" title="${
                  mentorData.nickname || "이름 없음"
                }">${mentorData.nickname || "이름 없음"}</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">${formattedDate} 요청</p>
              </div>
              <span class="${statusBgClass} text-xs px-2 py-1 rounded-full whitespace-nowrap">
                ${statusText}
              </span>
            </div>
            <p class="text-primary text-sm font-medium mt-1 truncate" title="${mentorData.interest || ""}">${
        mentorData.interest || "주요 분야 없음"
      }</p>
            <p class="text-sm text-gray-600 dark:text-gray-300 mt-2 line-clamp-2">${
              mentorData.introduction || "소개 정보가 없습니다."
            }</p>
            <div class="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
              <div class="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <i class="ri-time-line mr-1"></i>
                <span>${mentorData.activityTime || "활동 시간 정보 없음"}</span>
              </div>
              ${buttonsHtml}
            </div>
          </div>
        </div>
      `;
      listFragment.appendChild(matchElement);
    });
    contentListElement.appendChild(listFragment);

    // 버튼 이벤트 리스너 설정 (이벤트 위임 방식도 고려 가능)
    setupActionButtons();
  }

  // 매칭 관련 액션 버튼 이벤트 설정
  function setupActionButtons() {
    contentListElement.querySelectorAll('button[id^="contact-btn-"]').forEach((button) => {
      button.addEventListener("click", function () {
        // const mentorId = this.dataset.mentorId; // 필요시 사용
        const contactLink = this.dataset.contactLink;
        handleMatchContact(contactLink);
      });
    });
    contentListElement.querySelectorAll('button[id^="terminate-btn-"]').forEach((button) => {
      button.addEventListener("click", function () {
        const mentorId = this.dataset.mentorId;
        const sessionId = this.dataset.sessionId;
        handleMatchTerminate(mentorId, sessionId);
      });
    });
  }

  // 매칭 연락하기 처리
  function handleMatchContact(contactLink) {
    if (contactLink) {
      window.open(contactLink, "_blank");
    } else {
      alert("멘토의 연락처 정보가 등록되지 않았습니다.");
    }
  }

  // 매칭 종료하기 처리
  async function handleMatchTerminate(mentorId, sessionId) {
    if (confirm("정말 이 매칭을 종료하시겠습니까?")) {
      try {
        // API 호출: 매칭 상태 변경
        const apiUrl = "/api/v1/matching/status";
        const response = await fetch(apiUrl, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          credentials: "include",
          body: JSON.stringify({
            mentoringId: sessionId,
            mentoringStatus: "COMPLETED",
          }),
        });

        if (response.status === 401) {
          return window.handle401Error(() => handleMatchTerminate(mentorId, sessionId));
        }

        if (response.status === 200) {
          alert("매칭이 종료되었습니다.");
          loadAndRenderData(currentPage); // 현재 페이지 데이터 다시 로드
        } else {
          const result = await response.json().catch(() => ({}));
          throw new Error(result.message || `매칭 종료 실패 (상태: ${response.status})`);
        }
      } catch (error) {
        console.error("매칭 종료 중 오류:", error);
        alert(error.message || "매칭 종료 중 오류가 발생했습니다.");
      }
    }
  }

  // URL 업데이트 및 데이터 리로드 함수
  function updateUrlAndReloadData() {
    updateUrlParameters({
      type: "my-matches",
      page: currentPage,
      filter: currentFilter === "ALL" ? null : currentFilter,
    });
    setupFiltersUI(); // 필터 UI 즉시 업데이트
    loadAndRenderData(currentPage);
  }

  // 초기 설정 및 데이터 로드
  setupFiltersUI();
  loadAndRenderData(currentPage);
}
async function roleCheck() {
  const response = await fetch("/api/v1/authUser/me", {
    method: "GET",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "include",
  });
  if (response.status === 401) {
    return window.handle401Error(() => roleCheck());
  }
  const result = await response.json();
  if (result.code === "SUCCESS") {
    return result.data.role;
  }
  window.location.href = "/login";
}
// 전역 스코프에 노출
window.initializeMyMatchesView = initializeMyMatchesView;
