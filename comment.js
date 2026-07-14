// DOM 요소 참조 (댓글 영역)
// 참고: postId 변수는 detail.js에서 URL의 ?id= 값으로 이미 만들어 둔 것을 그대로 재사용합니다.
const commentListEl = document.getElementById('commentList');
const commentFormEl = document.getElementById('commentForm');
const commentWriterEl = document.getElementById('commentWriter');
const commentContentEl = document.getElementById('commentContent');
const commentErrorMsgEl = document.getElementById('commentErrorMsg');
const commentCountEl = document.getElementById('commentCount');

// 댓글 에러 메시지를 화면에 표시
function showCommentError(message) {
  commentErrorMsgEl.textContent = message;
  commentErrorMsgEl.hidden = false;
}

// 댓글 에러 메시지를 화면에서 숨김
function clearCommentError() {
  commentErrorMsgEl.hidden = true;
  commentErrorMsgEl.textContent = '';
}

// 댓글 한 개를 보기 모드(HTML)로 그려줌
function buildViewHtml(comment) {
  return `
    <div class="comment-meta">
      <div class="comment-meta-info">
        <span class="comment-writer">${comment.writer}</span>
        <span class="comment-date">${formatDate(comment.created_at)}</span>
      </div>
      <div class="comment-actions">
        <button type="button" class="btn-link comment-edit-btn">수정</button>
        <button type="button" class="btn-link btn-link-danger comment-delete-btn">삭제</button>
      </div>
    </div>
    <div class="comment-content">${comment.content}</div>
  `;
}

// 댓글 배열을 목록(li)으로 그려줌
// formatDate 함수는 detail.js에 이미 정의되어 있어 그대로 가져다 씁니다.
function renderComments(comments) {
  commentListEl.innerHTML = '';

  // 댓글이 하나도 없으면 안내 문구를 표시
  if (!comments || comments.length === 0) {
    commentListEl.innerHTML = '<li class="comment-empty">등록된 댓글이 없습니다.</li>';
    return;
  }

  comments.forEach((comment) => {
    const li = document.createElement('li');
    li.className = 'comment-item';
    // data-id에 댓글 id를 담아두어, 수정/저장 시 어떤 댓글인지 구분함
    li.dataset.id = comment.id;
    li.innerHTML = buildViewHtml(comment);
    commentListEl.appendChild(li);
  });
}

// 현재 게시글(postId)에 달린 댓글 목록을 등록일이 오래된 순으로 조회
async function fetchComments() {
  clearCommentError();

  try {
    // comments 테이블에서 이 게시글(post_id)에 해당하는 댓글만 조회
    const { data, error } = await supabaseClient
      .from('comments')
      .select('id, writer, content, created_at')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('댓글 조회 오류:', error);
      showCommentError(`댓글을 불러오는 중 오류가 발생했습니다: ${error.message}`);
      return;
    }

    renderComments(data);
    // 댓글 제목 옆에 전체 댓글 수를 표시
    commentCountEl.textContent = data.length;
  } catch (err) {
    console.error('댓글 조회 중 예외 발생:', err);
    showCommentError(`알 수 없는 오류가 발생했습니다: ${err.message}`);
  }
}

// 댓글 등록 폼 제출(댓글 등록 버튼 클릭) 시 실행
async function handleCommentSubmit(event) {
  // form의 기본 제출 동작(새로고침)을 막음
  event.preventDefault();
  clearCommentError();

  const writer = commentWriterEl.value.trim();
  const content = commentContentEl.value.trim();

  // 작성자와 댓글 내용은 필수 입력
  if (!writer || !content) {
    showCommentError('작성자와 댓글 내용은 필수 입력 항목입니다.');
    return;
  }

  try {
    // comments 테이블에 새 댓글 한 건을 등록 (post_id로 어느 게시글의 댓글인지 표시)
    const { error } = await supabaseClient
      .from('comments')
      .insert([{ post_id: postId, writer, content }]);

    if (error) {
      console.error('댓글 등록 오류:', error);
      showCommentError(`댓글 등록 중 오류가 발생했습니다: ${error.message}`);
      return;
    }

    // 입력창을 비우고 댓글 목록을 다시 조회하여 새 댓글을 반영
    commentWriterEl.value = '';
    commentContentEl.value = '';
    await fetchComments();
  } catch (err) {
    console.error('댓글 등록 중 예외 발생:', err);
    showCommentError(`알 수 없는 오류가 발생했습니다: ${err.message}`);
  }
}

// 댓글 id로 댓글 한 건을 조회 (수정 모드 진입 시 최신 내용을 가져오기 위함)
async function fetchCommentById(commentId) {
  const { data, error } = await supabaseClient
    .from('comments')
    .select('id, content')
    .eq('id', commentId)
    .single();

  if (error) {
    console.error('댓글 조회 오류:', error);
    showCommentError(`댓글을 불러오는 중 오류가 발생했습니다: ${error.message}`);
    return null;
  }

  return data;
}

// 댓글 항목(li)을 수정 모드 화면으로 전환
function renderEditMode(li, content) {
  li.innerHTML = `
    <textarea class="comment-edit-textarea" rows="3">${content}</textarea>
    <div class="comment-actions">
      <button type="button" class="btn comment-cancel-btn">취소</button>
      <button type="button" class="btn btn-primary comment-save-btn">저장</button>
    </div>
  `;
}

// 수정 버튼 클릭 시: 댓글 id로 최신 내용을 조회한 뒤 수정 모드로 전환
async function handleEditClick(li, commentId) {
  clearCommentError();

  const comment = await fetchCommentById(commentId);
  if (!comment) {
    return;
  }

  renderEditMode(li, comment.content);
}

// 저장 버튼 클릭 시: 수정한 내용을 comments 테이블에 반영
async function handleSaveClick(li, commentId) {
  clearCommentError();

  const textarea = li.querySelector('.comment-edit-textarea');
  const content = textarea.value.trim();

  if (!content) {
    showCommentError('댓글 내용을 입력해주세요.');
    return;
  }

  try {
    // 댓글 id에 해당하는 행의 content(내용)만 수정
    const { error } = await supabaseClient
      .from('comments')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', commentId);

    if (error) {
      console.error('댓글 수정 오류:', error);
      showCommentError(`댓글 수정 중 오류가 발생했습니다: ${error.message}`);
      return;
    }

    // 수정 완료 후 댓글 목록을 다시 조회하여 반영
    await fetchComments();
  } catch (err) {
    console.error('댓글 수정 중 예외 발생:', err);
    showCommentError(`알 수 없는 오류가 발생했습니다: ${err.message}`);
  }
}

// 삭제 버튼 클릭 시: 사용자에게 확인을 받은 뒤 댓글 id로 삭제
async function handleDeleteClick(commentId) {
  clearCommentError();

  // 삭제 여부를 사용자에게 확인
  if (!confirm('댓글을 삭제하시겠습니까?')) {
    return;
  }

  try {
    // 댓글 id에 해당하는 행을 삭제
    const { error } = await supabaseClient
      .from('comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('댓글 삭제 오류:', error);
      showCommentError(`댓글 삭제 중 오류가 발생했습니다: ${error.message}`);
      return;
    }

    // 삭제 완료 후 댓글 목록을 다시 조회하여 반영
    await fetchComments();
  } catch (err) {
    console.error('댓글 삭제 중 예외 발생:', err);
    showCommentError(`알 수 없는 오류가 발생했습니다: ${err.message}`);
  }
}

// 댓글 목록 영역에서 발생하는 클릭을 한 곳에서 처리 (이벤트 위임)
// 수정/저장/취소/삭제 버튼이 댓글마다 새로 생성되므로, 목록 전체에 이벤트를 하나만 연결해 처리함
commentListEl.addEventListener('click', async (event) => {
  const li = event.target.closest('.comment-item');
  if (!li) {
    return;
  }

  const commentId = li.dataset.id;

  if (event.target.classList.contains('comment-edit-btn')) {
    await handleEditClick(li, commentId);
  } else if (event.target.classList.contains('comment-save-btn')) {
    await handleSaveClick(li, commentId);
  } else if (event.target.classList.contains('comment-cancel-btn')) {
    // 취소 시 서버에서 다시 조회하여 원래 내용으로 되돌림
    await fetchComments();
  } else if (event.target.classList.contains('comment-delete-btn')) {
    await handleDeleteClick(commentId);
  }
});

// 댓글 등록 폼 제출 이벤트 연결
commentFormEl.addEventListener('submit', handleCommentSubmit);

// 페이지 로드 시 댓글 목록 조회
fetchComments();
