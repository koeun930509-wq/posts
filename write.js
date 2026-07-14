// DOM 요소 참조 (HTML의 id 값으로 요소를 가져옴)
const writeFormEl = document.getElementById('writeForm');
const titleEl = document.getElementById('title');
const writerEl = document.getElementById('writer');
const contentEl = document.getElementById('content'); // contenteditable div (일반 textarea가 아님)
const errorMsgEl = document.getElementById('errorMsg');
const listBtnEl = document.getElementById('listBtn');
const imageEl = document.getElementById('image');

// 이미지를 업로드할 Supabase Storage 버킷 이름
const IMAGE_BUCKET = 'postsImg';

// 압축 후 이미지의 최대 가로/세로 길이(px)와 JPEG 품질(0~1)
const MAX_IMAGE_SIZE = 1280;
const IMAGE_QUALITY = 0.7;

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

// 선택한 이미지 파일을 canvas에 그려서 크기를 줄이고 압축함
// PNG는 투명 배경을 가질 수 있어 PNG로 유지하고, 그 외(JPEG 등)는 JPEG로 압축함
async function compressImage(file) {
  // 브라우저가 이미지 파일을 디코딩할 수 있는 형태(ImageBitmap)로 변환
  const imageBitmap = await createImageBitmap(file);
  let { width, height } = imageBitmap;

  // 가로 또는 세로가 최대 길이를 넘으면 비율을 유지한 채 축소
  if (width > MAX_IMAGE_SIZE || height > MAX_IMAGE_SIZE) {
    const ratio = Math.min(MAX_IMAGE_SIZE / width, MAX_IMAGE_SIZE / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  // 계산한 크기로 canvas에 이미지를 그림
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(imageBitmap, 0, 0, width, height);

  // PNG는 투명도를 유지해야 하므로 PNG로, 나머지는 JPEG로 변환 (품질을 낮춰 용량을 줄임)
  const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';

  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), outputType, outputType === 'image/jpeg' ? IMAGE_QUALITY : undefined);
  });
}

// 압축된 이미지를 Supabase Storage에 업로드하고 공개 URL을 반환
async function uploadImage(blob) {
  // blob.type(예: image/png, image/jpeg)에 맞춰 확장자를 정함
  const extension = blob.type === 'image/png' ? 'png' : 'jpg';
  // 파일명이 겹치지 않도록 현재 시각 + 임의 문자열로 경로를 만듦
  const filePath = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;

  const { error } = await supabaseClient
    .storage
    .from(IMAGE_BUCKET)
    .upload(filePath, blob, { contentType: blob.type });

  if (error) {
    throw error;
  }

  // 업로드한 파일의 공개 URL을 가져옴
  const { data } = supabaseClient.storage.from(IMAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

// 현재 커서(캐럿) 위치에 이미지를 삽입. 커서 위치를 알 수 없으면 맨 끝에 삽입
function insertImageAtCursor(url) {
  contentEl.focus();

  const img = document.createElement('img');
  img.src = url;
  img.className = 'content-image';

  const selection = window.getSelection();
  let range;

  if (selection && selection.rangeCount > 0 && contentEl.contains(selection.anchorNode)) {
    // 이미 content 영역 안에 커서가 있으면 그 위치를 그대로 사용
    range = selection.getRangeAt(0);
  } else {
    // 커서 위치가 없으면 content 영역의 맨 끝으로 이동
    range = document.createRange();
    range.selectNodeContents(contentEl);
    range.collapse(false);
  }

  range.deleteContents();
  range.insertNode(img);

  // 이미지 바로 뒤로 커서를 옮겨서 이어서 타이핑할 수 있게 함
  range.setStartAfter(img);
  range.setEndAfter(img);
  selection.removeAllRanges();
  selection.addRange(range);
}

// 이미지 파일을 선택하면: 압축 -> 업로드 -> 커서 위치에 미리보기 삽입
imageEl.addEventListener('change', async () => {
  const file = imageEl.files[0];
  if (!file) {
    return;
  }

  clearError();

  try {
    const compressedBlob = await compressImage(file);
    const publicUrl = await uploadImage(compressedBlob);
    insertImageAtCursor(publicUrl);
  } catch (err) {
    console.error('이미지 처리 중 오류 발생:', err);
    showError(`이미지 처리 중 오류가 발생했습니다: ${err.message}`);
  } finally {
    // 같은 파일을 다시 선택해도 change 이벤트가 발생하도록 값을 비움
    imageEl.value = '';
  }
});

// 폼이 제출(저장 버튼 클릭)될 때 실행되는 함수
async function handleSubmit(event) {
  // form의 기본 제출 동작(새로고침)을 막음
  event.preventDefault();
  clearError();

  // 입력값 앞뒤 공백 제거
  const title = titleEl.value.trim();
  const writer = writerEl.value.trim();
  const contentText = contentEl.textContent.trim();
  const contentHasImage = contentEl.querySelector('img') !== null;

  // 필수 입력값 검증: 제목/작성자는 항상 필수, 내용은 글자 또는 이미지 중 하나라도 있어야 함
  if (!title || !writer || (!contentText && !contentHasImage)) {
    showError('제목, 작성자, 내용은 필수 입력 항목입니다.');
    return;
  }

  // contenteditable 안의 HTML(텍스트 + 이미지)에서 위험한 태그/속성을 제거
  const content = DOMPurify.sanitize(contentEl.innerHTML, {
    ALLOWED_TAGS: ['img', 'br', 'div', 'p', 'b', 'i', 'strong', 'em', 'span'],
    ALLOWED_ATTR: ['src', 'class'],
  });

  try {
    // posts 테이블에 새 게시글 한 건을 등록 (insert)
    const { error } = await supabaseClient
      .from('posts')
      .insert([{ title, writer, content }]);

    // Supabase가 에러를 반환한 경우 (권한 문제, 제약조건 위반 등)
    if (error) {
      console.error('게시글 등록 오류:', error);
      showError(`게시글 등록 중 오류가 발생했습니다: ${error.message}`);
      return;
    }

    // 등록 성공: 안내 메시지를 보여준 뒤 목록 페이지로 이동
    alert('게시글이 등록되었습니다.');
    window.location.href = 'index.html';
  } catch (err) {
    // 네트워크 오류 등 요청 자체가 실패한 경우
    console.error('게시글 등록 중 예외 발생:', err);
    showError(`알 수 없는 오류가 발생했습니다: ${err.message}`);
  }
}

// 폼 제출(저장 버튼 클릭) 이벤트 연결
writeFormEl.addEventListener('submit', handleSubmit);

// 초기화 버튼을 누르면 입력값, 내용(이미지 포함), 에러 메시지를 모두 지워줌
// content는 contenteditable div라서 reset 이벤트로 자동으로 비워지지 않아 직접 비워줘야 함
writeFormEl.addEventListener('reset', () => {
  clearError();
  contentEl.innerHTML = '';
});

// 목록 버튼 클릭 시 목록 페이지(index.html)로 이동
listBtnEl.addEventListener('click', () => {
  window.location.href = 'index.html';
});
