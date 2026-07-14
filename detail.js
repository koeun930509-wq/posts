// DOM 요소 참조
const errorMsgEl = document.getElementById('errorMsg');
const detailTitleEl = document.getElementById('detailTitle');
const detailWriterEl = document.getElementById('detailWriter');
const detailCreatedAtEl = document.getElementById('detailCreatedAt');
const detailViewCountEl = document.getElementById('detailViewCount');
const detailContentEl = document.getElementById('detailContent');
const listBtnEl = document.getElementById('listBtn');
const editBtnEl = document.getElementById('editBtn');
const deleteBtnEl = document.getElementById('deleteBtn');

// URL 쿼리스트링(?id=...)에서 게시글 id 값을 읽어옴
const params = new URLSearchParams(window.location.search);
const postId = params.get('id');

// 에러 메시지를 화면에 표시
function showError(message) {
  errorMsgEl.textContent = message;
  errorMsgEl.hidden = false;
}

// 에러 메시지를 화면에서 숨김
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

// 조회한 게시글 데이터를 화면에 출력
function renderPost(post) {
  detailTitleEl.textContent = post.title;
  detailWriterEl.textContent = `작성자: ${post.writer}`;
  detailCreatedAtEl.textContent = `등록일: ${formatDate(post.created_at)}`;
  detailViewCountEl.textContent = `조회수: ${post.view_count}`;
  // 내용에 이미지(<img>)가 포함될 수 있어 innerHTML로 렌더링하되,
  // DOMPurify로 위험한 태그/속성을 제거한 뒤에만 화면에 반영함 (XSS 방지)
  detailContentEl.innerHTML = DOMPurify.sanitize(post.content, {
    ALLOWED_TAGS: ['img', 'br', 'div', 'p', 'b', 'i', 'strong', 'em', 'span'],
    ALLOWED_ATTR: ['src', 'class'],
  });
}

// 게시글 상세 조회 + 조회수 1 증가
async function fetchPost() {
  clearError();

  // URL에 id가 없는 경우 (잘못된 접근)
  if (!postId) {
    showError('잘못된 접근입니다. 게시글 id가 없습니다.');
    return;
  }

  try {
    // id에 해당하는 게시글 한 건을 조회
    const { data: post, error: selectError } = await supabaseClient
      .from('posts')
      .select('id, title, writer, content, view_count, created_at')
      .eq('id', postId)
      .single();

    if (selectError) {
      console.error('게시글 조회 오류:', selectError);
      showError(`게시글을 불러오는 중 오류가 발생했습니다: ${selectError.message}`);
      return;
    }

    // localStorage에 이 게시글을 이미 조회한 기록이 있는지 확인 (같은 브라우저에서는 1회만 증가)
    const viewedKey = `viewed_post_${postId}`;
    const alreadyViewed = localStorage.getItem(viewedKey);

    if (!alreadyViewed) {
      // 조회수를 1 증가시켜 업데이트
      const increasedViewCount = post.view_count + 1;
      const { error: updateError } = await supabaseClient
        .from('posts')
        .update({ view_count: increasedViewCount })
        .eq('id', postId);

      if (updateError) {
        // 조회수 증가에 실패해도 상세 내용은 그대로 보여줌
        console.error('조회수 증가 오류:', updateError);
      } else {
        post.view_count = increasedViewCount;
        // 조회 기록을 남겨 같은 브라우저에서 재방문 시 다시 증가하지 않도록 함
        localStorage.setItem(viewedKey, 'true');
      }
    }

    renderPost(post);
  } catch (err) {
    console.error('게시글 조회 중 예외 발생:', err);
    showError(`알 수 없는 오류가 발생했습니다: ${err.message}`);
  }
}

// 게시글 삭제
async function deletePost() {
  if (!confirm('정말 삭제하시겠습니까?')) {
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('posts')
      .delete()
      .eq('id', postId);

    if (error) {
      console.error('게시글 삭제 오류:', error);
      showError(`게시글 삭제 중 오류가 발생했습니다: ${error.message}`);
      return;
    }

    alert('게시글이 삭제되었습니다.');
    window.location.href = 'index.html';
  } catch (err) {
    console.error('게시글 삭제 중 예외 발생:', err);
    showError(`알 수 없는 오류가 발생했습니다: ${err.message}`);
  }
}

// 목록 버튼 클릭 시 목록 페이지로 이동
listBtnEl.addEventListener('click', () => {
  window.location.href = 'index.html';
});

// 수정 버튼 클릭 시 수정 페이지로 이동
editBtnEl.addEventListener('click', () => {
  window.location.href = `edit.html?id=${postId}`;
});

// 삭제 버튼 클릭 시 게시글 삭제
deleteBtnEl.addEventListener('click', deletePost);

// 페이지 로드 시 게시글 상세 조회
fetchPost();
