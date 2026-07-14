// DOM 요소 참조
const postListEl = document.getElementById('postList');
const errorMsgEl = document.getElementById('errorMsg');
const searchTypeEl = document.getElementById('searchType');
const searchInputEl = document.getElementById('searchInput');
const searchBtnEl = document.getElementById('searchBtn');
const writeBtnEl = document.getElementById('writeBtn');
const listBtnEl = document.getElementById('listBtn');
const paginationEl = document.getElementById('pagination');
const postCountEl = document.getElementById('postCount');

// 한 페이지에 보여줄 게시글 수
const PAGE_SIZE = 10;

// 현재 검색어 / 검색 조건 / 페이지 번호를 기억해두는 상태값
let currentKeyword = '';
let currentSearchType = 'all';
let currentPage = 1;

// 에러 메시지 영역에 텍스트를 표시
function showError(message) {
  errorMsgEl.textContent = message;
  errorMsgEl.hidden = false;
}

// 에러 메시지 영역을 숨기고 초기화
function clearError() {
  errorMsgEl.hidden = true;
  errorMsgEl.textContent = '';
}

// ISO 날짜 문자열을 'YYYY-MM-DD' 형식으로 변환
function formatDate(isoString) {
  const date = new Date(isoString);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

// 게시글 id 목록을 받아 각 게시글의 댓글 수를 { 게시글id: 댓글수 } 형태로 조회
async function fetchCommentCounts(postIds) {
  if (!postIds || postIds.length === 0) {
    return {};
  }

  const { data, error } = await supabaseClient
    .from('comments')
    .select('post_id')
    .in('post_id', postIds);

  if (error) {
    // 댓글 수 조회에 실패해도 게시글 목록은 그대로 보여줌
    console.error('댓글 수 조회 오류:', error);
    return {};
  }

  // post_id별로 몇 번 등장하는지 세어서 댓글 수를 계산
  const counts = {};
  data.forEach((row) => {
    counts[row.post_id] = (counts[row.post_id] || 0) + 1;
  });
  return counts;
}

// 게시글 배열을 테이블 행(tr)으로 그려줌
function renderPosts(posts, commentCounts) {
  postListEl.innerHTML = '';

  // 조회 결과가 없으면 안내 문구를 표시
  if (!posts || posts.length === 0) {
    postListEl.innerHTML = '<tr><td colspan="5" class="empty-row">게시글이 없습니다.</td></tr>';
    return;
  }

  // 게시글마다 행을 만들어 테이블에 추가 (제목 클릭 시 상세 페이지로 이동)
  posts.forEach((post) => {
    // 내용(content)에 <img> 태그가 있으면 이미지가 첨부된 게시글로 판단
    const hasImage = post.content && post.content.includes('<img');
    // 댓글이 하나라도 있으면 제목 옆에 (댓글수) 표시
    const commentCount = commentCounts[post.id] || 0;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="col-id">${post.id}</td>
      <td class="col-title">
        <a class="post-title-link" href="detail.html?id=${post.id}">${post.title}</a>
        ${commentCount > 0 ? `<span class="comment-count-badge">(${commentCount})</span>` : ''}
        ${hasImage ? '<span class="image-icon" title="이미지 포함">🖼️</span>' : ''}
      </td>
      <td class="col-writer">${post.writer}</td>
      <td class="col-view">${post.view_count}</td>
      <td class="col-date">${formatDate(post.created_at)}</td>
    `;
    postListEl.appendChild(tr);
  });
}

// 전체 게시글 수(totalCount)를 기준으로 페이지 번호 버튼을 그려줌
function renderPagination(totalCount) {
  paginationEl.innerHTML = '';

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // 게시글이 없거나 1페이지뿐이면 페이지네이션을 표시하지 않음
  if (totalPages <= 1) {
    return;
  }

  for (let page = 1; page <= totalPages; page++) {
    const pageBtn = document.createElement('button');
    pageBtn.type = 'button';
    pageBtn.textContent = page;
    pageBtn.className = 'page-btn';

    if (page === currentPage) {
      pageBtn.classList.add('active');
    }

    pageBtn.addEventListener('click', () => {
      fetchPosts(page);
    });

    paginationEl.appendChild(pageBtn);
  }
}

// Supabase에서 게시글 목록을 조회 (검색 조건: 전체/제목/내용, 페이지 단위로 10개씩)
async function fetchPosts(page = 1) {
  clearError();
  currentPage = page;
  postListEl.innerHTML = '<tr><td colspan="5" class="loading-row">불러오는 중...</td></tr>';

  try {
    // 이번 페이지에서 조회할 시작/끝 인덱스 계산 (0부터 시작)
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    // posts 테이블에서 필요한 컬럼만 선택하고 최신순(작성일 내림차순)으로 정렬
    // count: 'exact' 옵션으로 검색 조건에 맞는 전체 게시글 수도 함께 받아옴
    let query = supabaseClient
      .from('posts')
      .select('id, title, writer, view_count, created_at, content', { count: 'exact' })
      .order('created_at', { ascending: false });

    // 검색어가 있으면 선택된 조건(전체/제목/내용)에 따라 대소문자 구분 없는 부분 일치 검색(ilike) 적용
    if (currentKeyword) {
      if (currentSearchType === 'title') {
        query = query.ilike('title', `%${currentKeyword}%`);
      } else if (currentSearchType === 'content') {
        query = query.ilike('content', `%${currentKeyword}%`);
      } else {
        // 전체: 제목 또는 내용 중 하나라도 일치하면 포함
        query = query.or(`title.ilike.%${currentKeyword}%,content.ilike.%${currentKeyword}%`);
      }
    }

    // range()로 이번 페이지에 해당하는 구간만 가져옴
    const { data, error, count } = await query.range(from, to);

    // Supabase 응답에 에러가 담겨있는 경우 (쿼리 실패, 권한 문제 등)
    if (error) {
      showError(`게시글을 불러오는 중 오류가 발생했습니다: ${error.message}`);
      postListEl.innerHTML = '';
      paginationEl.innerHTML = '';
      return;
    }

    // 이번 페이지에 보이는 게시글들의 댓글 수를 함께 조회
    const commentCounts = await fetchCommentCounts(data.map((post) => post.id));

    renderPosts(data, commentCounts);
    renderPagination(count);
    // 헤더에 검색 조건에 맞는 전체 게시글 수를 표시
    postCountEl.textContent = `Total ${count}`;
  } catch (err) {
    // 네트워크 단절 등 요청 자체가 실패한 경우
    showError(`알 수 없는 오류가 발생했습니다: ${err.message}`);
    postListEl.innerHTML = '';
    paginationEl.innerHTML = '';
  }
}

// 검색어와 검색 조건(전체/제목/내용)을 읽어와 1페이지부터 검색 실행
function handleSearch() {
  currentKeyword = searchInputEl.value.trim();
  currentSearchType = searchTypeEl.value;
  fetchPosts(1);
}

// 검색 버튼 클릭 시 검색 실행
searchBtnEl.addEventListener('click', handleSearch);

// 입력창에서 Enter 키를 눌러도 검색 실행
searchInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    handleSearch();
  }
});

// 글쓰기 버튼 클릭 시 글쓰기 페이지로 이동
writeBtnEl.addEventListener('click', () => {
  window.location.href = 'write.html';
});

// 목록 버튼 클릭 시 목록(index.html)을 새로 조회
listBtnEl.addEventListener('click', () => {
  window.location.href = 'index.html';
});

// 페이지 로드 시 전체 게시글 1페이지 조회
fetchPosts(1);
