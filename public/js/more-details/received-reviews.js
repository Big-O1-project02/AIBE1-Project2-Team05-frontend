// js/received-reviews.js

/**
 * "받은 리뷰" 페이지 초기화 함수
 * @param {string} nickname - 현재 로그인한 사용자 닉네임
 * @param {object} elements - 공통 DOM 요소 객체
 */
async function initializeReceivedReviewsView(nickname, elements) {
    const {
        pageTitleElement,
        filterSectionElement,
        contentListElement,
        searchSectionElement,
        paginationContainerElement
    } = elements;

    if (pageTitleElement) pageTitleElement.textContent = "받은 리뷰";
    if (searchSectionElement) searchSectionElement.style.display = "none"; // 받은 리뷰에서는 검색 사용 안함

    const urlParams = new URLSearchParams(window.location.search);
    let currentPage = parseInt(urlParams.get("page") || "0");
    let selectedSort = urlParams.get("sort") || "recent"; // 기본값 '최신순'

    // 정렬 옵션
    const sortOptions = [
        { display: "최신순", value: "recent" },
        // { display: "높은 평점순", value: "high" },
        // { display: "낮은 평점순", value: "low" }
    ];

    // 정렬 버튼 UI 설정
    function setupSortUI() {
        if (!filterSectionElement) return;
        filterSectionElement.innerHTML = "";
        const filterButtonContainer = document.createElement("div");
        filterButtonContainer.className = "flex space-x-2 overflow-x-auto";

        sortOptions.forEach((option) => {
            const button = document.createElement("button");
            button.textContent = option.display;
            button.className = `px-4 py-2 rounded-full whitespace-nowrap text-sm ${
                option.value === selectedSort
                    ? "bg-primary text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`;
            button.addEventListener("click", () => {
                selectedSort = option.value;
                currentPage = 0; // 정렬 변경 시 첫 페이지로
                updateUrlAndReloadData();
            });
            filterButtonContainer.appendChild(button);
        });
        filterSectionElement.appendChild(filterButtonContainer);
    }

    // 데이터 로드 및 화면 표시
    async function loadAndRenderData(page = 0) {
        displayMessage(contentListElement, "리뷰를 불러오는 중...", "loading");
        if (paginationContainerElement) paginationContainerElement.innerHTML = "";

        const itemsPerPage = 10; // 페이지당 항목 수

        try {
            // API 엔드포인트 및 파라미터 구성
            let apiUrl = `/api/v1/users/${nickname}/matching/more-details?type=received-reviews&page=${page}&size=${itemsPerPage}`;

            // 정렬 파라미터 추가
            if (selectedSort) {
                apiUrl += `&sort=${encodeURIComponent(selectedSort)}`;
            }

            const response = await fetch(apiUrl, {
                method: "GET",
                headers: { "Content-Type": "application/json" },
                credentials: "include"
            });

            if (response.status === 401) {
                return window.handle401Error(() => loadAndRenderData(page));
            }

            const result = await response.json();

            if (!response.ok || result.code !== "SUCCESS") {
                throw new Error(result.message || `API 요청 실패: ${response.status}`);
            }

            const reviewsData = result.data && result.data.content ? result.data.content : [];

            // 페이지 정보 파싱
            let pageInfo;
            if (result.data && result.data.page && typeof result.data.page.number === "number") {
                const apiPage = result.data.page;
                pageInfo = {
                    number: apiPage.number,
                    totalPages: apiPage.totalPages,
                    isFirst: apiPage.number === 0,
                    isLast: apiPage.number >= apiPage.totalPages - 1,
                    totalElements: apiPage.totalElements
                };
            } else {
                const itemsOnPage = reviewsData.length;
                const isLastPageFallback = itemsOnPage < itemsPerPage;
                let calculatedTotalPages;
                if (itemsOnPage === 0 && page === 0) calculatedTotalPages = 1;
                else if (isLastPageFallback) calculatedTotalPages = page + 1;
                else calculatedTotalPages = page + 2;

                pageInfo = {
                    number: page,
                    totalPages: calculatedTotalPages,
                    isFirst: page === 0,
                    isLast: isLastPageFallback
                };
            }
            currentPage = pageInfo.number;

            renderReviewsList(reviewsData, pageInfo.totalElements);

            if (pageInfo.totalPages > 1 && paginationContainerElement) {
                setupCommonPagination(paginationContainerElement, pageInfo, (newPage) => {
                    currentPage = newPage;
                    updateUrlAndReloadData();
                });
            }
        } catch (error) {
            console.error("받은 리뷰 로드 중 오류 발생:", error);
            displayMessage(contentListElement, error.message || "리뷰 정보를 불러오는 중 오류가 발생했습니다.", "error");
        }
    }

    // 리뷰 목록 렌더링
    function renderReviewsList(reviews, totalCount = 0) {
        if (!contentListElement) return;

        if (!reviews || reviews.length === 0) {
            displayMessage(contentListElement, "받은 리뷰가 없습니다.", "no-data");
            return;
        }

        contentListElement.innerHTML = "";

        // 상단에 총 리뷰 수 표시
        const totalCountElement = document.createElement("div");
        totalCountElement.className = "text-sm text-gray-600 dark:text-gray-300 mb-4";
        totalCountElement.textContent = `총 ${totalCount || reviews.length}개의 리뷰가 있습니다.`;
        contentListElement.appendChild(totalCountElement);

        const listFragment = document.createDocumentFragment();
        reviews.forEach((review) => {
            const reviewElement = document.createElement("div");
            reviewElement.className = "border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-lg transition mb-4 bg-white dark:bg-gray-800";

            // 리뷰 날짜 포맷팅
            const reviewDate = review.reviewDate ? new Date(review.reviewDate) : new Date();
            const formattedDate = formatDate(reviewDate); // from common-utils.js

            // 별점 HTML 생성
            const stars = generateStarRating(review.star || 0);

            reviewElement.innerHTML = `
        <div class="flex items-start gap-3">
          <div class="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 flex-shrink-0 overflow-hidden">
            <img src="${review.reviewerProfileImageUrl || "../assets/images/default-profile.png"}" 
                 alt="${review.reviewerName || "익명"} 프로필" class="w-full h-full object-cover"
                 onerror="handleImageError(this)">
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start">
              <div>
                <h3 class="font-medium text-gray-800 dark:text-gray-200" title="${review.reviewerName || "익명"}">${review.reviewerName || "익명"}</h3>
                <p class="text-xs text-gray-500 dark:text-gray-400">${formattedDate}</p>
              </div>
              <div class="flex items-center">
                ${stars}
                <span class="text-amber-500 ml-1 font-medium">${review.star.toFixed(1)}</span>
              </div>
            </div>
            <p class="text-sm text-gray-600 dark:text-gray-300 mt-2">${review.content || "내용 없음"}</p>
          </div>
        </div>
      `;
            listFragment.appendChild(reviewElement);
        });
        contentListElement.appendChild(listFragment);
    }

    // 별점 HTML 생성 함수
    function generateStarRating(rating) {
        const fullStars = Math.floor(rating);
        const hasHalfStar = rating % 1 >= 0.5;
        const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

        let starsHtml = '';

        // 꽉 찬 별
        for (let i = 0; i < fullStars; i++) {
            starsHtml += '<i class="ri-star-fill text-amber-500"></i>';
        }

        // 반 별
        if (hasHalfStar) {
            starsHtml += '<i class="ri-star-half-fill text-amber-500"></i>';
        }

        // 빈 별
        for (let i = 0; i < emptyStars; i++) {
            starsHtml += '<i class="ri-star-line text-amber-500"></i>';
        }

        return starsHtml;
    }

    // URL 업데이트 및 데이터 리로드 함수
    function updateUrlAndReloadData() {
        updateUrlParameters({
            type: "reviews",
            page: currentPage,
            sort: selectedSort
        });
        setupSortUI(); // 정렬 UI 즉시 업데이트
        loadAndRenderData(currentPage);
    }

    // 초기 설정 및 데이터 로드
    setupSortUI();
    loadAndRenderData(currentPage);
}

// 전역 스코프에 노출
window.initializeReceivedReviewsView = initializeReceivedReviewsView;